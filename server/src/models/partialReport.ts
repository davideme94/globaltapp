import { Schema, model, type Document, type Types } from 'mongoose';

export type Term = 'MAY' | 'OCT';
export type Grade = 'A' | 'B' | 'C' | 'D' | 'E';

export interface IPartialReport extends Document<Types.ObjectId> {
  student: Types.ObjectId;
  course: Types.ObjectId;
  teacher: Types.ObjectId; // último que editó
  year: number;
  term: Term;
  grades: {
    reading: Grade;
    writing: Grade;
    listening: Grade;
    speaking: Grade;
    attendance: Grade;
    commitment: Grade;
  };
  comments?: string;
  createdAt: Date;
  updatedAt: Date;
}

const gradesSchema = new Schema(
  {
    reading: { type: String, enum: ['A','B','C','D','E'], required: true },
    writing: { type: String, enum: ['A','B','C','D','E'], required: true },
    listening: { type: String, enum: ['A','B','C','D','E'], required: true },
    speaking: { type: String, enum: ['A','B','C','D','E'], required: true },
    attendance: { type: String, enum: ['A','B','C','D','E'], required: true },
    commitment: { type: String, enum: ['A','B','C','D','E'], required: true },
  },
  { _id: false }
);

const partialSchema = new Schema<IPartialReport>(
  {
    student: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    course: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    teacher: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    year: { type: Number, required: true, index: true },
    term: { type: String, enum: ['MAY','OCT'], required: true, index: true },
    grades: { type: gradesSchema, required: true },
    comments: { type: String, default: '' },
  },
  { timestamps: true }
);

// Un reporte por alumno/curso/año/term
partialSchema.index({ student: 1, course: 1, year: 1, term: 1 }, { unique: true });

export const PartialReport = model<IPartialReport>('PartialReport', partialSchema);
