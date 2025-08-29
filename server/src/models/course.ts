// server/src/models/course.ts
import { Schema, model, type Document, type Types } from 'mongoose';

export const Campuses = ['DERQUI', 'JOSE_C_PAZ'] as const;
export type Campus = typeof Campuses[number];

export interface ICourse extends Document<Types.ObjectId> {
  name: string;
  year: number;
  campus: Campus;
  teacher?: Types.ObjectId | null;
  // ⬇⬇ IMPORTANTE: cada item incluye 'day'
  schedule: { day?: 'MON'|'TUE'|'WED'|'THU'|'FRI'|'SAT'; start: string; end: string }[];
  links?: { syllabusUrl?: string; materialsUrl?: string } | null;
  createdAt: Date;
  updatedAt: Date;
}

// Subdocumento de horario (acepta 'day')
const scheduleItemSchema = new Schema(
  {
    day:   { type: String, enum: ['MON','TUE','WED','THU','FRI','SAT'], required: false },
    start: { type: String, required: true }, // HH:MM
    end:   { type: String, required: true }, // HH:MM
  },
  { _id: false }
);

const courseSchema = new Schema<ICourse>(
  {
    name:   { type: String, required: true, trim: true },
    year:   { type: Number, required: true, index: true },
    campus: { type: String, enum: Campuses, required: true, index: true },

    teacher: { type: Schema.Types.ObjectId, ref: 'User', default: null },

    // ⬇⬇ Array de items con 'day' opcional (para compat de datos viejos)
    schedule: { type: [scheduleItemSchema], default: [] },

    links:   { type: Object, default: null },
  },
  { timestamps: true }
);

export const Course = model<ICourse>('Course', courseSchema);
