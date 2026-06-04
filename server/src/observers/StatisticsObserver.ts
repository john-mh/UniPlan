import { pgPool } from '../app.js';
import { eventBus, EventTopic, RegistrationEvent } from './EventBus.js';
import { Event } from '../models/mongodb/index.js';

async function updateStat(eventId: string, field: string, delta: number) {
  await pgPool.query(
    `UPDATE public.uniplan_statistics SET ${field} = ${field} + $1, last_updated = NOW() WHERE event_id = $2`,
    [delta, eventId],
  );
}

async function updateDemographics(eventId: string) {
  const event = await Event.findById(eventId).lean();
  if (!event) return;

  const byFaculty: Record<string, number> = {};
  const byProgram: Record<string, number> = {};
  const byCampus: Record<string, number> = {};

  for (const reg of event.registrations || []) {
    if (reg.status === 'REGISTERED' || reg.status === 'ATTENDED') {
      if (reg.faculty) byFaculty[reg.faculty] = (byFaculty[reg.faculty] || 0) + 1;
      if (reg.program) byProgram[reg.program] = (byProgram[reg.program] || 0) + 1;
      if (reg.campus) byCampus[reg.campus] = (byCampus[reg.campus] || 0) + 1;
    }
  }

  await pgPool.query(
    `UPDATE public.uniplan_statistics SET demographics = $1, last_updated = NOW() WHERE event_id = $2`,
    [JSON.stringify({ by_faculty: byFaculty, by_program: byProgram, by_campus: byCampus }),
    eventId],
  );
}

eventBus.on(EventTopic.REGISTRATION_CREATED, async (payload: RegistrationEvent) => {
  try {
    await updateStat(payload.eventId, 'total_registered', 1);
    await updateDemographics(payload.eventId);
  } catch (e) {
    console.error('Observer REGISTRATION_CREATED error:', e);
  }
});

eventBus.on(EventTopic.REGISTRATION_CANCELLED, async (payload: RegistrationEvent) => {
  try {
    await updateStat(payload.eventId, 'total_registered', -1);
    await updateStat(payload.eventId, 'total_cancelled', 1);
    await updateDemographics(payload.eventId);
  } catch (e) {
    console.error('Observer REGISTRATION_CANCELLED error:', e);
  }
});

eventBus.on(EventTopic.REGISTRATION_STATUS_CHANGED, async (payload: RegistrationEvent) => {
  try {
    if (payload.previousStatus === 'REGISTERED' && payload.newStatus === 'CANCELLED') {
      await updateStat(payload.eventId, 'total_registered', -1);
      await updateStat(payload.eventId, 'total_cancelled', 1);
    }
    if (payload.newStatus === 'ATTENDED') {
      await updateStat(payload.eventId, 'total_attended', 1);
    }
    await updateDemographics(payload.eventId);
  } catch (e) {
    console.error('Observer STATUS_CHANGED error:', e);
  }
});
