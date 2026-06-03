import { Request, Response } from 'express';
import { Event } from '../models/mongodb/index.js';
import { ValidatorRegistry } from '../strategies/ValidatorRegistry.js';
import { RegistrationStatus } from '@uniplan/shared';
import { emitRegistrationEvent, EventTopic } from '../observers/EventBus.js';

export async function registerForEvent(req: Request, res: Response) {
  try {
    const { eventId } = req.body;
    const studentId = req.user!.userId;

    if (!eventId) {
      res.status(400).json({ message: 'eventId is required', code: 'MISSING_FIELD' });
      return;
    }

    const event = await Event.findById(eventId).select('eventType maxAttendees registrations').lean();
    if (!event) {
      res.status(400).json({ message: 'Event not found', code: 'NOT_FOUND' });
      return;
    }

    const validator = ValidatorRegistry.getValidator(event.eventType);
    const result = await validator.validate(studentId, eventId);

    if (!result.valid) {
      res.status(400).json({ message: result.reason || 'Validation failed', code: 'VALIDATION_FAILED' });
      return;
    }

    const studentInfo = await resolveStudentInfo(studentId);
    if (!studentInfo) {
      res.status(400).json({ message: 'Could not resolve student profile', code: 'VALIDATION_FAILED' });
      return;
    }

    const updateResult = await Event.findOneAndUpdate(
      {
        _id: eventId,
        'registrations.studentId': { $ne: studentId },
      },
      {
        $push: {
          registrations: {
            studentId,
            studentName: studentInfo.name,
            faculty: studentInfo.faculty,
            program: studentInfo.program,
            campus: studentInfo.campus,
            registrationDate: new Date(),
            status: RegistrationStatus.REGISTERED,
          },
        },
      },
      { new: false },
    );

    if (!updateResult) {
      const alreadyReg = await Event.findOne({
        _id: eventId,
        'registrations.studentId': studentId,
        'registrations.status': RegistrationStatus.REGISTERED,
      });
      if (alreadyReg) {
        res.status(409).json({ message: 'Already registered', code: 'DUPLICATE_REGISTRATION' });
        return;
      }
      res.status(400).json({ message: 'Registration failed', code: 'VALIDATION_FAILED' });
      return;
    }

    emitRegistrationEvent(EventTopic.REGISTRATION_CREATED, {
      studentId,
      eventId,
      newStatus: RegistrationStatus.REGISTERED,
    });

    res.status(201).json({ message: 'Registration successful' });
  } catch (e) {
    console.error('Register error:', e);
    res.status(500).json({ message: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export async function cancelRegistration(req: Request, res: Response) {
  try {
    const registrationId = req.params.id;

    const event = await Event.findOne({
      'registrations._id': registrationId,
    });

    if (!event) {
      res.status(404).json({ message: 'Registration not found', code: 'NOT_FOUND' });
      return;
    }

    const reg = event.registrations.find(
      r => r._id && r._id.toString() === registrationId,
    );
    if (!reg) {
      res.status(404).json({ message: 'Registration not found', code: 'NOT_FOUND' });
      return;
    }

    if (reg.studentId !== req.user!.userId) {
      res.status(403).json({ message: 'Not your registration', code: 'FORBIDDEN' });
      return;
    }

    await Event.updateOne(
      { _id: event._id, 'registrations._id': reg._id },
      {
        $set: {
          'registrations.$.status': RegistrationStatus.CANCELLED,
          'registrations.$.cancellationDate': new Date(),
        },
      },
    );

    emitRegistrationEvent(EventTopic.REGISTRATION_CANCELLED, {
      studentId: reg.studentId,
      eventId: String(event._id),
      newStatus: RegistrationStatus.CANCELLED,
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

    const events = await Event.find({
      'registrations.studentId': studentId,
    }).lean();

    const registrations = events.flatMap(e =>
      e.registrations
        .filter(r => r.studentId === studentId)
        .map(r => ({
          id: r._id,
          studentId: r.studentId,
          eventId: e._id,
          status: r.status,
          registrationDate: r.registrationDate,
          cancellationDate: r.cancellationDate,
          eventTitle: e.title,
          eventType: e.eventType,
          eventDate: e.date instanceof Date ? e.date.toISOString().split('T')[0] : '',
        })),
    );

    registrations.sort((a, b) => {
      const da = a.eventDate || '';
      const db = b.eventDate || '';
      return da.localeCompare(db);
    });

    res.json({ data: registrations });
  } catch (e) {
    console.error('MyRegistrations error:', e);
    res.status(500).json({ message: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export async function eventRegistrations(req: Request, res: Response) {
  try {
    const event = await Event.findById(req.params.eventId).lean();
    if (!event) {
      res.status(404).json({ message: 'Event not found', code: 'NOT_FOUND' });
      return;
    }

    const registrations = event.registrations.map(r => ({
      id: r._id,
      studentId: r.studentId,
      studentName: r.studentName,
      faculty: r.faculty,
      program: r.program,
      campus: r.campus,
      status: r.status,
      registrationDate: r.registrationDate,
      cancellationDate: r.cancellationDate,
    }));

    registrations.sort((a, b) => {
      const da = a.registrationDate ? new Date(a.registrationDate).getTime() : 0;
      const db = b.registrationDate ? new Date(b.registrationDate).getTime() : 0;
      return db - da;
    });

    res.json({ data: registrations });
  } catch (e) {
    console.error('EventRegistrations error:', e);
    res.status(500).json({ message: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export async function exportCsv(req: Request, res: Response) {
  try {
    const event = await Event.findById(req.params.eventId).lean();
    if (!event) {
      res.status(404).json({ message: 'Event not found', code: 'NOT_FOUND' });
      return;
    }

    const regs = event.registrations.sort((a, b) => {
      const da = a.registrationDate ? new Date(a.registrationDate).getTime() : 0;
      const db = b.registrationDate ? new Date(b.registrationDate).getTime() : 0;
      return db - da;
    });

    const csv = ['Name,Student Code,Faculty,Program,Campus,Date,Status']
      .concat(regs.map(r =>
        `"${r.studentName}","${r.studentId}","${r.faculty}","${r.program}","${r.campus}","${r.registrationDate ? new Date(r.registrationDate).toISOString().split('T')[0] : ''}","${r.status}"`,
      ))
      .join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=inscriptions-${req.params.eventId}.csv`);
    res.send(csv);
  } catch (e) {
    console.error('ExportCsv error:', e);
    res.status(500).json({ message: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

async function resolveStudentInfo(studentId: string) {
  if (typeof studentId !== 'string' || studentId.length < 3) return null;

  const { prisma } = await import('../app.js');
  const results = await prisma.$queryRawUnsafe<Array<{
    first_name: string;
    last_name: string;
    campus_name: string;
  }>>(
    `SELECT s.first_name, s.last_name,
            c.name as campus_name
     FROM public.students s
     LEFT JOIN public.campuses c ON s.campus_code = c.code
     WHERE s.id = $1`,
    studentId,
  );

  if (results.length === 0) return null;

  const r = results[0];
  return {
    name: `${r.first_name} ${r.last_name}`,
    faculty: 'Unknown',
    program: 'Unknown',
    campus: r.campus_name || 'Unknown',
  };
}
