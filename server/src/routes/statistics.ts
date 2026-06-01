import { Router } from 'express';
import { getEventStats, getAllStats } from '../controllers/statisticsController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const statisticsRoutes = Router();
statisticsRoutes.use(requireAuth);

statisticsRoutes.get('/events', requireRole('ADMIN', 'ORGANIZER'), getAllStats);
statisticsRoutes.get('/events/:id', getEventStats);
