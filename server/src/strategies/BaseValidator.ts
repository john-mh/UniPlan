import { Event } from '../models/mongodb/index.js';
import { IRegistrationValidator, ValidationResult } from './IRegistrationValidator.js';
import { RegistrationStatus } from '@uniplan/shared';

export abstract class BaseValidator implements IRegistrationValidator {
  async validate(studentId: string, eventId: string): Promise<ValidationResult> {
    const spotCheck = await this.checkSpotsAvailable(eventId);
    if (!spotCheck.valid) return spotCheck;

    const registeredCheck = await this.checkNotAlreadyRegistered(studentId, eventId);
    if (!registeredCheck.valid) return registeredCheck;

    return this.additionalChecks(studentId, eventId);
  }

  protected async additionalChecks(_studentId: string, _eventId: string): Promise<ValidationResult> {
    return { valid: true };
  }

  protected async checkSpotsAvailable(eventId: string): Promise<ValidationResult> {
    const event = await Event.findById(eventId).select('maxAttendees registrations').lean();
    if (!event) return { valid: false, reason: 'Event not found' };

    const current = event.registrations?.filter(r => r.status === RegistrationStatus.REGISTERED).length || 0;
    if (current >= event.maxAttendees) {
      return { valid: false, reason: 'No spots available' };
    }
    return { valid: true };
  }

  protected async checkNotAlreadyRegistered(studentId: string, eventId: string): Promise<ValidationResult> {
    const event = await Event.findOne({
      _id: eventId,
      'registrations.studentId': studentId,
      'registrations.status': RegistrationStatus.REGISTERED,
    }).lean();

    if (event) {
      return { valid: false, reason: 'Already registered for this event' };
    }
    return { valid: true };
  }
}
