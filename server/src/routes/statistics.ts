import { Router } from 'express';
import { getEventStats, getAllStats, getDashboard, getFacultyByEventType } from '../controllers/statisticsController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const statisticsRoutes = Router();
statisticsRoutes.use(requireAuth);

statisticsRoutes.get('/events', requireRole('ADMIN', 'ORGANIZER'), getAllStats);
statisticsRoutes.get('/events/:id', getEventStats);
statisticsRoutes.get('/dashboard', requireRole('ADMIN', 'ORGANIZER'), getDashboard);
statisticsRoutes.get('/faculty-by-event-type', requireRole('ADMIN', 'ORGANIZER'), getFacultyByEventType);
