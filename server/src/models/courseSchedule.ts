import { Schema, model, type Document, type Types } from 'mongoose';

export type DayCode = 'MON'|'TUE'|'WED'|'THU'|'FRI'|'SAT';
export interface ICourseSchedule extends Document<Types.ObjectId> {
  course: Types.ObjectId;
  items: { day: DayCode; start: string; end: string }[];
  updatedAt: Date;
  createdAt: Date;
}

const item = new Schema<{ day: DayCode; start: string; end: string }>({
  day:   { type: String, enum: ['MON','TUE','WED','THU','FRI','SAT'], required: true },
  start: { type: String, required: true }, // HH:MM
  end:   { type: String, required: true }, // HH:MM
}, { _id: false });

const scheduleSchema = new Schema<ICourseSchedule>({
  course: { type: Schema.Types.ObjectId, ref: 'Course', unique: true, index: true, required: true },
  items:  { type: [item], default: [] },
}, { timestamps: true });

export const CourseSchedule = model<ICourseSchedule>('CourseSchedule', scheduleSchema);
