import mongoose, { Schema, Document } from 'mongoose';
import { OrganizerType } from '@uniplan/shared';

export interface IOrganizerProfile {
  semester?: number;
  studentGroup?: string;
  department?: string;
  specialization?: string;
  adminArea?: string;
  positionTitle?: string;
}

export interface IOrganizer extends Document {
  userId: string;
  name: string;
  email: string;
  type: OrganizerType;
  profile: IOrganizerProfile;
  approvedByAdmin: boolean;
  isActive: boolean;
}

const organizerProfileSchema = new Schema<IOrganizerProfile>({
  semester: Number,
  studentGroup: String,
  department: String,
  specialization: String,
  adminArea: String,
  positionTitle: String,
}, { _id: false });

const organizerSchema = new Schema<IOrganizer>(
  {
    userId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    type: { type: String, required: true, enum: Object.values(OrganizerType) },
    profile: { type: organizerProfileSchema, default: {} },
    approvedByAdmin: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  {
    collection: 'organizers',
    timestamps: true,
  },
);

organizerSchema.index({ approvedByAdmin: 1 });
organizerSchema.index({ isActive: 1 });
organizerSchema.index({ type: 1 });

export const Organizer = mongoose.model<IOrganizer>('Organizer', organizerSchema);
