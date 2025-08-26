import { Schema, model, type Document, type Types } from 'mongoose';

export type FinalCondition =
  | 'APPROVED'
  | 'FAILED_ORAL'
  | 'FAILED_WRITTEN'
  | 'FAILED_BOTH'
  | 'PASSED_INTERNAL'
  | 'REPEATER';

export interface ITermBlock {
  writing: number | null;
  speaking: number | null;
  reading: number | null;
  listening: number | null;
  comments?: string;
}

export interface IReportCard extends Document<Types.ObjectId> {
  student: Types.ObjectId;
  course: Types.ObjectId;
  teacher: Types.ObjectId; // último que editó
  year: number;

  // --- TRIMESTRES (1–10) ---
  t1: ITermBlock;
  t2: ITermBlock;
  t3: ITermBlock;

  // --- EXÁMENES / FINALES ---
  examOral?: number | null;     // 0–100
  examWritten?: number | null;  // 0–100
  finalOral?: number | null;    // 0–100
  finalWritten?: number | null; // 0–100

  condition: FinalCondition;
  comments?: string;

  createdAt: Date;
  updatedAt: Date;
}

const termSchema = new Schema<ITermBlock>(
  {
    writing: { type: Number, min: 1, max: 10, default: null },
    speaking: { type: Number, min: 1, max: 10, default: null },
    reading: { type: Number, min: 1, max: 10, default: null },
    listening: { type: Number, min: 1, max: 10, default: null },
    comments: { type: String, default: '' }
  },
  { _id: false }
);

const reportCardSchema = new Schema<IReportCard>(
  {
    student: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    course:  { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    teacher: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    year:    { type: Number, required: true, index: true },

    t1: { type: termSchema, required: true, default: () => ({}) },
    t2: { type: termSchema, required: true, default: () => ({}) },
    t3: { type: termSchema, required: true, default: () => ({}) },

    examOral:     { type: Number, min: 0, max: 100, default: null },
    examWritten:  { type: Number, min: 0, max: 100, default: null },
    finalOral:    { type: Number, min: 0, max: 100, default: null },
    finalWritten: { type: Number, min: 0, max: 100, default: null },

    condition: { type: String, enum: ['APPROVED','FAILED_ORAL','FAILED_WRITTEN','FAILED_BOTH','PASSED_INTERNAL','REPEATER'], default: 'APPROVED', index: true },
    comments:  { type: String, default: '' },
  },
  { timestamps: true }
);

// 1 boleta por alumno/curso/año
reportCardSchema.index({ student: 1, course: 1, year: 1 }, { unique: true });

export const ReportCard = model<IReportCard>('ReportCard', reportCardSchema);
