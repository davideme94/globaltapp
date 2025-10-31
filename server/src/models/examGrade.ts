// server/src/models/examGrade.ts
import { Schema, model, type Document, type Types } from 'mongoose';
import type { Pass3 } from './examModel';

export interface IExamGrade extends Document<Types.ObjectId> {
  exam: Types.ObjectId;      // ExamModel
  course: Types.ObjectId;
  student: Types.ObjectId;   // User
  resultPass3?: Pass3|null;
  resultNumeric?: number|null; // 1..10
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IExamGrade>(
  {
    exam:    { type: Schema.Types.ObjectId, ref: 'ExamModel', required: true, index: true },
    course:  { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    student: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    resultPass3:   { type: String, enum: ['PASS','BARELY_PASS','FAILED'], default: null },
    resultNumeric: { type: Number, min:1, max:10, default: null },
    updatedBy:{ type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

schema.index({ exam:1, student:1 }, { unique:true });

export const ExamGrade = model<IExamGrade>('ExamGrade', schema);
