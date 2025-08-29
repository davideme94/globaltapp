// models/caseReply.ts
import { Schema, model, Types, Document } from 'mongoose';

export interface ICaseReply extends Document<Types.ObjectId> {
  case: Types.ObjectId;
  user: Types.ObjectId;
  role: 'teacher'|'coordinator'|'admin';
  body: string;
  createdAt: Date;
}

const CaseReplySchema = new Schema<ICaseReply>({
  case: { type: Schema.Types.ObjectId, ref: 'Case', required: true, index: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, enum: ['teacher','coordinator','admin'], required: true },
  body: { type: String, required: true },
}, { timestamps: { createdAt: true, updatedAt: false } });

export const CaseReply = model<ICaseReply>('CaseReply', CaseReplySchema);
