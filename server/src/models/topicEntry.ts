import { Schema, model, type Document, type Types } from 'mongoose';

export interface ITopicEntry extends Document<Types.ObjectId> {
  course: Types.ObjectId;   // ref Course
  teacher: Types.ObjectId;  // ref User
  date: string;             // 'YYYY-MM-DD' (evita problemas de TZ)
  content: string;          // contenidos vistos
  attachments?: string[];   // links opcionales (Drive, etc.)
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<ITopicEntry>({
  course: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
  teacher: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  content: { type: String, required: true },
  attachments: [{ type: String }]
}, { timestamps: true });

schema.index({ course: 1, date: -1 });

export const TopicEntry = model<ITopicEntry>('TopicEntry', schema);
