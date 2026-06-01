import { prisma } from '../app.js';
import { IRegistrationValidator, ValidationResult } from './IRegistrationValidator.js';
import { RegistrationStatus } from '@uniplan/shared';

export abstract class BaseValidator implements IRegistrationValidator {
  async validate(studentId: string, eventId: number): Promise<ValidationResult> {
    const spotCheck = await this.checkSpotsAvailable(eventId);
    if (!spotCheck.valid) return spotCheck;

    const registeredCheck = await this.checkNotAlreadyRegistered(studentId, eventId);
    if (!registeredCheck.valid) return registeredCheck;

    return this.additionalChecks(studentId, eventId);
  }

  protected async additionalChecks(_studentId: string, _eventId: number): Promise<ValidationResult> {
    return { valid: true };
  }

  protected async checkSpotsAvailable(eventId: number): Promise<ValidationResult> {
    const event = await prisma.$queryRawUnsafe<Array<{ max_attendees: number }>>(
      `SELECT max_attendees FROM public.uniplan_events WHERE id = $1`, eventId
    );
    if (!event || event.length === 0) return { valid: false, reason: 'Event not found' };

    const count = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*)::int FROM public.uniplan_registrations WHERE event_id = $1 AND status = $2`, eventId, RegistrationStatus.REGISTERED
    );
    const current = Number(count[0].count);
    if (current >= event[0].max_attendees) {
      return { valid: false, reason: 'No spots available' };
    }
    return { valid: true };
  }

  protected async checkNotAlreadyRegistered(studentId: string, eventId: number): Promise<ValidationResult> {
    const existing = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
      `SELECT id FROM public.uniplan_registrations WHERE student_id = $1 AND event_id = $2 AND status = $3`,
      studentId, eventId, RegistrationStatus.REGISTERED
    );
    if (existing && existing.length > 0) {
      return { valid: false, reason: 'Already registered for this event' };
    }
    return { valid: true };
  }
}
