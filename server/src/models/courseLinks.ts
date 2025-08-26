import { Schema, model, type Document, type Types } from 'mongoose';

export interface ICourseLinks extends Document<Types.ObjectId> {
  course: Types.ObjectId;
  syllabusUrl?: string;
  materialsUrl?: string;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const linksSchema = new Schema<ICourseLinks>(
  {
    course: { type: Schema.Types.ObjectId, ref: 'Course', required: true, unique: true, index: true },
    syllabusUrl: { type: String },
    materialsUrl: { type: String },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

export const CourseLinks = model<ICourseLinks>('CourseLinks', linksSchema);
