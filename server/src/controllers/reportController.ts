import { Request, Response } from 'express';
import { prisma } from '../app.js';
import { RegistrationStatus } from '@uniplan/shared';

export async function occupancyReport(req: Request, res: Response) {
  try {
    const report = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT e.event_type as "eventType", COUNT(*)::int as "totalEvents",
              ROUND(AVG(CASE WHEN e.max_attendees > 0 THEN COALESCE(s.total_registered, 0)::numeric / e.max_attendees * 100 ELSE 0 END), 1) as "avgOccupancy"
       FROM public.uniplan_events e
       LEFT JOIN public.uniplan_statistics s ON e.id = s.event_id
       GROUP BY e.event_type
       ORDER BY "avgOccupancy" DESC`
    );
    res.json({ data: report });
  } catch (e) {
    console.error('OccupancyReport error:', e);
    res.status(500).json({ message: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export async function engagementReport(req: Request, res: Response) {
  try {
    const bySemester = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT g.semester, COUNT(DISTINCT r.student_id)::int as "studentCount"
       FROM public.uniplan_registrations r
       JOIN public.enrollments e ON r.student_id = e.student_id
       JOIN public.groups g ON e.nrc = g.nrc
       WHERE r.status = $1 AND e.status = 'Active'
       GROUP BY g.semester
       ORDER BY g.semester`,
       RegistrationStatus.REGISTERED
    );

    const byFaculty = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT fa.name as faculty, COUNT(DISTINCT r.student_id)::int as "studentCount"
       FROM public.uniplan_registrations r
       JOIN public.enrollments enr ON r.student_id = enr.student_id AND enr.status = 'Active'
       JOIN public.groups g ON enr.nrc = g.nrc
       JOIN public.subjects sub ON g.subject_code = sub.code
       JOIN public.programs p ON sub.program_code = p.code
       JOIN public.areas a ON p.area_code = a.code
       JOIN public.faculties fa ON a.faculty_code = fa.code
       WHERE r.status = $1
       GROUP BY fa.name
       ORDER BY "studentCount" DESC`,
      RegistrationStatus.REGISTERED
    );

    res.json({ data: { bySemester, byFaculty } });
  } catch (e) {
    console.error('EngagementReport error:', e);
    res.status(500).json({ message: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export async function participationReport(req: Request, res: Response) {
  try {
    const topStudents = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT s.id as "studentId", s.first_name as "firstName", s.last_name as "lastName",
              s.email, COUNT(r.id)::int as "eventCount"
       FROM public.students s
       JOIN public.uniplan_registrations r ON s.id = r.student_id
       WHERE r.status IN ($1, $2)
       GROUP BY s.id, s.first_name, s.last_name, s.email
       ORDER BY "eventCount" DESC
       LIMIT 10`,
       RegistrationStatus.REGISTERED, RegistrationStatus.ATTENDED
    );

    const byEventType = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT e.event_type as "eventType", COUNT(r.id)::int as "count"
       FROM public.uniplan_registrations r
       JOIN public.uniplan_events e ON r.event_id = e.id
       WHERE r.status IN ($1, $2)
       GROUP BY e.event_type`,
       RegistrationStatus.REGISTERED, RegistrationStatus.ATTENDED
    );

    res.json({ data: { topStudents, byEventType } });
  } catch (e) {
    console.error('ParticipationReport error:', e);
    res.status(500).json({ message: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}
