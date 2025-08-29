import { Schema, model, type Document, type Types } from 'mongoose';

export type CommCategory = 'TASK' | 'BEHAVIOR' | 'ADMIN' | 'INFO';

export interface ICommunication extends Document<Types.ObjectId> {
  course: Types.ObjectId;
  student?: Types.ObjectId;       // si no está => mensaje general al curso
  sender: Types.ObjectId;
  senderRole: 'teacher'|'coordinator'|'admin';
  year: number;                   // cache del year del curso
  category: CommCategory;
  title: string;
  body: string;
  readAt?: Date | null;           // leído por el alumno (solo si student está seteado)

  // 👇 NUEVO: hilo de respuestas
  replies?: {
    _id: Types.ObjectId;
    user: Types.ObjectId;
    role: 'student'|'teacher'|'coordinator'|'admin';
    body: string;
    createdAt: Date;
  }[];

  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<ICommunication>(
  {
    course: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    student:{ type: Schema.Types.ObjectId, ref: 'User', required: false, index: true },
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    senderRole: { type: String, enum: ['teacher','coordinator','admin'], required: true, index: true },
    year:   { type: Number, required: true, index: true },
    category: { type: String, enum: ['TASK','BEHAVIOR','ADMIN','INFO'], required: true, index: true },
    title: { type: String, required: true },
    body:  { type: String, required: true },
    readAt:{ type: Date, default: null },

    // 👇 NUEVO: subdocumentos para respuestas
    replies: [{
      _id: { type: Schema.Types.ObjectId, auto: true },
      user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
      role: { type: String, enum: ['student','teacher','coordinator','admin'], required: true },
      body: { type: String, trim: true, required: true },
      createdAt: { type: Date, default: Date.now },
    }],
  },
  { timestamps: true }
);

schema.index({ course:1, student:1, createdAt:-1 });

export const Communication = model<ICommunication>('Communication', schema);
