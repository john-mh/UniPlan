import { prisma } from '../app.js';
import { BaseValidator } from './BaseValidator.js';
import { ValidationResult } from './IRegistrationValidator.js';
import { EventDetail } from '../models/mongodb/EventDetail.js';
import { EventType, RegistrationStatus } from '@uniplan/shared';

export class VolunteeringValidator extends BaseValidator {
  protected async additionalChecks(studentId: string, eventId: number): Promise<ValidationResult> {
    const detail = await EventDetail.findOne({ eventId, eventType: EventType.VOLUNTEERING }).lean() as any;
    const hoursRequired = detail?.hoursRequired;
    if (!hoursRequired) return { valid: true };

    const pastRegistrations = await prisma.$queryRawUnsafe<Array<{ event_id: number }>>(
      `SELECT r.event_id FROM public.uniplan_registrations r
       JOIN public.uniplan_events e ON r.event_id = e.id
       WHERE r.student_id = $1 AND r.status = $2 AND e.event_type = $3`,
      studentId, RegistrationStatus.REGISTERED, EventType.VOLUNTEERING
    );

    let totalHours = 0;
    for (const reg of pastRegistrations) {
      const volDetail = await EventDetail.findOne({ eventId: reg.event_id, eventType: EventType.VOLUNTEERING }).lean() as any;
      if (volDetail?.hoursRequired) {
        totalHours += Number(volDetail.hoursRequired);
      }
    }

    if (totalHours < hoursRequired) {
      return {
        valid: false,
        reason: `Requires ${hoursRequired} volunteering hours. You currently have ${totalHours} hours from past events.`,
      };
    }

    return { valid: true };
  }
}
