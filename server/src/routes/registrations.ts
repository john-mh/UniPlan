import { Router } from 'express';
import { registerForEvent, cancelRegistration, myRegistrations, eventRegistrations, exportCsv } from '../controllers/registrationController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const registrationRoutes = Router();

registrationRoutes.post('/', requireAuth, requireRole('STUDENT'), registerForEvent);
registrationRoutes.delete('/:id', requireAuth, cancelRegistration);
registrationRoutes.get('/mine', requireAuth, myRegistrations);
registrationRoutes.get('/event/:eventId', requireAuth, eventRegistrations);
registrationRoutes.get('/event/:eventId/csv', requireAuth, exportCsv);
