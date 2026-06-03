import { Request, Response } from 'express';
import { Event } from '../models/mongodb/index.js';
import { RegistrationStatus } from '@uniplan/shared';

export async function occupancyReport(req: Request, res: Response) {
  try {
    const report = await Event.aggregate([
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
      { $sort: { avgOccupancy: -1 } },
      {
        $project: {
          eventType: '$_id',
          totalEvents: 1,
          avgOccupancy: { $round: ['$avgOccupancy', 1] },
          _id: 0,
        },
      },
    ]);

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

    const facultyCount: Record<string, number> = {};
    const programCount: Record<string, number> = {};
    const campusCount: Record<string, number> = {};
    const studentSet = new Set<string>();

    for (const event of events) {
      for (const reg of event.registrations || []) {
        if (reg.status === RegistrationStatus.REGISTERED) {
          studentSet.add(reg.studentId);
          if (reg.faculty) facultyCount[reg.faculty] = (facultyCount[reg.faculty] || 0) + 1;
          if (reg.program) programCount[reg.program] = (programCount[reg.program] || 0) + 1;
          if (reg.campus) campusCount[reg.campus] = (campusCount[reg.campus] || 0) + 1;
        }
      }
    }

    const byFaculty = Object.entries(facultyCount)
      .map(([faculty, count]) => ({ faculty, studentCount: count }))
      .sort((a, b) => b.studentCount - a.studentCount);

    const byProgram = Object.entries(programCount)
      .map(([program, count]) => ({ program, studentCount: count }))
      .sort((a, b) => b.studentCount - a.studentCount);

    const byCampus = Object.entries(campusCount)
      .map(([campus, count]) => ({ campus, studentCount: count }))
      .sort((a, b) => b.studentCount - a.studentCount);

    res.json({
      data: {
        byFaculty,
        byProgram,
        byCampus,
        bySemester: [],
        totalUniqueStudents: studentSet.size,
      },
    });
  } catch (e) {
    console.error('EngagementReport error:', e);
    res.status(500).json({ message: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export async function participationReport(req: Request, res: Response) {
  try {
    const byEventTypeResult = await Event.aggregate([
      { $unwind: '$registrations' },
      {
        $match: {
          'registrations.status': {
            $in: [RegistrationStatus.REGISTERED, RegistrationStatus.ATTENDED],
          },
        },
      },
      {
        $group: {
          _id: '$eventType',
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          eventType: '$_id',
          count: 1,
          _id: 0,
        },
      },
    ]);

    const topStudentsResult = await Event.aggregate([
      { $unwind: '$registrations' },
      {
        $match: {
          'registrations.status': {
            $in: [RegistrationStatus.REGISTERED, RegistrationStatus.ATTENDED],
          },
        },
      },
      {
        $group: {
          _id: {
            studentId: '$registrations.studentId',
            studentName: '$registrations.studentName',
          },
          eventCount: { $sum: 1 },
        },
      },
      { $sort: { eventCount: -1 } },
      { $limit: 10 },
      {
        $project: {
          studentId: '$_id.studentId',
          firstName: { $arrayElemAt: [{ $split: ['$_id.studentName', ' '] }, 0] },
          lastName: {
            $reduce: {
              input: { $slice: [{ $split: ['$_id.studentName', ' '] }, 1, { $size: { $split: ['$_id.studentName', ' '] } }] },
              initialValue: '',
              in: { $concat: ['$$value', { $cond: [{ $eq: ['$$value', ''] }, '', ' '] }, '$$this'] },
            },
          },
          email: '',
          eventCount: 1,
          _id: 0,
        },
      },
    ]);

    res.json({
      data: {
        topStudents: topStudentsResult,
        byEventType: byEventTypeResult,
      },
    });
  } catch (e) {
    console.error('ParticipationReport error:', e);
    res.status(500).json({ message: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}
