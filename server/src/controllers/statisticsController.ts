import { Request, Response } from 'express';
import { prisma } from '../app.js';
import { Event } from '../models/mongodb/index.js';

export async function getEventStats(req: Request, res: Response) {
  try {
    const eventId = req.params.id;
    const rawStats = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT * FROM public.uniplan_statistics WHERE event_id = $1`, eventId,
    );
    if (!rawStats || rawStats.length === 0) {
      res.status(404).json({ message: 'Stats not found', code: 'NOT_FOUND' });
      return;
    }

    const event = await Event.findById(eventId).select('maxAttendees').lean();
    const maxAttendees = event?.maxAttendees || 1;
    const occupancy = maxAttendees > 0
      ? Math.round((rawStats[0].total_registered / maxAttendees) * 100)
      : 0;

    res.json({ ...rawStats[0], occupancyPercentage: occupancy, eventId: rawStats[0].event_id });
  } catch (e) {
    console.error('GetEventStats error:', e);
    res.status(500).json({ message: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export async function getAllStats(req: Request, res: Response) {
  try {
    const rawStats = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT event_id FROM public.uniplan_statistics ORDER BY last_updated DESC`,
    );

    const eventIds = rawStats.map(r => r.event_id);
    const events = await Event.find({ _id: { $in: eventIds } })
      .select('title eventType maxAttendees date')
      .lean();

    const eventMap = new Map(events.map(e => [String(e._id), e]));

    const stats = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT s.event_id as "eventId",
              COALESCE(s.total_registered, 0) as "totalRegistered",
              COALESCE(s.total_cancelled, 0) as "totalCancelled",
              COALESCE(s.total_attended, 0) as "totalAttended",
              s.demographics
       FROM public.uniplan_statistics s
       ORDER BY s.last_updated DESC`,
    );

    const mapped = stats.map(s => {
      const evt = eventMap.get(s.eventId);
      return {
        eventId: s.eventId,
        eventTitle: evt?.title || 'Unknown',
        eventType: evt?.eventType || 'UNKNOWN',
        totalRegistered: Number(s.totalRegistered),
        totalCancelled: Number(s.totalCancelled),
        totalAttended: Number(s.totalAttended),
        occupancyPercentage: evt && evt.maxAttendees > 0
          ? Math.round((Number(s.totalRegistered) / evt.maxAttendees) * 100)
          : 0,
        demographics: s.demographics,
      };
    });

    res.json({ data: mapped });
  } catch (e) {
    console.error('GetAllStats error:', e);
    res.status(500).json({ message: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}
