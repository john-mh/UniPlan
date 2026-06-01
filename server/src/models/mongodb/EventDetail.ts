import mongoose, { Schema, Document } from 'mongoose';
import { EventType } from '@uniplan/shared';

export interface IEventDetail extends Document {
  eventId: number;
  eventType: string;
}

const eventDetailSchema = new Schema<IEventDetail>(
  {
    eventId: { type: Number, required: true, unique: true },
    eventType: { type: String, required: true },
    messages: [{
      text: String,
      sentAt: Date,
      sentBy: String,
    }],
  },
  {
    discriminatorKey: 'eventType',
    collection: 'event_details',
    timestamps: true,
  },
);

export const EventDetail = mongoose.model<IEventDetail>('EventDetail', eventDetailSchema);

// Workshop
export interface IWorkshopDetail extends IEventDetail {
  materials: string[];
  prerequisiteSubjectCode?: string;
  prerequisiteSemester?: number;
}

export const WorkshopDetail = EventDetail.discriminator<IWorkshopDetail>(
  EventType.WORKSHOP,
  new Schema({
    materials: [String],
    prerequisiteSubjectCode: String,
    prerequisiteSemester: Number,
  }),
);

// Talk
export interface ITalkDetail extends IEventDetail {
  speakerName?: string;
  speakerProfile?: string;
  speakerAffiliation?: string;
  relatedLinks?: string[];
  extendedDescription?: string;
}

export const TalkDetail = EventDetail.discriminator<ITalkDetail>(
  EventType.TALK,
  new Schema({
    speakerName: String,
    speakerProfile: String,
    speakerAffiliation: String,
    relatedLinks: [String],
    extendedDescription: String,
  }),
);

// Sports Tournament
export interface ISportsTournamentDetail extends IEventDetail {
  sportType: string;
  rules?: string;
  playersPerTeam?: number;
  tournamentStructure?: string;
}

export const SportsTournamentDetail = EventDetail.discriminator<ISportsTournamentDetail>(
  EventType.SPORTS_TOURNAMENT,
  new Schema({
    sportType: { type: String, required: true },
    rules: String,
    playersPerTeam: Number,
    tournamentStructure: String,
  }),
);

// Volunteering
export interface IVolunteeringDetail extends IEventDetail {
  cause?: string;
  hoursRequired: number;
  activities?: string[];
  meetingPoints?: string[];
  responsiblePersons?: string[];
}

export const VolunteeringDetail = EventDetail.discriminator<IVolunteeringDetail>(
  EventType.VOLUNTEERING,
  new Schema({
    cause: String,
    hoursRequired: { type: Number, required: true },
    activities: [String],
    meetingPoints: [String],
    responsiblePersons: [String],
  }),
);

// Other
export interface IOtherEventDetail extends IEventDetail {
  additionalInfo: Record<string, unknown>;
}

export const OtherEventDetail = EventDetail.discriminator<IOtherEventDetail>(
  EventType.OTHER,
  new Schema({
    additionalInfo: { type: Schema.Types.Mixed, default: {} },
  }),
);

export function getEventDetailModel(eventType: string): mongoose.Model<IEventDetail> {
  const models: Record<string, mongoose.Model<IEventDetail>> = {
    [EventType.WORKSHOP]: WorkshopDetail as unknown as mongoose.Model<IEventDetail>,
    [EventType.TALK]: TalkDetail as unknown as mongoose.Model<IEventDetail>,
    [EventType.SPORTS_TOURNAMENT]: SportsTournamentDetail as unknown as mongoose.Model<IEventDetail>,
    [EventType.VOLUNTEERING]: VolunteeringDetail as unknown as mongoose.Model<IEventDetail>,
    [EventType.OTHER]: OtherEventDetail as unknown as mongoose.Model<IEventDetail>,
  };
  return models[eventType] || (EventDetail as unknown as mongoose.Model<IEventDetail>);
}
