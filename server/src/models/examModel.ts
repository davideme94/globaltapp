import { Schema, model, type Document, type Types } from 'mongoose';

export const ExamCategories = ['MID_YEAR','END_YEAR'] as const;
export type ExamCategory = typeof ExamCategories[number];
export type GradeType = 'PASS3'|'NUMERIC';
export type Pass3 = 'PASS'|'BARELY_PASS'|'FAILED';

export interface IExamModel extends Document<Types.ObjectId> {
  course: Types.ObjectId;
  category: ExamCategory; // MID_YEAR / END_YEAR
  number: number;         // 1..2 (mid) / 1..4 (end)
  gradeType: GradeType;   // PASS3 o NUMERIC
  driveUrl?: string;      // link de Google Drive
  visible: boolean;       // habilitado para alumnos
  updatedBy: Types.ObjectId; // dejamos requerido, lo seteamos en autoseed
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IExamModel>(
  {
    course:   { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    category: { type: String, enum: ExamCategories, required: true, index: true },
    number:   { type: Number, required: true },
    gradeType:{ type: String, enum: ['PASS3','NUMERIC'], required: true },
    driveUrl: { type: String, default: '' },
    visible:  { type: Boolean, default: false },
    updatedBy:{ type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

schema.index({ course:1, category:1, number:1 }, { unique:true });

export const ExamModel = model<IExamModel>('ExamModel', schema);
