import { Request, Response } from 'express';
import { pgPool } from '../app.js';
import { Event, Organizer } from '../models/mongodb/index.js';
import { EventStatus } from '@uniplan/shared';
import { sendCsv } from '../utils/csv.js';

const query = (sql: string, params?: any[]) => pgPool.query(sql, params);

export async function getEventStats(req: Request, res: Response) {
  try {
    const eventId = req.params.id;
    const rawStats = await query(
      `SELECT * FROM public.uniplan_statistics WHERE event_id = $1`, [eventId],
    );
    if (!rawStats || rawStats.rows.length === 0) {
      res.status(404).json({ message: 'Stats not found', code: 'NOT_FOUND' });
      return;
    }

    const event = await Event.findById(eventId).select('maxAttendees').lean();
    const maxAttendees = event?.maxAttendees || 1;
    const occupancy = maxAttendees > 0
      ? Math.round((rawStats.rows[0].total_registered / maxAttendees) * 100)
      : 0;

    res.json({ ...rawStats.rows[0], occupancyPercentage: occupancy, eventId: rawStats.rows[0].event_id });
  } catch (e) {
    console.error('GetEventStats error:', e);
    res.status(500).json({ message: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export async function getAllStats(req: Request, res: Response) {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 25));
    const search = (req.query.search as string || '').trim();

    const rawStats = await query(
      `SELECT event_id FROM public.uniplan_statistics ORDER BY last_updated DESC LIMIT $1 OFFSET $2`,
      [limit, (page - 1) * limit],
    );

    const eventIds = rawStats.rows.map((r: any) => r.event_id);
    const eventQuery: any = { _id: { $in: eventIds } };
    if (search) eventQuery.title = { $regex: search, $options: 'i' };
    const events = await Event.find(eventQuery)
      .select('title eventType maxAttendees date')
      .lean();

    const eventMap = new Map(events.map(e => [String(e._id), e]));

    const stats = await query(
      `SELECT s.event_id as "eventId",
              COALESCE(s.total_registered, 0) as "totalRegistered",
              COALESCE(s.total_cancelled, 0) as "totalCancelled",
              COALESCE(s.total_attended, 0) as "totalAttended",
              s.demographics
       FROM public.uniplan_statistics s
       WHERE s.event_id = ANY($1::text[])
       ORDER BY s.last_updated DESC`,
      [eventIds],
    );

    const mapped = stats.rows
      .map((s: any) => {
        const evt = eventMap.get(s.eventId);
        if (!evt) return null;
        return {
          eventId: s.eventId,
          eventTitle: evt.title,
          eventType: evt.eventType,
          totalRegistered: Number(s.totalRegistered),
          totalCancelled: Number(s.totalCancelled),
          totalAttended: Number(s.totalAttended),
          occupancyPercentage: evt.maxAttendees > 0
            ? Math.round((Number(s.totalRegistered) / evt.maxAttendees) * 100)
            : 0,
          demographics: s.demographics,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    const allValidIds = (await Event.find({}, '_id').lean()).map(e => String(e._id));
    const validCountResult = await query(
      `SELECT COUNT(*) as total FROM public.uniplan_statistics WHERE event_id = ANY($1::text[])`,
      [allValidIds],
    );
    const total = parseInt(validCountResult.rows[0].total, 10);

    res.json({
      data: mapped,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (e) {
    console.error('GetAllStats error:', e);
    res.status(500).json({ message: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export async function getDashboard(req: Request, res: Response) {
  try {
    const [statusGroups, pgAgg, uniqueStudents, organizerCount] = await Promise.all([
      Event.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      query(
        `SELECT SUM(total_registered)::int as "totalRegistrations",
                SUM(total_cancelled)::int as "totalCancellations",
                SUM(total_attended)::int as "totalAttendees"
         FROM public.uniplan_statistics`,
      ),
      Event.distinct('registrations.studentId'),
      Organizer.countDocuments(),
    ]);

    const pgRow = pgAgg.rows[0] || { totalRegistrations: 0, totalCancellations: 0, totalAttendees: 0 };

    const statusMap = new Map(statusGroups.map(g => [g._id, g.count]));
    const upcoming = statusMap.get(EventStatus.UPCOMING) || 0;
    const inProgress = statusMap.get(EventStatus.IN_PROGRESS) || 0;
    const finished = statusMap.get(EventStatus.FINISHED) || 0;
    const total = upcoming + inProgress + finished;

    const eventsByStatus = statusGroups.map(g => ({ status: g._id, count: g.count }));

    const allStatsRows = await query(
      `SELECT s.event_id, s.total_registered, s.total_cancelled, s.total_attended
       FROM public.uniplan_statistics s`,
    );

    const allStatsIds = allStatsRows.rows.map((r: any) => r.event_id);
    const allStatsEvents = await Event.find({ _id: { $in: allStatsIds } })
      .select('eventType maxAttendees')
      .lean();
    const allStatsEventMap = new Map(allStatsEvents.map(e => [String(e._id), e]));

    const typeAgg: Record<string, { registered: number; cancelled: number; attended: number }> = {};
    let totalPct = 0;
    let countWithMax = 0;
    for (const row of allStatsRows.rows) {
      const evt = allStatsEventMap.get(row.event_id);
      if (!evt) continue;
      const et = evt.eventType;
      if (!typeAgg[et]) typeAgg[et] = { registered: 0, cancelled: 0, attended: 0 };
      typeAgg[et].registered += Number(row.total_registered);
      typeAgg[et].cancelled += Number(row.total_cancelled);
      typeAgg[et].attended += Number(row.total_attended);
      if (evt.maxAttendees > 0) {
        totalPct += (Number(row.total_registered) / evt.maxAttendees) * 100;
        countWithMax++;
      }
    }
    const registrationsByType = Object.entries(typeAgg).map(([eventType, v]) => ({
      eventType, ...v,
    }));
    const avgOccupancy = countWithMax > 0 ? Math.round(totalPct / countWithMax) : 0;

    const payload = {
      totalEvents: total,
      activeEvents: upcoming + inProgress,
      finishedEvents: finished,
      totalRegistrations: Number(pgRow.totalRegistrations),
      totalCancellations: Number(pgRow.totalCancellations),
      totalAttendees: Number(pgRow.totalAttendees),
      totalUniqueStudents: uniqueStudents.length,
      totalOrganizers: organizerCount,
      avgOccupancy,
      registrationsByEventType: registrationsByType,
      eventsByStatus,
    };

    if (req.query.format === 'csv') {
      sendCsv(res, 'dashboard.csv', [{
        totalEvents: payload.totalEvents,
        activeEvents: payload.activeEvents,
        finishedEvents: payload.finishedEvents,
        totalRegistrations: payload.totalRegistrations,
        totalCancellations: payload.totalCancellations,
        totalAttendees: payload.totalAttendees,
        totalUniqueStudents: payload.totalUniqueStudents,
        totalOrganizers: payload.totalOrganizers,
        avgOccupancy: payload.avgOccupancy,
      }]);
      return;
    }

    res.json(payload);
  } catch (e) {
    console.error('GetDashboard error:', e);
    res.status(500).json({ message: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export async function getFacultyByEventType(req: Request, res: Response) {
  try {
    const months = Math.max(1, Math.min(36, parseInt(req.query.months as string) || 12));
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);

    const events = await Event.find({ date: { $gte: cutoff } }).lean();

    const result: Record<string, Record<string, number>> = {};

    for (const event of events) {
      const et = event.eventType;
      if (!result[et]) result[et] = {};

      for (const reg of event.registrations || []) {
        if (!reg.faculty) continue;
        result[et][reg.faculty] = (result[et][reg.faculty] || 0) + 1;
      }
    }

    const data: Record<string, Array<{ faculty: string; count: number }>> = {};
    for (const eventType of Object.keys(result)) {
      data[eventType] = Object.entries(result[eventType])
        .map(([faculty, count]) => ({ faculty, count }))
        .sort((a, b) => b.count - a.count);
    }

    if (req.query.format === 'csv') {
      const flat: Record<string, unknown>[] = [];
      for (const [eventType, entries] of Object.entries(data)) {
        for (const entry of entries) {
          flat.push({ eventType, faculty: entry.faculty, count: entry.count });
        }
      }
      sendCsv(res, 'faculty-by-event-type.csv', flat);
      return;
    }

    res.json({ data });
  } catch (e) {
    console.error('GetFacultyByEventType error:', e);
    res.status(500).json({ message: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}
