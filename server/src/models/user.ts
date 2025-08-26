import { Schema, model, type Document, type Types } from 'mongoose';

export const Roles = ['student', 'teacher', 'coordinator', 'admin'] as const;
export type Role = typeof Roles[number];

export const Campuses = ['DERQUI', 'JOSE_C_PAZ'] as const;
export type Campus = typeof Campuses[number];

export interface IUser extends Document<Types.ObjectId> {
  name: string;
  email: string;
  role: Role;
  campus: Campus;
  phone?: string;
  guardianPhone?: string;
  address?: string;
  photoUrl?: string;
  birthDate?: Date;
  passwordHash: string;
  practiceEnabled?: boolean;
  active: boolean;             // <- NUEVO: soft-delete / desactivación
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true, index: true },
    role: { type: String, enum: Roles, required: true, index: true },
    campus: { type: String, enum: Campuses, required: true, index: true },
    phone: String,
    guardianPhone: String,
    address: String,
    photoUrl: String,
    birthDate: Date,
    passwordHash: { type: String, required: true },
    practiceEnabled: { type: Boolean, default: false, index: true },
    active: { type: Boolean, default: true, index: true }, // <- NUEVO
  },
  { timestamps: true }
);

userSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  },
});

export const User = model<IUser>('User', userSchema);
