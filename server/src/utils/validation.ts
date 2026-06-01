import { z } from 'zod';
import { EventType, OrganizerType } from '@uniplan/shared';

export const registerSchema = z.object({
  studentCode: z.string().regex(/^A00\d{6}$/, 'Student code must match A00XXXXXX format'),
  email: z.string().email('Valid institutional email required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const createEventSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().min(1),
  eventType: z.nativeEnum(EventType),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(
    (d) => new Date(d + 'T00:00:00') >= new Date(new Date().toDateString()),
    { message: 'Event date cannot be in the past' },
  ),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  location: z.string().min(1).max(100),
  maxAttendees: z.number().int().positive(),
  typeSpecificFields: z.record(z.unknown()).optional(),
});

export const updateEventSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().min(1).optional(),
  eventType: z.nativeEnum(EventType).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(
    (d) => new Date(d + 'T00:00:00') >= new Date(new Date().toDateString()),
    { message: 'Event date cannot be in the past' },
  ).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  location: z.string().min(1).max(100).optional(),
  maxAttendees: z.number().int().positive().optional(),
  typeSpecificFields: z.record(z.unknown()).optional(),
});

export const applyOrganizerSchema = z.object({
  organizerType: z.nativeEnum(OrganizerType),
  department: z.string().optional(),
  specialization: z.string().optional(),
  semester: z.number().int().min(1).max(12).optional(),
  studentGroup: z.string().optional(),
  adminArea: z.string().optional(),
  positionTitle: z.string().optional(),
});
