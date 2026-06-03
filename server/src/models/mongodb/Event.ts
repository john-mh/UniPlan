import mongoose, { Schema, Document, Model } from 'mongoose';
import { EventType, EventStatus, RegistrationStatus } from '@uniplan/shared';

export interface IRegistration {
  _id?: mongoose.Types.ObjectId;
  studentId: string;
  studentName: string;
  faculty: string;
  program: string;
  campus: string;
  registrationDate: Date;
  status: RegistrationStatus;
  cancellationDate?: Date;
}

export interface IMessage {
  text: string;
  sentAt: Date;
  sentBy: string;
  senderName: string;
}

export interface IOrganizerRef {
  userId: string;
  name: string;
  type: string;
}

export interface IEvent extends Document {
  uniqueCode: string;
  title: string;
  description: string;
  eventType: string;
  date: Date;
  startTime: string;
  endTime: string;
  location: string;
  maxAttendees: number;
  status: EventStatus;
  organizer: IOrganizerRef;
  typeDetails: Record<string, unknown>;
  registrations: IRegistration[];
  messages: IMessage[];
}

const registrationSchema = new Schema<IRegistration>({
  studentId: { type: String, required: true },
  studentName: { type: String, required: true },
  faculty: { type: String, required: true },
  program: { type: String, required: true },
  campus: { type: String, required: true },
  registrationDate: { type: Date, default: Date.now },
  status: { type: String, enum: Object.values(RegistrationStatus), default: RegistrationStatus.REGISTERED },
  cancellationDate: Date,
});

const messageSchema = new Schema<IMessage>({
  text: { type: String, required: true },
  sentAt: { type: Date, default: Date.now },
  sentBy: { type: String, required: true },
  senderName: { type: String, required: true },
});

const organizerRefSchema = new Schema<IOrganizerRef>({
  userId: { type: String, required: true },
  name: { type: String, required: true },
  type: { type: String, required: true },
});

const baseOptions = { discriminatorKey: 'eventType', collection: 'events', timestamps: true };

const baseSchema = new Schema<IEvent>(
  {
    uniqueCode: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    eventType: { type: String, required: true },
    date: { type: Date, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    location: { type: String, required: true },
    maxAttendees: { type: Number, required: true },
    status: { type: String, enum: Object.values(EventStatus), default: EventStatus.UPCOMING },
    organizer: { type: organizerRefSchema, required: true },
    typeDetails: { type: Schema.Types.Mixed, default: {} },
    registrations: [registrationSchema],
    messages: [messageSchema],
  },
  baseOptions,
);

baseSchema.index({ eventType: 1 });
baseSchema.index({ date: 1 });
baseSchema.index({ status: 1 });
baseSchema.index({ 'registrations.studentId': 1 });
baseSchema.index({ uniqueCode: 1 });

export const Event = mongoose.model<IEvent>('Event', baseSchema);

// Workshop
const workshopTypeSchema = new Schema({
  materials: [String],
  prerequisiteSubjectCode: String,
  prerequisiteSemester: Number,
});
export const WorkshopEvent = Event.discriminator(EventType.WORKSHOP, workshopTypeSchema);

// Talk
const talkTypeSchema = new Schema({
  speakerName: String,
  speakerProfile: String,
  speakerAffiliation: String,
  relatedLinks: [String],
  extendedDescription: String,
});
export const TalkEvent = Event.discriminator(EventType.TALK, talkTypeSchema);

// Sports Tournament
const sportsTypeSchema = new Schema({
  sportType: { type: String, required: true },
  rules: String,
  playersPerTeam: Number,
  tournamentStructure: String,
});
export const SportsTournamentEvent = Event.discriminator(EventType.SPORTS_TOURNAMENT, sportsTypeSchema);

// Volunteering
const volunteeringTypeSchema = new Schema({
  cause: String,
  hoursRequired: { type: Number, required: true },
  activities: [String],
  meetingPoints: [String],
  responsiblePersons: [String],
});
export const VolunteeringEvent = Event.discriminator(EventType.VOLUNTEERING, volunteeringTypeSchema);

// Other
const otherTypeSchema = new Schema({
  additionalInfo: { type: Schema.Types.Mixed, default: {} },
});
export const OtherEvent = Event.discriminator(EventType.OTHER, otherTypeSchema);

export function getEventModel(_eventType: string): Model<IEvent> {
  return Event;
}
