import { Request, Response } from 'express';
import { Event, Organizer } from '../models/mongodb/index.js';
import { createEventSchema, updateEventSchema } from '../utils/validation.js';
import { handleZodError } from '../utils/handleZodError.js';
import { prisma } from '../app.js';

async function generateUniqueCode(): Promise<string> {
  const lastEvent = await Event.findOne().sort({ uniqueCode: -1 }).select('uniqueCode').lean();
  let nextNum = 1;
  if (lastEvent?.uniqueCode) {
    const match = lastEvent.uniqueCode.match(/EVT-(\d+)/);
    if (match) nextNum = parseInt(match[1]) + 1;
  }
  return `EVT-${String(nextNum).padStart(3, '0')}`;
}

export async function listEvents(req: Request, res: Response) {
  try {
    const { type, status, from, to, search, organizerId, page = '1', limit = '12' } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const filter: Record<string, unknown> = {};

    if (type && type !== 'ALL') {
      filter.eventType = String(type);
    }
    if (from || to) {
      filter.date = {};
      if (from) (filter.date as Record<string, unknown>).$gte = new Date(String(from) + 'T00:00:00');
      if (to) (filter.date as Record<string, unknown>).$lte = new Date(String(to) + 'T00:00:00');
    }
    if (search) {
      filter.title = { $regex: String(search), $options: 'i' };
    }
    if (status && status !== 'ALL') {
      const today = new Date(new Date().toDateString());
      if (status === 'UPCOMING') filter.date = { ...(filter.date as object || {}), $gt: today };
      else if (status === 'FINISHED') filter.date = { ...(filter.date as object || {}), $lt: today };
      else if (status === 'IN_PROGRESS') filter.date = today;
    }
    if (organizerId) {
      filter['organizer.userId'] = String(organizerId);
    }

    const [events, total] = await Promise.all([
      Event.find(filter)
        .sort({ date: 1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Event.countDocuments(filter),
    ]);

    res.json({
      data: events.map(e => ({
        id: e._id,
        uniqueCode: e.uniqueCode,
        title: e.title,
        description: e.description,
        eventType: e.eventType,
        date: e.date,
        startTime: e.startTime,
        endTime: e.endTime,
        location: e.location,
        maxAttendees: e.maxAttendees,
        currentRegistrations: e.registrations?.filter(r => r.status === 'REGISTERED').length || 0,
        organizerName: e.organizer?.name || '',
        status: computeStatus(e.date),
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
    const event = await Event.findById(req.params.id).lean();

    if (!event) {
      res.status(404).json({ message: 'Event not found', code: 'NOT_FOUND' });
      return;
    }

    const typeFields = extractTypeFields(event);

    res.json({
      id: event._id,
      uniqueCode: event.uniqueCode,
      title: event.title,
      description: event.description,
      eventType: event.eventType,
      date: event.date,
      startTime: event.startTime,
      endTime: event.endTime,
      location: event.location,
      maxAttendees: event.maxAttendees,
      currentRegistrations: event.registrations?.filter(r => r.status === 'REGISTERED').length || 0,
      organizerId: event.organizer?.userId,
      organizerName: event.organizer?.name,
      status: computeStatus(event.date),
      typeSpecificFields: typeFields,
      messages: event.messages || [],
      registrations: event.registrations || [],
    });
  } catch (e) {
    console.error('Get event error:', e);
    res.status(500).json({ message: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export async function createEvent(req: Request, res: Response) {
  try {
    const data = createEventSchema.parse(req.body);
    const userId = req.user!.userId;

    const organizer = await Organizer.findOne({
      userId,
      isActive: true,
      approvedByAdmin: true,
    }).lean();

    let organizerData: { userId: string; name: string; type: string };

    if (organizer) {
      organizerData = { userId: organizer.userId, name: organizer.name, type: organizer.type };
    } else {
      const userRow = await prisma.$queryRawUnsafe<Array<{ role: string }>>(
        `SELECT role FROM public.users WHERE (student_id = $1 OR employee_id = $1) AND is_active = true`, userId
      );
      if (!userRow || userRow.length === 0 || userRow[0].role !== 'ADMIN') {
        res.status(403).json({ message: 'Not an approved organizer', code: 'FORBIDDEN' });
        return;
      }
      const nameRow = await prisma.$queryRawUnsafe<Array<{ first_name: string; last_name: string }>>(
        `SELECT first_name, last_name FROM public.students WHERE id = $1
         UNION ALL
         SELECT first_name, last_name FROM public.employees WHERE id = $1
         LIMIT 1`, userId
      );
      const name = nameRow?.[0] ? `${nameRow[0].first_name} ${nameRow[0].last_name}` : userId;
      organizerData = { userId, name, type: 'BIENESTAR_STAFF' };
    }

    const uniqueCode = await generateUniqueCode();

    const eventData: Record<string, unknown> = {
      uniqueCode,
      title: data.title,
      description: data.description,
      eventType: data.eventType,
      date: new Date(data.date + 'T00:00:00'),
      startTime: data.startTime,
      endTime: data.endTime,
      location: data.location,
      maxAttendees: data.maxAttendees,
      organizer: organizerData,
      typeDetails: data.typeSpecificFields || {},
      registrations: [],
      messages: [],
    };

    const event = await Event.create(eventData);

    await prisma.$executeRawUnsafe(
      `INSERT INTO public.uniplan_statistics (event_id, total_registered, total_cancelled, total_attended, demographics)
       VALUES ($1, 0, 0, 0, $2)
       ON CONFLICT (event_id) DO NOTHING`,
      String(event._id),
      JSON.stringify({ by_faculty: {}, by_program: {}, by_campus: {} }),
    );

    res.status(201).json({ id: String(event._id), uniqueCode });
  } catch (e) {
    if (handleZodError(e, res)) return;
    console.error('Create event error:', e);
    res.status(500).json({ message: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export async function updateEvent(req: Request, res: Response) {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      res.status(404).json({ message: 'Event not found', code: 'NOT_FOUND' });
      return;
    }

    if (event.organizer.userId !== req.user!.userId) {
      res.status(403).json({ message: 'Not your event', code: 'FORBIDDEN' });
      return;
    }

    const data = updateEventSchema.parse(req.body);

    const updateData: Record<string, unknown> = {};

    const allowedFields = ['title', 'description', 'eventType', 'startTime', 'endTime', 'location', 'maxAttendees'];
    for (const field of allowedFields) {
      if ((data as any)[field] !== undefined) {
        updateData[field] = (data as any)[field];
      }
    }

    if (data.date !== undefined) {
      updateData.date = new Date(data.date + 'T00:00:00');
    }

    if (data.typeSpecificFields) {
      updateData.typeDetails = { ...event.typeDetails, ...data.typeSpecificFields };
    }

    if (Object.keys(updateData).length > 0) {
      await Event.findByIdAndUpdate(req.params.id, updateData);
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
    const { newDate } = req.body;
    const original = await Event.findById(req.params.id).lean();

    if (!original) {
      res.status(404).json({ message: 'Event not found', code: 'NOT_FOUND' });
      return;
    }

    const uniqueCode = await generateUniqueCode();

    const newEvent = await Event.create({
      uniqueCode,
      title: original.title,
      description: original.description,
      eventType: original.eventType,
      date: newDate ? new Date(newDate + 'T00:00:00') : original.date,
      startTime: original.startTime,
      endTime: original.endTime,
      location: original.location,
      maxAttendees: original.maxAttendees,
      organizer: original.organizer,
      typeDetails: original.typeDetails,
      registrations: [],
      messages: [],
    });

    await prisma.$executeRawUnsafe(
      `INSERT INTO public.uniplan_statistics (event_id, total_registered, total_cancelled, total_attended, demographics)
       VALUES ($1, 0, 0, 0, $2)`,
      String(newEvent._id),
      JSON.stringify({ by_faculty: {}, by_program: {}, by_campus: {} }),
    );

    res.status(201).json({ id: String(newEvent._id), uniqueCode });
  } catch (e) {
    console.error('Duplicate event error:', e);
    res.status(500).json({ message: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export async function deleteEvent(req: Request, res: Response) {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);
    if (!event) {
      res.status(404).json({ message: 'Event not found', code: 'NOT_FOUND' });
      return;
    }

    await prisma.$executeRawUnsafe(
      `DELETE FROM public.uniplan_statistics WHERE event_id = $1`, String(event._id)
    );

    res.json({ message: 'Event deleted', id: String(event._id) });
  } catch (e) {
    console.error('Delete event error:', e);
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

const TYPE_SPECIFIC_FIELDS: Record<string, string[]> = {
  WORKSHOP: ['materials', 'prerequisiteSubjectCode', 'prerequisiteSemester'],
  TALK: ['speakerName', 'speakerProfile', 'speakerAffiliation', 'relatedLinks', 'extendedDescription'],
  SPORTS_TOURNAMENT: ['sportType', 'rules', 'playersPerTeam', 'tournamentStructure'],
  VOLUNTEERING: ['cause', 'hoursRequired', 'activities', 'meetingPoints', 'responsiblePersons'],
  OTHER: ['additionalInfo'],
};

function extractTypeFields(event: Record<string, unknown>): Record<string, unknown> {
  const type = event.eventType as string;
  const knownFields = TYPE_SPECIFIC_FIELDS[type] || [];
  const typeDetails = (event.typeDetails as Record<string, unknown>) || {};
  const result: Record<string, unknown> = {};

  for (const field of knownFields) {
    if (field in typeDetails) {
      result[field] = typeDetails[field];
    } else if (field in event) {
      result[field] = event[field];
    }
  }

  return result;
}
