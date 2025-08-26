import { Schema, model, type Document, type Types } from 'mongoose';
import { Campuses, type Campus } from './user';

export interface ICourse extends Document<Types.ObjectId> {
  name: string;
  year: number;
  campus: Campus;
  teacher?: Types.ObjectId | null;
  schedule: { dayOfWeek: number; start: string; end: string }[];
  materials: { title: string; url: string }[];
  syllabusUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const scheduleSchema = new Schema(
  {
    dayOfWeek: { type: Number, min: 0, max: 6, required: true },
    start: { type: String, required: true },
    end: { type: String, required: true },
  },
  { _id: false }
);

const materialSchema = new Schema(
  {
    title: { type: String, required: true },
    url: { type: String, required: true },
  },
  { _id: false }
);

const courseSchema = new Schema<ICourse>(
  {
    name: { type: String, required: true, trim: true },
    year: { type: Number, required: true, index: true },
    campus: { type: String, enum: Campuses, required: true, index: true },
    teacher: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    schedule: { type: [scheduleSchema], default: [] },
    materials: { type: [materialSchema], default: [] },
    syllabusUrl: String,
  },
  { timestamps: true }
);

// Evita duplicados por nombre+año+sede
courseSchema.index({ name: 1, year: 1, campus: 1 }, { unique: true });

export const Course = model<ICourse>('Course', courseSchema);
