import { Request, Response } from 'express';
import { Event, Organizer } from '../models/mongodb/index.js';
import { RegistrationStatus, EventStatus } from '@uniplan/shared';
import { sendCsv } from '../utils/csv.js';
import { pgPool } from '../app.js';

function occupancyPipeline() {
  return [
    {
      $group: {
        _id: '$eventType',
        totalEvents: { $sum: 1 },
        avgOccupancy: {
          $avg: {
            $cond: [
              { $gt: ['$maxAttendees', 0] },
              {
                $multiply: [
                  {
                    $divide: [
                      {
                        $size: {
                          $filter: {
                            input: '$registrations',
                            cond: { $eq: ['$$this.status', RegistrationStatus.REGISTERED] },
                          },
                        },
                      },
                      '$maxAttendees',
                    ],
                  },
                  100,
                ],
              },
              0,
            ],
          },
        },
      },
    },
    { $sort: { avgOccupancy: -1 as const } },
    {
      $project: {
        eventType: '$_id',
        totalEvents: 1,
        avgOccupancy: { $round: ['$avgOccupancy', 1] },
        _id: 0,
      },
    },
  ] as any[];
}

function computeEngagementCounts(events: any[]) {
  const facultyCount: Record<string, number> = {};
  const programCount: Record<string, number> = {};
  const campusCount: Record<string, number> = {};
  const semesterCount: Record<string, number> = {};
  const studentSet = new Set<string>();

  for (const event of events) {
    const eventDate = event.date instanceof Date ? event.date : new Date(event.date as any);
    const month = eventDate.getMonth();
    const year = eventDate.getFullYear();
    const semester = month < 6 ? `${year}-1` : `${year}-2`;

    for (const reg of event.registrations || []) {
      if (reg.status === RegistrationStatus.REGISTERED) {
        studentSet.add(reg.studentId);
        if (reg.faculty) facultyCount[reg.faculty] = (facultyCount[reg.faculty] || 0) + 1;
        if (reg.program) programCount[reg.program] = (programCount[reg.program] || 0) + 1;
        if (reg.campus) campusCount[reg.campus] = (campusCount[reg.campus] || 0) + 1;
        semesterCount[semester] = (semesterCount[semester] || 0) + 1;
      }
    }
  }

  return { facultyCount, programCount, campusCount, semesterCount, studentSet };
}

function sortEngagementCounts(counts: Record<string, number>, key: string) {
  return Object.entries(counts)
    .map(([value, studentCount]) => ({ [key]: value, studentCount } as Record<string, unknown>))
    .sort((a, b) => (b.studentCount as number) - (a.studentCount as number));
}

function topStudentsPipeline() {
  return [
    { $unwind: '$registrations' },
    { $match: { 'registrations.status': { $in: [RegistrationStatus.REGISTERED, RegistrationStatus.ATTENDED] } } },
    { $group: { _id: { studentId: '$registrations.studentId', studentName: '$registrations.studentName' }, eventCount: { $sum: 1 } } },
    { $sort: { eventCount: -1 as const } },
    { $limit: 10 },
    { $project: { studentId: '$_id.studentId', studentName: '$_id.studentName', eventCount: 1, _id: 0 } },
  ] as any[];
}

function byEventTypePipeline() {
  return [
    { $unwind: '$registrations' },
    { $match: { 'registrations.status': { $in: [RegistrationStatus.REGISTERED, RegistrationStatus.ATTENDED] } } },
    { $group: { _id: '$eventType', count: { $sum: 1 } } },
    { $project: { eventType: '$_id', count: 1, _id: 0 } },
  ] as any[];
}

