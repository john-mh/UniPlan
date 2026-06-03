import { EventEmitter } from 'events';

export enum EventTopic {
  REGISTRATION_CREATED = 'registration:created',
  REGISTRATION_CANCELLED = 'registration:cancelled',
  REGISTRATION_STATUS_CHANGED = 'registration:status_changed',
}

export interface RegistrationEvent {
  studentId: string;
  eventId: string;
  previousStatus?: string;
  newStatus: string;
}

export const eventBus = new EventEmitter();
eventBus.setMaxListeners(30);

export function emitRegistrationEvent(topic: EventTopic, payload: RegistrationEvent) {
  eventBus.emit(topic, payload);
}
