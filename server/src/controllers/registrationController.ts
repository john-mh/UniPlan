import { Request, Response } from 'express';
import { prisma } from '../app.js';
import { ValidatorRegistry } from '../strategies/ValidatorRegistry.js';
import { RegistrationStatus } from '@uniplan/shared';
import { emitRegistrationEvent, EventTopic } from '../observers/EventBus.js';

async function getEventType(eventId: number): Promise<string> {
  const result = await prisma.$queryRawUnsafe<Array<{ event_type: string }>>(
    `SELECT event_type FROM public.uniplan_events WHERE id = $1`, eventId
  );
  return result[0]?.event_type || 'OTHER';
}

export async function registerForEvent(req: Request, res: Response) {
  try {
    const { eventId } = req.body;
    const studentId = req.user!.userId;

    if (!eventId) {
      res.status(400).json({ message: 'eventId is required', code: 'MISSING_FIELD' });
      return;
    }

    const eventType = await getEventType(eventId);
    const validator = ValidatorRegistry.getValidator(eventType);
    const result = await validator.validate(studentId, eventId);

    if (!result.valid) {
      res.status(400).json({ message: result.reason || 'Validation failed', code: 'VALIDATION_FAILED' });
      return;
    }

    await prisma.$executeRawUnsafe(
      `INSERT INTO public.uniplan_registrations (student_id, event_id, status) VALUES ($1, $2, $3)`,
      studentId, eventId, RegistrationStatus.REGISTERED
    );

    emitRegistrationEvent(EventTopic.REGISTRATION_CREATED, { studentId, eventId, newStatus: RegistrationStatus.REGISTERED });

    res.status(201).json({ message: 'Registration successful' });
  } catch (e: any) {
    if (e?.code === '23505' || e?.code === 'P2010') {
      res.status(409).json({ message: 'Already registered', code: 'DUPLICATE_REGISTRATION' });
      return;
    }
    console.error('Register error:', e);
    res.status(500).json({ message: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export async function cancelRegistration(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);

    const reg = await prisma.$queryRawUnsafe<Array<{ student_id: string; event_id: number; status: string }>>(
      `SELECT student_id, event_id, status FROM public.uniplan_registrations WHERE id = $1`, id
    );
    if (!reg || reg.length === 0) {
      res.status(404).json({ message: 'Registration not found', code: 'NOT_FOUND' });
      return;
    }

    if (reg[0].student_id !== req.user!.userId) {
      res.status(403).json({ message: 'Not your registration', code: 'FORBIDDEN' });
      return;
    }

    await prisma.$executeRawUnsafe(
      `UPDATE public.uniplan_registrations SET status = $1, cancellation_date = NOW() WHERE id = $2`,
      RegistrationStatus.CANCELLED, id
    );

    emitRegistrationEvent(EventTopic.REGISTRATION_CANCELLED, {
      studentId: reg[0].student_id, eventId: reg[0].event_id, newStatus: RegistrationStatus.CANCELLED,
    });

    res.json({ message: 'Registration cancelled' });
  } catch (e) {
    console.error('Cancel registration error:', e);
    res.status(500).json({ message: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export async function myRegistrations(req: Request, res: Response) {
  try {
    const studentId = req.user!.userId;
    const registrations = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT r.id, r.student_id as "studentId", r.event_id as "eventId", r.status,
              r.registration_date as "registrationDate", r.cancellation_date as "cancellationDate",
              e.title as "eventTitle", e.event_type as "eventType", e.date::text as "eventDate"
       FROM public.uniplan_registrations r
       JOIN public.uniplan_events e ON r.event_id = e.id
       WHERE r.student_id = $1
       ORDER BY e.date ASC`,
      studentId
    );
    res.json({ data: registrations });
  } catch (e) {
    console.error('MyRegistrations error:', e);
    res.status(500).json({ message: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export async function eventRegistrations(req: Request, res: Response) {
  try {
    const eventId = Number(req.params.eventId);

    const event = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT organizer_id FROM public.uniplan_events WHERE id = $1`, eventId
    );
    if (!event || event.length === 0) {
      res.status(404).json({ message: 'Event not found', code: 'NOT_FOUND' });
      return;
    }

    const registrations = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT r.id, r.student_id as "studentId", r.status,
              r.registration_date as "registrationDate",
              s.first_name as "firstName", s.last_name as "lastName", s.email
       FROM public.uniplan_registrations r
       JOIN public.students s ON r.student_id = s.id
       WHERE r.event_id = $1
       ORDER BY r.registration_date DESC`,
      eventId
    );
    res.json({ data: registrations });
  } catch (e) {
    console.error('EventRegistrations error:', e);
    res.status(500).json({ message: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export async function exportCsv(req: Request, res: Response) {
  try {
    const eventId = Number(req.params.eventId);

    const registrations = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT s.first_name as "firstName", s.last_name as "lastName", s.id as "studentCode",
              s.email, r.registration_date::text as "registrationDate", r.status
       FROM public.uniplan_registrations r
       JOIN public.students s ON r.student_id = s.id
       WHERE r.event_id = $1
       ORDER BY r.registration_date DESC`,
      eventId
    );

    const csv = ['Name,Student Code,Email,Date,Status']
      .concat(registrations.map(r =>
        `"${r.firstName} ${r.lastName}","${r.studentCode}","${r.email}","${r.registrationDate}","${r.status}"`
      ))
      .join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=inscriptions-${eventId}.csv`);
    res.send(csv);
  } catch (e) {
    console.error('ExportCsv error:', e);
    res.status(500).json({ message: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}
