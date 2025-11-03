// server/src/models/practice.ts
import { Schema, model, type Document, type Types } from 'mongoose';

/* ========= PracticeSet (pack) ========= */
export interface IPracticeSet extends Document<Types.ObjectId> {
  title: string;
  units?: number;
  tags?: string[];
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const practiceSetSchema = new Schema<IPracticeSet>(
  {
    title: { type: String, required: true, trim: true, index: true },
    units: { type: Number, min: 1, max: 99 },
    tags:  { type: [String], default: undefined },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

export const PracticeSet = model<IPracticeSet>('PracticeSet', practiceSetSchema);

/* ========= PracticeItem (media reutilizable) =========
   ⚠️ Evitamos colisión con Document#set usando Omit<Document,'set'> */
type ItemDocBase = Omit<Document<Types.ObjectId>, 'set'>;

export interface IPracticeItem extends ItemDocBase {
  title: string;
  set?: Types.ObjectId | null;     // asociación opcional a un set
  unit?: number | null;            // unidad opcional
  imageUrl?: string | null;
  embedUrl?: string | null;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const itemSchema = new Schema<IPracticeItem>(
  {
    title:    { type: String, required: true, trim: true, index: true },
    set:      { type: Schema.Types.ObjectId, ref: 'PracticeSet', default: null, index: true },
    unit:     { type: Number, min: 1, max: 99 },
    imageUrl: { type: String, default: null },
    embedUrl: { type: String, default: null },
    createdBy:{ type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

itemSchema.index({ set: 1, unit: 1, updatedAt: -1 });

export const PracticeItem = model<IPracticeItem>('PracticeItem', itemSchema);

/* ========= Preguntas =========
   Nota: evitamos conflicto con Document.set() usando Omit<Document,'set'> */
type DocBase = Omit<Document<Types.ObjectId>, 'set'>;

export interface IPracticeQuestion extends DocBase {
  set?: Types.ObjectId | null;   // pack (opcional para compatibilidad)
  unit?: number;                 // unidad (1..n)
  prompt: string;
  imageUrl?: string;
  embedUrl?: string;
  type: 'MC' | 'GAP';
  options?: string[];
  answer: string;
  level?: string;
  course?: Types.ObjectId | null;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const questionSchema = new Schema<IPracticeQuestion>(
  {
    set:       { type: Schema.Types.ObjectId, ref: 'PracticeSet', index: true, default: null },
    unit:      { type: Number, min: 1, max: 99 },
    prompt:    { type: String, required: true },
    imageUrl:  { type: String },
    embedUrl:  { type: String },
    type:      { type: String, enum: ['MC', 'GAP'], required: true, index: true },
    options:   { type: [String], default: undefined },
    answer:    { type: String, required: true },
    level:     { type: String },
    course:    { type: Schema.Types.ObjectId, ref: 'Course', default: null, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

questionSchema.index({ set: 1, unit: 1 });

export const PracticeQuestion = model<IPracticeQuestion>('PracticeQuestion', questionSchema);

/* ========= Acceso por alumno + set ========= */
type AccessDocBase = Omit<Document<Types.ObjectId>, 'set'>;

export interface IPracticeAccess extends AccessDocBase {
  student: Types.ObjectId;
  course?: Types.ObjectId | null;
  set?: Types.ObjectId | null;     // set habilitado (opcional)
  enabled: boolean;
  updatedBy: Types.ObjectId;
  updatedAt: Date;
}

const accessSchema = new Schema<IPracticeAccess>(
  {
    // ⚠️ SIN unique acá: permitimos múltiples filas por alumno (una por set)
    student:   { type: Schema.Types.ObjectId, ref: 'User', index: true, required: true },
    course:    { type: Schema.Types.ObjectId, ref: 'Course', default: null, index: true },
    set:       { type: Schema.Types.ObjectId, ref: 'PracticeSet', default: null, index: true },
    enabled:   { type: Boolean, default: false },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: false, updatedAt: 'updatedAt' } }
);

// ✅ ÚNICO por (student,set) SOLO cuando set existe (ObjectId).
//    Esto permite varios sets por alumno y no rompe una fila “global” con set:null (legacy).
accessSchema.index(
  { student: 1, set: 1 },
  { unique: true, partialFilterExpression: { set: { $type: 'objectId' } } }
);

export const PracticeAccess = model<IPracticeAccess>('PracticeAccess', accessSchema);

/* ========= Intentos ========= */
type AttemptDocBase = Omit<Document<Types.ObjectId>, 'set'>;

export interface IPracticeAttempt extends AttemptDocBase {
  student: Types.ObjectId;
  question: Types.ObjectId;
  given: string;
  correct: boolean;
  // opcionales (útiles si querés consultar sin $lookup)
  set?: Types.ObjectId | null;
  unit?: number | null;
  createdAt: Date;
}

const attemptSchema = new Schema<IPracticeAttempt>(
  {
    student:  { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    question: { type: Schema.Types.ObjectId, ref: 'PracticeQuestion', required: true, index: true },
    given:    { type: String, required: true },
    correct:  { type: Boolean, required: true },
    set:      { type: Schema.Types.ObjectId, ref: 'PracticeSet', default: null, index: true },
    unit:     { type: Number, min: 1, max: 99 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Índice útil para consultas por alumno+set
attemptSchema.index({ student: 1, set: 1 });

export const PracticeAttempt = model<IPracticeAttempt>('PracticeAttempt', attemptSchema);
