import { Router } from 'express';
import { listOrganizers, approveOrganizer, rejectOrganizer } from '../controllers/adminController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const adminRoutes = Router();
adminRoutes.use(requireAuth, requireRole('ADMIN'));

adminRoutes.get('/organizers', listOrganizers);
adminRoutes.post('/organizers/:id/approve', approveOrganizer);
adminRoutes.post('/organizers/:id/reject', rejectOrganizer);
