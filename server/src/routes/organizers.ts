import { Router } from 'express';
import { applyAsOrganizer, getOrganizer } from '../controllers/organizerController.js';
import { requireAuth } from '../middleware/auth.js';

export const organizerRoutes = Router();

organizerRoutes.post('/apply', requireAuth, applyAsOrganizer);
organizerRoutes.get('/:id', requireAuth, getOrganizer);
