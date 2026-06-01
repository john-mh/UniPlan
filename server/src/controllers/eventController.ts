import { Request, Response } from 'express';
import { prisma } from '../app.js';
import { getEventDetailModel, EventDetail } from '../models/mongodb/EventDetail.js';
import { createEventSchema, updateEventSchema } from '../utils/validation.js';
import { handleZodError } from '../utils/handleZodError.js';

export async function listEvents(req: Request, res: Response) {
  try {
    const { type, status, from, to, search, organizerId, page = '1', limit = '12' } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: string[] = [];
    const params: (string | number)[] = [];
    let idx = 1;

    if (type && type !== 'ALL') {
      where.push(`e.event_type = $${idx++}`);
      params.push(String(type));
    }
    if (from) {
      where.push(`e.date >= $${idx++}`);
      params.push(String(from));
    }
    if (to) {
      where.push(`e.date <= $${idx++}`);
      params.push(String(to));
    }
    if (search) {
      where.push(`LOWER(e.title) LIKE $${idx++}`);
      params.push(`%${String(search).toLowerCase()}%`);
    }
    if (status && status !== 'ALL') {
      if (status === 'UPCOMING') where.push(`e.date > CURRENT_DATE`);
      else if (status === 'FINISHED') where.push(`e.date < CURRENT_DATE`);
      else if (status === 'IN_PROGRESS') where.push(`e.date = CURRENT_DATE`);
    }
    if (organizerId) {
      where.push(`(o.student_id = $${idx++} OR o.employee_id = $${idx++})`);
      params.push(String(organizerId), String(organizerId));
    }

    const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';
    const countResult = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*) FROM public.uniplan_events e ${whereClause}`,
      ...params,
    );
    const total = Number(countResult[0].count);

    const events = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`
    SELECT e.*, o.organizer_type, 
      COALESCE(s.first_name, emp.first_name) as first_name,
      COALESCE(s.last_name, emp.last_name) as last_name,
      COALESCE(reg.cnt, 0) as current_registrations
    FROM public.uniplan_events e
    JOIN public.uniplan_organizers o ON e.organizer_id = o.id
    LEFT JOIN public.students s ON o.student_id = s.id
    LEFT JOIN public.employees emp ON o.employee_id = emp.id
    LEFT JOIN (
      SELECT event_id, COUNT(*) as cnt FROM public.uniplan_registrations 
      WHERE status = 'REGISTERED' GROUP BY event_id
    ) reg ON reg.event_id = e.id
    ${whereClause}
    ORDER BY e.date ASC LIMIT $${idx} OFFSET $${idx + 1}
  `, ...params, Number(limit), skip);

    res.json({
      data: events.map(e => ({
        id: e.id,
        uniqueCode: e.unique_code,
        title: e.title,
        description: e.description,
        eventType: e.event_type,
        date: e.date,
        startTime: e.start_time,
        endTime: e.end_time,
        location: e.location,
        maxAttendees: e.max_attendees,
        currentRegistrations: Number(e.current_registrations),
        organizerName: `${e.first_name} ${e.last_name}`,
        status: computeStatus(e.date as string),
      })),
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    });
  } catch (e) {
    console.error('List events error:', e);
    res.status(500).json({ message: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export async function getEvent(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const events = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`
    SELECT e.*, o.organizer_type,
      COALESCE(s.first_name, emp.first_name) as first_name,
      COALESCE(s.last_name, emp.last_name) as last_name,
      COALESCE(reg.cnt, 0) as current_registrations
    FROM public.uniplan_events e
    JOIN public.uniplan_organizers o ON e.organizer_id = o.id
    LEFT JOIN public.students s ON o.student_id = s.id
    LEFT JOIN public.employees emp ON o.employee_id = emp.id
    LEFT JOIN (
      SELECT event_id, COUNT(*) as cnt FROM public.uniplan_registrations 
      WHERE status = 'REGISTERED' GROUP BY event_id
    ) reg ON reg.event_id = e.id
    WHERE e.id = $1
  `, id);

    if (!events || events.length === 0) {
      res.status(404).json({ message: 'Event not found', code: 'NOT_FOUND' });
      return;
    }

    const e = events[0];
    const detail = await EventDetail.findOne({ eventId: id }).lean();

    res.json({
      id: e.id,
      uniqueCode: e.unique_code,
      title: e.title,
      description: e.description,
      eventType: e.event_type,
      date: e.date,
      startTime: e.start_time,
      endTime: e.end_time,
      location: e.location,
      maxAttendees: e.max_attendees,
      currentRegistrations: Number(e.current_registrations),
      organizerId: e.organizer_id,
      organizerName: `${e.first_name} ${e.last_name}`,
      status: computeStatus(e.date as string),
      typeSpecificFields: detail || null,
    });
  } catch (e) {
    console.error('Get event error:', e);
    res.status(500).json({ message: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export async function createEvent(req: Request, res: Response) {
  try {
    const data = createEventSchema.parse(req.body);
    const organizer = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
      `SELECT id FROM public.uniplan_organizers WHERE (employee_id = $1 OR student_id = $1) AND is_active = true AND approved_by_admin = true`,
      req.user!.userId
    );
    if (!organizer || organizer.length === 0) {
      res.status(403).json({ message: 'Not an approved organizer', code: 'FORBIDDEN' });
      return;
    }

    const codeResult = await prisma.$queryRawUnsafe<Array<{ nextval: bigint }>>("SELECT nextval('public.uniplan_events_id_seq')");
    const seqId = Number(codeResult[0].nextval);
    const uniqueCode = `EVT-${String(seqId).padStart(3, '0')}`;

    const detailModel = getEventDetailModel(data.eventType);
    const detailDoc = await detailModel.create({
      eventId: seqId,
      eventType: data.eventType,
      ...(data.typeSpecificFields || {}),
    });

    await prisma.$executeRawUnsafe(
      `INSERT INTO public.uniplan_events (id, unique_code, title, description, event_type, date, start_time, end_time, location, max_attendees, organizer_id, mongodb_detail_id)
       VALUES ($1, $2, $3, $4, $5, $6::date, $7, $8, $9, $10, $11, $12)`,
      seqId, uniqueCode, data.title, data.description, data.eventType,
       data.date, data.startTime, data.endTime,
        data.location, data.maxAttendees, organizer[0].id, String(detailDoc._id)
    );

    await prisma.$executeRawUnsafe(
      `INSERT INTO public.uniplan_statistics (event_id, total_registered, total_cancelled, total_attended)
       VALUES ($1, 0, 0, 0)
       ON CONFLICT (event_id) DO NOTHING`, seqId
    );

    res.status(201).json({ id: seqId, uniqueCode });
  } catch (e) {
    if (handleZodError(e, res)) return;
    console.error('Create event error:', e);
    res.status(500).json({ message: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export async function updateEvent(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const event = await prisma.$queryRawUnsafe<Array<{ organizer_id: number; event_type: string }>>(
      `SELECT organizer_id, event_type FROM public.uniplan_events WHERE id = $1`, id
    );
    if (!event || event.length === 0) {
      res.status(404).json({ message: 'Event not found', code: 'NOT_FOUND' });
      return;
    }

    const orgCheck = await prisma.$queryRawUnsafe<Array<{ student_id: string | null; employee_id: string | null }>>(
      `SELECT student_id, employee_id FROM public.uniplan_organizers WHERE id = $1`,
      event[0].organizer_id
    );
    const currentUserId = req.user!.userId;
    if (orgCheck[0]?.student_id !== currentUserId && orgCheck[0]?.employee_id !== currentUserId) {
      res.status(403).json({ message: 'Not your event', code: 'FORBIDDEN' });
      return;
    }

    const data = updateEventSchema.parse(req.body);

    const fieldMap: Record<string, string> = {
      title: 'title', description: 'description', eventType: 'event_type',
      date: 'date', startTime: 'start_time', endTime: 'end_time',
      location: 'location', maxAttendees: 'max_attendees',
    };

    const sets: string[] = [];
    const values: unknown[] = [];
    let pIdx = 1;

    for (const [key, col] of Object.entries(fieldMap)) {
      if ((data as any)[key] !== undefined) {
        sets.push(`${col} = $${pIdx++}`);
        values.push((data as any)[key]);
      }
    }

    if (sets.length > 0) {
      sets.push(`updated_at = NOW()`);
      values.push(id);
      await prisma.$executeRawUnsafe(
        `UPDATE public.uniplan_events SET ${sets.join(', ')} WHERE id = $${pIdx}`,
        ...values,
      );
    }

    if (data.typeSpecificFields) {
      const detailModel = getEventDetailModel(data.eventType || event[0].event_type);
      await detailModel.findOneAndUpdate({ eventId: id }, data.typeSpecificFields, { upsert: true });
    }

    res.json({ message: 'Event updated' });
  } catch (e) {
    if (handleZodError(e, res)) return;
    console.error('Update event error:', e);
    res.status(500).json({ message: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export async function duplicateEvent(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const { newDate } = req.body;

    const [original, oldDetail] = await Promise.all([
      prisma.$queryRawUnsafe<Array<any>>(
        `SELECT * FROM public.uniplan_events WHERE id = $1`, id
      ),
      EventDetail.findOne({ eventId: id }).lean()
    ]);
    if (!original || original.length === 0) {
      res.status(404).json({ message: 'Event not found', code: 'NOT_FOUND' });
      return;
    }

    const o = original[0];
    const seqId = Number((await prisma.$queryRawUnsafe<Array<{ nextval: bigint }>>("SELECT nextval('public.uniplan_events_id_seq')"))[0].nextval);
    const uniqueCode = `EVT-${String(seqId).padStart(3, '0')}`;
    const newDetailData = { ...oldDetail, eventId: seqId } as any;
    delete newDetailData._id;
    delete newDetailData.__v;
    delete newDetailData.createdAt;
    delete newDetailData.updatedAt;

    const detailModel = getEventDetailModel(o.event_type);
    const newDetail = await detailModel.create(newDetailData);

    await prisma.$executeRawUnsafe(
      `INSERT INTO public.uniplan_events (id, unique_code, title, description, event_type, date, start_time, end_time, location, max_attendees, organizer_id, mongodb_detail_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      seqId, uniqueCode, o.title, o.description, o.event_type,
      newDate || o.date, o.start_time, o.end_time, o.location, o.max_attendees,
      o.organizer_id, String(newDetail._id)
    );

    await prisma.$executeRawUnsafe(
      `INSERT INTO public.uniplan_statistics (event_id) VALUES ($1)`, seqId
    );

    res.status(201).json({ id: seqId, uniqueCode });
  } catch (e) {
    console.error('Duplicate event error:', e);
    res.status(500).json({ message: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

function computeStatus(date: unknown): string {
  const today = new Date(new Date().toDateString());
  let eventDate: Date;
  if (date instanceof Date) {
    eventDate = date;
  } else {
    eventDate = new Date(String(date) + 'T00:00:00');
  }
  if (isNaN(eventDate.getTime())) return 'UPCOMING';
  if (eventDate > today) return 'UPCOMING';
  if (eventDate < today) return 'FINISHED';
  return 'IN_PROGRESS';
}
