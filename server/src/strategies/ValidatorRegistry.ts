import { IRegistrationValidator } from './IRegistrationValidator.js';
import { WorkshopValidator } from './WorkshopValidator.js';
import { TalkValidator } from './TalkValidator.js';
import { SportsTournamentValidator } from './SportsTournamentValidator.js';
import { VolunteeringValidator } from './VolunteeringValidator.js';

export class ValidatorRegistry {
  private static registry: Record<string, IRegistrationValidator> = {
    WORKSHOP: new WorkshopValidator(),
    TALK: new TalkValidator(),
    SPORTS_TOURNAMENT: new SportsTournamentValidator(),
    VOLUNTEERING: new VolunteeringValidator(),
    OTHER: new TalkValidator(), // Extends BaseValidator with no extra checks
  };

  static getValidator(eventType: string): IRegistrationValidator {
    return this.registry[eventType] || new TalkValidator();
  }
}
