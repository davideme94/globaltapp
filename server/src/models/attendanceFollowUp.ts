import { Schema, model, type Document, type Types } from 'mongoose';

export const AttendanceFollowUpStatuses = [
  'PENDING',
  'CONTACTED',
  'JUSTIFIED',
  'DROP_REQUEST',
  'DROPPED',
  'RESOLVED',
] as const;

export type AttendanceFollowUpStatus = typeof AttendanceFollowUpStatuses[number];

export interface IAttendanceFollowUp extends Document<Types.ObjectId> {
  course: Types.ObjectId;
  student: Types.ObjectId;

  streakCount: number;        // cantidad de ausentes seguidos detectados
  absenceDates: string[];     // fechas de las faltas seguidas, ej: ['2026-04-06', '2026-04-13', '2026-04-20']
  lastAbsenceDate: string;    // última fecha ausente

  status: AttendanceFollowUpStatus;

  reason?: string;            // causa que escribís vos
  notes?: string;             // observaciones internas

  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;

  resolvedAt?: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

const attendanceFollowUpSchema = new Schema<IAttendanceFollowUp>(
  {
    course: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      index: true,
    },

    student: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    streakCount: {
      type: Number,
      required: true,
      default: 3,
    },

    absenceDates: {
      type: [String],
      default: [],
    },

    lastAbsenceDate: {
      type: String,
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: AttendanceFollowUpStatuses,
      default: 'PENDING',
      required: true,
      index: true,
    },

    reason: {
      type: String,
      default: '',
      trim: true,
    },

    notes: {
      type: String,
      default: '',
      trim: true,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },

    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },

    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Un seguimiento activo por alumno/curso/última falta detectada.
// Esto evita duplicados si volvés a escanear.
attendanceFollowUpSchema.index(
  { course: 1, student: 1, lastAbsenceDate: 1 },
  { unique: true }
);

attendanceFollowUpSchema.index({ status: 1, updatedAt: -1 });

export const AttendanceFollowUp = model<IAttendanceFollowUp>(
  'AttendanceFollowUp',
  attendanceFollowUpSchema
);
