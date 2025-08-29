// models/interventionTemplate.ts
import { Schema, model, Document } from 'mongoose';

export interface IInterventionTemplate extends Document {
  slug: string;           // "difficulty-brief"
  title: string;          // "Dificultad con consignas"
  category: 'ACADEMIC_DIFFICULTY'|'BEHAVIOR'|'ATTENDANCE'|'ADMIN'|'OTHER';
  defaultSeverity: 'LOW'|'MEDIUM'|'HIGH';
  checklist: string[];    // ["Reunión con familia", "Refuerzo tareas", ...]
  messageTemplate: string; // texto sugerido para tutores
  active: boolean;
}

const TplSchema = new Schema<IInterventionTemplate>({
  slug: { type: String, unique: true, index: true },
  title: String,
  category: { type: String, enum: ['ACADEMIC_DIFFICULTY','BEHAVIOR','ATTENDANCE','ADMIN','OTHER'], default: 'ACADEMIC_DIFFICULTY' },
  defaultSeverity: { type: String, enum: ['LOW','MEDIUM','HIGH'], default: 'MEDIUM' },
  checklist: [String],
  messageTemplate: String,
  active: { type: Boolean, default: true },
}, { timestamps: true });

export const InterventionTemplate = model<IInterventionTemplate>('InterventionTemplate', TplSchema);
