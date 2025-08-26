import { Schema, model, type Document, type Types } from 'mongoose';

export type AttendanceStatus = 'P' | 'A' | 'T' | 'J'; // Presente / Ausente / Tarde / Justificada

export interface IAttendance extends Document<Types.ObjectId> {
  course: Types.ObjectId;
  student: Types.ObjectId;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const attendanceSchema = new Schema<IAttendance>(
  {
    course:  { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    student: { type: Schema.Types.ObjectId, ref: 'User',   required: true, index: true },
    date:    { type: String, required: true, index: true }, // YYYY-MM-DD
    status:  { type: String, enum: ['P','A','T','J'], required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

// Un registro por alumno/curso/día
attendanceSchema.index({ course:1, student:1, date:1 }, { unique: true });

export const Attendance = model<IAttendance>('Attendance', attendanceSchema);