async function computeOrganizerPerformance(months: number) {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);

  const events = await Event.find({ date: { $gte: cutoff } }).lean();
  const organizers = await Organizer.find().lean();

  const organizerMap = new Map(
    organizers.map(o => [o.userId, { name: o.name, approvedByAdmin: o.approvedByAdmin }]),
  );

  const perfMap: Record<string, any> = {};

  for (const event of events) {
    const orgId = event.organizer?.userId;
    if (!orgId) continue;

    if (!perfMap[orgId]) {
      const orgInfo = organizerMap.get(orgId);
      perfMap[orgId] = {
        organizerName: orgInfo?.name || event.organizer?.name || 'Unknown',
        eventsCreated: 0,
        totalRegistrations: 0,
        totalMaxAttendees: 0,
        totalRegistered: 0,
        eventsByApprovedOrganizer: 0,
        eventsByUnapprovedOrganizer: 0,
      };
    }

    const p = perfMap[orgId];
    p.eventsCreated++;

    const orgInfo = organizerMap.get(orgId);
    if (orgInfo && orgInfo.approvedByAdmin) {
      p.eventsByApprovedOrganizer++;
    } else {
      p.eventsByUnapprovedOrganizer++;
    }

    const activeRegistrations = (event.registrations || []).filter(
      r => r.status === RegistrationStatus.REGISTERED || r.status === RegistrationStatus.ATTENDED,
    );
    p.totalRegistrations += activeRegistrations.length;
    p.totalRegistered += activeRegistrations.length;
    p.totalMaxAttendees += event.maxAttendees || 0;
  }

  return Object.entries(perfMap).map(([organizerId, p]) => ({
    organizerId,
    organizerName: p.organizerName,
    eventsCreated: p.eventsCreated,
    totalRegistrations: p.totalRegistrations,
    avgOccupancy: p.totalMaxAttendees > 0
      ? Math.round((p.totalRegistered / p.totalMaxAttendees) * 100)
      : 0,
    eventsByApprovedOrganizer: p.eventsByApprovedOrganizer,
    eventsByUnapprovedOrganizer: p.eventsByUnapprovedOrganizer,
  }));
}

