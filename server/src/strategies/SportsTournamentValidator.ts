import { prisma } from '../app.js';
import { BaseValidator } from './BaseValidator.js';
import { ValidationResult } from './IRegistrationValidator.js';
import { RegistrationStatus } from '@uniplan/shared';

export class SportsTournamentValidator extends BaseValidator {
  protected async additionalChecks(studentId: string, eventId: number): Promise<ValidationResult> {
    // Get this event's time range
    const event = await prisma.$queryRawUnsafe<Array<{ date: string; start_time: string; end_time: string }>>(
      `SELECT date::text, start_time, end_time FROM public.uniplan_events WHERE id = $1`, eventId
    );
    if (!event || event.length === 0) return { valid: false, reason: 'Event not found' };
    const { date, start_time: thisStart, end_time: thisEnd } = event[0];

    // Check for time overlaps with other same-type events the student is registered for
    const conflicts = await prisma.$queryRawUnsafe<Array<{ title: string }>>(
      `SELECT e.title FROM public.uniplan_registrations r
       JOIN public.uniplan_events e ON r.event_id = e.id
       WHERE r.student_id = $1 AND r.status = 'REGISTERED'
       AND e.event_type = 'SPORTS_TOURNAMENT'
       AND e.date::text = $2
       AND e.id != $3
       AND (
         (e.start_time <= $4 AND e.end_time > $4) OR
         (e.start_time < $5 AND e.end_time >= $5) OR
         (e.start_time >= $4 AND e.end_time <= $5)
       )`,
       studentId, date, eventId, thisStart, thisEnd
    );
    if (conflicts && conflicts.length > 0) {
      return { valid: false, reason: `Schedule conflict with: ${conflicts[0].title}` };
    }

    return { valid: true };
  }
}
