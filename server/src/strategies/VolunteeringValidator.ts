import { BaseValidator } from './BaseValidator.js';
import { ValidationResult } from './IRegistrationValidator.js';
import { Event } from '../models/mongodb/index.js';
import { EventType, RegistrationStatus } from '@uniplan/shared';

export class VolunteeringValidator extends BaseValidator {
  protected async additionalChecks(studentId: string, eventId: string): Promise<ValidationResult> {
    const event = await Event.findById(eventId).lean() as any;
    if (!event) return { valid: false, reason: 'Event not found' };

    const typeDetails = event.typeDetails || {};
    const hoursRequired = typeDetails.hoursRequired;
    if (!hoursRequired) return { valid: true };

    const pastEvents = await Event.find({
      eventType: EventType.VOLUNTEERING,
      'registrations.studentId': studentId,
      'registrations.status': RegistrationStatus.REGISTERED,
    }).lean();

    let totalHours = 0;
    for (const e of pastEvents) {
      const td = e.typeDetails as any;
      if (td?.hoursRequired) {
        totalHours += Number(td.hoursRequired);
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
