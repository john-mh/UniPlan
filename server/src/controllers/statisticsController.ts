import { Request, Response } from 'express';
import { prisma } from '../app.js';

export async function getEventStats(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const stats = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT * FROM public.uniplan_statistics WHERE event_id = $1`, id
    );
    if (!stats || stats.length === 0) {
      res.status(404).json({ message: 'Stats not found', code: 'NOT_FOUND' });
      return;
    }
    const event = await prisma.$queryRawUnsafe<Array<{ max_attendees: number }>>(
      `SELECT max_attendees FROM public.uniplan_events WHERE id = $1`, id
    );
    const occupancy = event[0] ? Math.round((stats[0].total_registered / event[0].max_attendees) * 100) : 0;
    res.json({ ...stats[0], occupancyPercentage: occupancy });
  } catch (e) {
    console.error('GetEventStats error:', e);
    res.status(500).json({ message: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export async function getAllStats(req: Request, res: Response) {
  try {
    const stats = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT e.id as "eventId", e.title as "eventTitle", e.event_type as "eventType",
              COALESCE(s.total_registered, 0) as "totalRegistered",
              COALESCE(s.total_cancelled, 0) as "totalCancelled",
              COALESCE(s.total_attended, 0) as "totalAttended",
              CASE WHEN e.max_attendees > 0 THEN ROUND(COALESCE(s.total_registered, 0)::numeric / e.max_attendees * 100, 1) ELSE 0 END as "occupancyPercentage"
       FROM public.uniplan_events e
       LEFT JOIN public.uniplan_statistics s ON e.id = s.event_id
       ORDER BY e.date DESC`
    );
    res.json({ data: stats });
  } catch (e) {
    console.error('GetAllStats error:', e);
    res.status(500).json({ message: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}
