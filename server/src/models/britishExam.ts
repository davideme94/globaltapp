import { Schema, model, type Document, type Types } from 'mongoose';

export interface IBritishExam extends Document<Types.ObjectId> {
  student: Types.ObjectId;
  course: Types.ObjectId;
  year: number;
  oral: number | null;
  written: number | null;
  provider?: 'TRINITY' | 'CAMBRIDGE' | 'BRITANICO';
  examiner?: string;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const britishSchema = new Schema<IBritishExam>(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    course: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      index: true,
    },

    year: {
      type: Number,
      required: true,
      index: true,
    },

    oral: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },

    written: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },

    provider: {
      type: String,
      enum: ['TRINITY', 'CAMBRIDGE', 'BRITANICO'],
      default: 'BRITANICO',
    },

    examiner: {
      type: String,
      trim: true,
      default: '',
    },

    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

/* 
  Un solo resultado por:
  alumno + curso + año
*/
britishSchema.index(
  { student: 1, course: 1, year: 1 },
  { unique: true }
);

export const BritishExam = model<IBritishExam>('BritishExam', britishSchema);
