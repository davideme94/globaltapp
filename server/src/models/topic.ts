import { Schema, model, type Document, type Types } from 'mongoose';

export interface ITopicEntry extends Document<Types.ObjectId> {
  course: Types.ObjectId;
  date: string; // YYYY-MM-DD
  topic1?: string;
  topic2?: string;
  book?: string;
  notes?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const topicSchema = new Schema<ITopicEntry>(
  {
    course: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    date:   { type: String, required: true, index: true }, // YYYY-MM-DD
    topic1: String,
    topic2: String,
    book:   String,
    notes:  String,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// 1 registro por curso y fecha
topicSchema.index({ course: 1, date: 1 }, { unique: true });

export const TopicEntry = model<ITopicEntry>('TopicEntry', topicSchema);
