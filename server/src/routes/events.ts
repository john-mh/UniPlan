import { Router } from 'express';
import { listEvents, getEvent, createEvent, updateEvent, duplicateEvent } from '../controllers/eventController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { EventDetail } from '../models/mongodb/EventDetail.js';
import { prisma } from '../app.js';

export const eventRoutes = Router();

eventRoutes.get('/', listEvents);
eventRoutes.get('/:id', getEvent);
eventRoutes.post('/', requireAuth, requireRole('ORGANIZER', 'ADMIN'), createEvent);
eventRoutes.put('/:id', requireAuth, requireRole('ORGANIZER', 'ADMIN'), updateEvent);
eventRoutes.post('/:id/duplicate', requireAuth, requireRole('ORGANIZER', 'ADMIN'), duplicateEvent);

// Messaging
eventRoutes.get('/:id/messages', requireAuth, async (req, res) => {
  try {
    const eventId = Number(req.params.id);
    if (isNaN(eventId)) {
      res.status(400).json({ message: 'Invalid event ID', code: 'INVALID_ID' });
      return;
    }
    const detail = await EventDetail.findOne({ eventId }).lean() as any;
    const messages = detail?.messages || [];

    const resolved = await Promise.all(messages.map(async (msg: any) => {
      let senderName = msg.sentBy;
      try {
        const students = await prisma.$queryRawUnsafe<Array<{ first_name: string; last_name: string }>>(
          `SELECT first_name, last_name FROM public.students WHERE id = $1`, msg.sentBy
        );
        if (students.length > 0) {
          senderName = `${students[0].first_name} ${students[0].last_name}`;
        } else {
          const employees = await prisma.$queryRawUnsafe<Array<{ first_name: string; last_name: string }>>(
            `SELECT first_name, last_name FROM public.employees WHERE id = $1`, msg.sentBy
          );
          if (employees.length > 0) {
            senderName = `${employees[0].first_name} ${employees[0].last_name}`;
          }
        }
      } catch {}
      return { ...msg, sentBy: msg.sentBy, senderName };
    }));

    res.json({ data: resolved });
  } catch (e) {
    console.error('Get messages error:', e);
    res.status(500).json({ message: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

eventRoutes.post('/:id/messages', requireAuth, requireRole('ORGANIZER', 'ADMIN'), async (req, res) => {
  try {
    const eventId = Number(req.params.id);
    if (isNaN(eventId)) {
      res.status(400).json({ message: 'Invalid event ID', code: 'INVALID_ID' });
      return;
    }
    const { text } = req.body;
    if (!text || typeof text !== 'string') {
      res.status(400).json({ message: 'Message text required', code: 'MISSING_FIELD' });
      return;
    }
    if (text.length > 5000) {
      res.status(400).json({ message: 'Message too long (max 5000 characters)', code: 'VALIDATION_ERROR' });
      return;
    }
    await EventDetail.findOneAndUpdate(
      { eventId },
      { $push: { messages: { text, sentAt: new Date(), sentBy: req.user!.userId } } },
      { upsert: true }
    );
    res.json({ message: 'Message sent' });
  } catch (e) {
    console.error('Send message error:', e);
    res.status(500).json({ message: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});