function computeMonthlyTrends(events: any[]) {
  const buckets: Record<string, { registrations: number; events: Set<string> }> = {};

  for (const event of events) {
    const eventDate = event.date instanceof Date ? event.date : new Date(event.date as any);
    const monthKey = `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}`;

    if (!buckets[monthKey]) {
      buckets[monthKey] = { registrations: 0, events: new Set() };
    }

    buckets[monthKey].events.add(String(event._id));

    for (const reg of event.registrations || []) {
      if (reg.status === RegistrationStatus.REGISTERED || reg.status === RegistrationStatus.ATTENDED) {
        buckets[monthKey].registrations++;
      }
    }
  }

  return Object.entries(buckets)
    .map(([month, bucket]) => ({
      month,
      registrations: bucket.registrations,
      events: bucket.events.size,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

function computeFacultyByEventType(events: any[]) {
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

  return data;
}

export async function occupancyReport(req: Request, res: Response) {
  try {
    const report = await Event.aggregate(occupancyPipeline());

    if (req.query.format === 'csv') {
      sendCsv(res, 'occupancy.csv', report as Record<string, unknown>[]);
      return;
    }

    res.json({ data: report });
  } catch (e) {
    console.error('OccupancyReport error:', e);
    res.status(500).json({ message: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export async function engagementReport(req: Request, res: Response) {
  try {
    const events = await Event.find({
      'registrations.status': RegistrationStatus.REGISTERED,
    }).lean();

    const { facultyCount, programCount, campusCount, semesterCount, studentSet } = computeEngagementCounts(events);

    const byFaculty = sortEngagementCounts(facultyCount, 'faculty');
    const byProgram = sortEngagementCounts(programCount, 'program');
    const byCampus = sortEngagementCounts(campusCount, 'campus');
    const bySemester = sortEngagementCounts(semesterCount, 'semester');

    const payload = {
      data: { byFaculty, byProgram, byCampus, bySemester, totalUniqueStudents: studentSet.size },
    };

    if (req.query.format === 'csv') {
      const flat: Record<string, unknown>[] = [];
      for (const item of byFaculty) flat.push({ section: 'byFaculty', label: item.faculty, studentCount: item.studentCount });
      for (const item of byProgram) flat.push({ section: 'byProgram', label: item.program, studentCount: item.studentCount });
      for (const item of byCampus) flat.push({ section: 'byCampus', label: item.campus, studentCount: item.studentCount });
      for (const item of bySemester) flat.push({ section: 'bySemester', label: item.semester, studentCount: item.studentCount });
      sendCsv(res, 'engagement.csv', flat);
      return;
    }

    res.json(payload);
  } catch (e) {
    console.error('EngagementReport error:', e);
    res.status(500).json({ message: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export async function participationReport(req: Request, res: Response) {
  try {
    const [topStudentsResult, byEventTypeResult] = await Promise.all([
      Event.aggregate(topStudentsPipeline()),
      Event.aggregate(byEventTypePipeline()),
    ]);

    const payload = {
      data: { topStudents: topStudentsResult, byEventType: byEventTypeResult },
    };

    if (req.query.format === 'csv') {
      const flat: Record<string, unknown>[] = [];
      for (const s of topStudentsResult) flat.push({ section: 'topStudent', studentId: s.studentId, studentName: s.studentName, eventCount: s.eventCount });
      for (const e of byEventTypeResult) flat.push({ section: 'byEventType', studentId: '', studentName: e.eventType, eventCount: e.count });
      sendCsv(res, 'participation.csv', flat);
      return;
    }

    res.json(payload);
  } catch (e) {
    console.error('ParticipationReport error:', e);
    res.status(500).json({ message: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export async function organizerPerformance(req: Request, res: Response) {
  try {
    const months = Math.max(1, Math.min(36, parseInt(req.query.months as string) || 12));
    const data = await computeOrganizerPerformance(months);

    if (req.query.format === 'csv') {
      sendCsv(res, 'organizer-performance.csv', data as Record<string, unknown>[]);
      return;
    }

    res.json({ data });
  } catch (e) {
    console.error('OrganizerPerformance error:', e);
    res.status(500).json({ message: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export async function trendsReport(req: Request, res: Response) {
  try {
    const months = Math.max(1, Math.min(36, parseInt(req.query.months as string) || 12));
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);

    const events = await Event.find({ date: { $gte: cutoff } }).lean();
    const data = computeMonthlyTrends(events);

    if (req.query.format === 'csv') {
      sendCsv(res, 'trends.csv', data as Record<string, unknown>[]);
      return;
    }

    res.json({ data });
  } catch (e) {
    console.error('TrendsReport error:', e);
    res.status(500).json({ message: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export async function exportSummary(_req: Request, res: Response) {
  try {
    const DEFAULT_MONTHS = 12;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - DEFAULT_MONTHS);

    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.default.Workbook();

    const [
      statusGroups,
      pgAgg,
      uniqueStudents,
      organizerCount,
      occupancy,
      engEvents,
      topStudents,
      byEventType,
      orgPerf,
      facEvents,
      trendEvents,
    ] = await Promise.all([
      Event.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      pgPool.query(
        `SELECT SUM(total_registered)::int as "totalRegistrations",
                SUM(total_cancelled)::int as "totalCancellations",
                SUM(total_attended)::int as "totalAttendees"
         FROM public.uniplan_statistics`,
      ),
      Event.distinct('registrations.studentId'),
      Organizer.countDocuments(),
      Event.aggregate(occupancyPipeline()),
      Event.find({ date: { $gte: cutoff }, 'registrations.status': RegistrationStatus.REGISTERED }).lean(),
      Event.aggregate(topStudentsPipeline()),
      Event.aggregate(byEventTypePipeline()),
      computeOrganizerPerformance(DEFAULT_MONTHS),
      Event.find({ date: { $gte: cutoff } }).lean(),
      Event.find({ date: { $gte: cutoff } }).lean(),
    ]);

    // --- Sheet 1: Summary ---
    const pgRow = pgAgg.rows[0] || { totalRegistrations: 0, totalCancellations: 0, totalAttendees: 0 };
    const statusMap = new Map(statusGroups.map(g => [g._id, g.count]));
    const total = (statusMap.get(EventStatus.UPCOMING) || 0) + (statusMap.get(EventStatus.IN_PROGRESS) || 0) + (statusMap.get(EventStatus.FINISHED) || 0);

    const wsSummary = workbook.addWorksheet('Summary');
    wsSummary.addRows([
      ['Metric', 'Value'],
      ['Total Events', total],
      ['Active Events', (statusMap.get(EventStatus.UPCOMING) || 0) + (statusMap.get(EventStatus.IN_PROGRESS) || 0)],
      ['Finished Events', statusMap.get(EventStatus.FINISHED) || 0],
      ['Total Registrations', Number(pgRow.totalRegistrations)],
      ['Total Cancellations', Number(pgRow.totalCancellations)],
      ['Total Attendees', Number(pgRow.totalAttendees)],
      ['Total Unique Students', uniqueStudents.length],
      ['Total Organizers', organizerCount],
    ]);

    // --- Sheet 2: Faculty-EventType ---
    const facData = computeFacultyByEventType(facEvents);
    const wsFaculty = workbook.addWorksheet('Faculty-EventType');
    wsFaculty.addRow(['Event Type', 'Faculty', 'Count']);
    for (const [eventType, faculties] of Object.entries(facData)) {
      for (const { faculty, count } of faculties) {
        wsFaculty.addRow([eventType, faculty, count]);
      }
    }

    // --- Sheet 3: Occupancy ---
    const wsOccupancy = workbook.addWorksheet('Occupancy');
    wsOccupancy.addRow(['Event Type', 'Total Events', 'Avg Occupancy %']);
    for (const row of occupancy) {
      wsOccupancy.addRow([row.eventType, row.totalEvents, row.avgOccupancy]);
    }

    // --- Sheet 4: Engagement ---
    const { facultyCount, programCount, campusCount, semesterCount, studentSet } = computeEngagementCounts(engEvents);
    const wsEngagement = workbook.addWorksheet('Engagement');
    wsEngagement.addRow(['Section', 'Name', 'Student Count']);
    wsEngagement.addRow(['Overview', 'Unique Students', studentSet.size]);
    for (const [faculty, count] of Object.entries(facultyCount)) wsEngagement.addRow(['Faculty', faculty, count]);
    for (const [program, count] of Object.entries(programCount)) wsEngagement.addRow(['Program', program, count]);
    for (const [campus, count] of Object.entries(campusCount)) wsEngagement.addRow(['Campus', campus, count]);
    for (const [semester, count] of Object.entries(semesterCount)) wsEngagement.addRow(['Semester', semester, count]);

    // --- Sheet 5: Participation ---
    const wsParticipation = workbook.addWorksheet('Participation');
    wsParticipation.addRow(['Type', 'Identifier', 'Name', 'Count']);
    for (const s of topStudents) wsParticipation.addRow(['TopStudent', s.studentId, s.studentName, s.eventCount]);
    for (const e of byEventType) wsParticipation.addRow(['ByEventType', '', e.eventType, e.count]);

    // --- Sheet 6: Organizers ---
    const wsOrganizers = workbook.addWorksheet('Organizers');
    wsOrganizers.addRow(['Organizer ID', 'Name', 'Events Created', 'Total Registrations', 'Avg Occupancy %', 'Approved Events', 'Unapproved Events']);
    for (const p of orgPerf) {
      wsOrganizers.addRow([p.organizerId, p.organizerName, p.eventsCreated, p.totalRegistrations, p.avgOccupancy, p.eventsByApprovedOrganizer, p.eventsByUnapprovedOrganizer]);
    }

    // --- Sheet 7: Trends ---
    const trendData = computeMonthlyTrends(trendEvents);
    const wsTrends = workbook.addWorksheet('Trends');
    wsTrends.addRow(['Month', 'Registrations', 'Events']);
    for (const row of trendData) {
      wsTrends.addRow([row.month, row.registrations, row.events]);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=uniplan-summary.xlsx');
    res.send(Buffer.from(buffer));
  } catch (e) {
    console.error('ExportSummary error:', e);
    res.status(500).json({ message: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}
