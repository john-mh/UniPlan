import { prisma } from '../app.js';
import { eventBus, EventTopic, RegistrationEvent } from './EventBus.js';

async function updateStat(eventId: number, field: string, delta: number) {
  await prisma.$executeRawUnsafe(
    `UPDATE public.uniplan_statistics SET ${field} = ${field} + $1, last_updated = NOW() WHERE event_id = $2`,
    delta, eventId
  );
}

eventBus.on(EventTopic.REGISTRATION_CREATED, (payload: RegistrationEvent) => {
  updateStat(payload.eventId, 'total_registered', 1).catch(console.error);
});

eventBus.on(EventTopic.REGISTRATION_CANCELLED, (payload: RegistrationEvent) => {
  updateStat(payload.eventId, 'total_cancelled', 1).catch(console.error);
});

eventBus.on(EventTopic.REGISTRATION_STATUS_CHANGED, (payload: RegistrationEvent) => {
  if (payload.previousStatus === 'REGISTERED' && payload.newStatus === 'CANCELLED') {
    updateStat(payload.eventId, 'total_registered', -1).catch(console.error);
    updateStat(payload.eventId, 'total_cancelled', 1).catch(console.error);
  }
  if (payload.newStatus === 'ATTENDED') {
    updateStat(payload.eventId, 'total_attended', 1).catch(console.error);
  }
});
