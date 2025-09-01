// server/src/models/boardPost.ts
import { Schema, model, type Document, type Types } from 'mongoose';

export interface IBoardPost extends Document<Types.ObjectId> {
  course: Types.ObjectId;
  author: Types.ObjectId;
  title?: string;
  body?: string;
  links: {
    url: string;
    meta?: {
      title?: string;
      description?: string;
      image?: string;
      provider?: string;
      type?: string;
    };
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const linkMetaSchema = new Schema(
  {
    title: String,
    description: String,
    image: String,
    provider: String,
    type: String,
  },
  { _id: false }
);

const linkSchema = new Schema(
  {
    url: { type: String, required: true, trim: true },
    meta: { type: linkMetaSchema, default: undefined },
  },
  { _id: false }
);

const boardPostSchema = new Schema<IBoardPost>(
  {
    course: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, trim: true, default: '' },
    body: { type: String, trim: true, default: '' },
    links: { type: [linkSchema], default: [] },
  },
  { timestamps: true }
);

// Lista por curso, orden nuevo→viejo
boardPostSchema.index({ course: 1, createdAt: -1 });

export const BoardPost = model<IBoardPost>('BoardPost', boardPostSchema);
