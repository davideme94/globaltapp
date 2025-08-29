import { Schema, model, type Document, type Types } from 'mongoose';

export interface ICommReply extends Document<Types.ObjectId> {
  communication: Types.ObjectId;
  user: Types.ObjectId;
  role: 'student' | 'teacher' | 'coordinator' | 'admin';
  body: string;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<ICommReply>(
  {
    communication: { type: Schema.Types.ObjectId, ref: 'Communication', required: true, index: true },
    user:          { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role:          { type: String, enum: ['student','teacher','coordinator','admin'], required: true },
    body:          { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

schema.index({ communication: 1, createdAt: 1 });

export const CommReply = model<ICommReply>('CommReply', schema);
