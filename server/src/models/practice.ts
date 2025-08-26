import { Schema, model, type Document, type Types } from 'mongoose';

/** Preguntas de práctica */
export interface IPracticeQuestion extends Document<Types.ObjectId> {
  prompt: string;
  type: 'MC' | 'GAP';                // multiple choice / completar
  options?: string[];                // para MC
  answer: string;                    // respuesta correcta (para MC/GAP)
  level?: string;                    // opcional (A1, A2, etc.)
  course?: Types.ObjectId | null;    // opcional (asociar a un curso)
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const questionSchema = new Schema<IPracticeQuestion>({
  prompt: { type: String, required: true },
  type:   { type: String, enum: ['MC','GAP'], required: true },
  options:{ type: [String], default: undefined },
  answer: { type: String, required: true },
  level:  { type: String },
  course: { type: Schema.Types.ObjectId, ref: 'Course', default: null, index: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

export const PracticeQuestion = model<IPracticeQuestion>('PracticeQuestion', questionSchema);

/** Habilitación por alumno */
export interface IPracticeAccess extends Document<Types.ObjectId> {
  student: Types.ObjectId;
  enabled: boolean;
  updatedBy: Types.ObjectId;
  updatedAt: Date;
}

const accessSchema = new Schema<IPracticeAccess>({
  student: { type: Schema.Types.ObjectId, ref: 'User', unique: true, index: true, required: true },
  enabled: { type: Boolean, default: false },
  updatedBy:{ type: Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: { createdAt: false, updatedAt: 'updatedAt' }});

export const PracticeAccess = model<IPracticeAccess>('PracticeAccess', accessSchema);

/** Intentos */
export interface IPracticeAttempt extends Document<Types.ObjectId> {
  student: Types.ObjectId;
  question: Types.ObjectId;
  given: string;
  correct: boolean;
  createdAt: Date;
}

const attemptSchema = new Schema<IPracticeAttempt>({
  student:  { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  question: { type: Schema.Types.ObjectId, ref: 'PracticeQuestion', required: true, index: true },
  given:    { type: String, required: true },
  correct:  { type: Boolean, required: true }
}, { timestamps: { createdAt: true, updatedAt: false }});

export const PracticeAttempt = model<IPracticeAttempt>('PracticeAttempt', attemptSchema);
