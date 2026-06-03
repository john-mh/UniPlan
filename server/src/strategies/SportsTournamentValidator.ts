import { BaseValidator } from './BaseValidator.js';
import { ValidationResult } from './IRegistrationValidator.js';
import { Event } from '../models/mongodb/index.js';
import { RegistrationStatus, EventType } from '@uniplan/shared';

export class SportsTournamentValidator extends BaseValidator {
  protected async additionalChecks(studentId: string, eventId: string): Promise<ValidationResult> {
    const event = await Event.findById(eventId).lean();
    if (!event) return { valid: false, reason: 'Event not found' };

    const conflicts = await Event.find({
      eventType: EventType.SPORTS_TOURNAMENT,
      _id: { $ne: eventId },
      date: event.date,
      'registrations.studentId': studentId,
      'registrations.status': RegistrationStatus.REGISTERED,
      $or: [
        { startTime: { $lte: event.startTime }, endTime: { $gt: event.startTime } },
        { startTime: { $lt: event.endTime }, endTime: { $gte: event.endTime } },
        { startTime: { $gte: event.startTime }, endTime: { $lte: event.endTime } },
      ],
    }).lean();

    if (conflicts.length > 0) {
      return { valid: false, reason: `Schedule conflict with: ${conflicts[0].title}` };
    }

    return { valid: true };
  }
}
