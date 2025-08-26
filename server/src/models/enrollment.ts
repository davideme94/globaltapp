import { Schema, model, type Document, type Types } from 'mongoose';

export interface IEnrollment extends Document<Types.ObjectId> {
  course: Types.ObjectId;
  student: Types.ObjectId;
  year: number;
  status: 'active' | 'inactive' | 'completed';
  createdAt: Date;
  updatedAt: Date;
}

const enrollmentSchema = new Schema<IEnrollment>(
  {
    course: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    student: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    year: { type: Number, required: true, index: true },
    status: { type: String, enum: ['active', 'inactive', 'completed'], default: 'active', index: true },
  },
  { timestamps: true }
);

// Unicidad por curso+alumno+año
enrollmentSchema.index({ course: 1, student: 1, year: 1 }, { unique: true });

export const Enrollment = model<IEnrollment>('Enrollment', enrollmentSchema);
