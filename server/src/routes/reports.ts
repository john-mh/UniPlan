import { Router } from 'express';
import { occupancyReport, participationReport, engagementReport, organizerPerformance, trendsReport, exportSummary } from '../controllers/reportController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const reportRoutes = Router();
reportRoutes.use(requireAuth, requireRole('ADMIN'));

reportRoutes.get('/occupancy', occupancyReport);
reportRoutes.get('/participation', participationReport);
reportRoutes.get('/engagement', engagementReport);
reportRoutes.get('/organizer-performance', organizerPerformance);
reportRoutes.get('/trends', trendsReport);
reportRoutes.get('/export/summary', exportSummary);
