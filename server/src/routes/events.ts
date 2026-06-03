import { Router } from 'express';
import { listEvents, getEvent, createEvent, updateEvent, duplicateEvent, deleteEvent } from '../controllers/eventController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Event } from '../models/mongodb/Event.js';

export const eventRoutes = Router();

eventRoutes.get('/', listEvents);
eventRoutes.get('/:id', getEvent);
eventRoutes.post('/', requireAuth, requireRole('ORGANIZER', 'ADMIN'), createEvent);
eventRoutes.put('/:id', requireAuth, requireRole('ORGANIZER', 'ADMIN'), updateEvent);
eventRoutes.post('/:id/duplicate', requireAuth, requireRole('ORGANIZER', 'ADMIN'), duplicateEvent);
eventRoutes.delete('/:id', requireAuth, requireRole('ORGANIZER', 'ADMIN'), deleteEvent);

eventRoutes.get('/:id/messages', requireAuth, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).lean();
    if (!event) {
      res.status(404).json({ message: 'Event not found', code: 'NOT_FOUND' });
      return;
    }

    const messages = (event.messages || []).map(msg => ({
      text: msg.text,
      sentAt: msg.sentAt,
      sentBy: msg.sentBy,
      senderName: msg.senderName,
    }));

    res.json({ data: messages });
  } catch (e) {
    console.error('Get messages error:', e);
    res.status(500).json({ message: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

eventRoutes.post('/:id/messages', requireAuth, requireRole('ORGANIZER', 'ADMIN'), async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string') {
      res.status(400).json({ message: 'Message text required', code: 'MISSING_FIELD' });
      return;
    }
    if (text.length > 5000) {
      res.status(400).json({ message: 'Message too long (max 5000 characters)', code: 'VALIDATION_ERROR' });
      return;
    }

    const event = await Event.findById(req.params.id);
    if (!event) {
      res.status(404).json({ message: 'Event not found', code: 'NOT_FOUND' });
      return;
    }

    const userId = req.user!.userId;
    let senderName = userId;
    try {
      const { prisma } = await import('../app.js');
      const students = await prisma.$queryRawUnsafe<Array<{ first_name: string; last_name: string }>>(
        `SELECT first_name, last_name FROM public.students WHERE id = $1`, userId,
      );
      if (students.length > 0) {
        senderName = `${students[0].first_name} ${students[0].last_name}`;
      } else {
        const employees = await prisma.$queryRawUnsafe<Array<{ first_name: string; last_name: string }>>(
          `SELECT first_name, last_name FROM public.employees WHERE id = $1`, userId,
        );
        if (employees.length > 0) {
          senderName = `${employees[0].first_name} ${employees[0].last_name}`;
        }
      }
    } catch {}

    event.messages.push({
      text,
      sentAt: new Date(),
      sentBy: userId,
      senderName,
    });
    await event.save();

    res.json({ message: 'Message sent' });
  } catch (e) {
    console.error('Send message error:', e);
    res.status(500).json({ message: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});
