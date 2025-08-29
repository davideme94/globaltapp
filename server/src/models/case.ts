// models/case.ts
import { Schema, model, Types, Document } from 'mongoose';

export type CaseCategory =
  | 'ACADEMIC_DIFFICULTY'   // dificultades con consignas / rendimiento
  | 'BEHAVIOR'              // conducta
  | 'ATTENDANCE'            // asistencia
  | 'ADMIN'                 // administrativo
  | 'OTHER';

export type CaseSeverity = 'LOW'|'MEDIUM'|'HIGH';
export type CaseStatus = 'OPEN'|'IN_PROGRESS'|'RESOLVED'|'ARCHIVED';
export type CaseSource = 'MANUAL'|'AUTOMATION';

export interface ICase extends Document<Types.ObjectId> {
  course?: Types.ObjectId | null;
  student: Types.ObjectId;
  createdBy: Types.ObjectId;
  assignee?: Types.ObjectId | null;
  watchers: Types.ObjectId[];          // profe, coord, etc.
  category: CaseCategory;
  severity: CaseSeverity;
  status: CaseStatus;
  source: CaseSource;                   // MANUAL / AUTOMATION
  ruleId?: string | null;               // p.ej., "attendance_3_absences"
  title: string;
  description?: string;
  checklist?: { label: string; done: boolean; doneAt?: Date | null; by?: Types.ObjectId | null }[];
  campus?: 'DERQUI'|'JOSE_C_PAZ';
  createdAt: Date;
  updatedAt: Date;
}

const CaseSchema = new Schema<ICase>({
  course:   { type: Schema.Types.ObjectId, ref: 'Course', required: false, index: true },
  student:  { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  createdBy:{ type: Schema.Types.ObjectId, ref: 'User', required: true },
  assignee: { type: Schema.Types.ObjectId, ref: 'User', required: false, default: null, index: true },
  watchers: [{ type: Schema.Types.ObjectId, ref: 'User', index: true }],
  category: { type: String, enum: ['ACADEMIC_DIFFICULTY','BEHAVIOR','ATTENDANCE','ADMIN','OTHER'], required: true, index: true },
  severity: { type: String, enum: ['LOW','MEDIUM','HIGH'], required: true, index: true },
  status:   { type: String, enum: ['OPEN','IN_PROGRESS','RESOLVED','ARCHIVED'], required: true, default: 'OPEN', index: true },
  source:   { type: String, enum: ['MANUAL','AUTOMATION'], required: true, default: 'MANUAL', index: true },
  ruleId:   { type: String, default: null, index: true },
  title:    { type: String, required: true },
  description: { type: String, default: '' },
  checklist: [{
    label: String,
    done: { type: Boolean, default: false },
    doneAt: { type: Date, default: null },
    by: { type: Schema.Types.ObjectId, ref: 'User', default: null }
  }],
  campus:   { type: String, enum: ['DERQUI','JOSE_C_PAZ'], required: false, index: true },
}, { timestamps: true });

CaseSchema.index({ student:1, course:1, status:1, category:1, source:1, ruleId:1 });

export const Case = model<ICase>('Case', CaseSchema);
