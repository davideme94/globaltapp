import jwt from 'jsonwebtoken';
import env from '../config';

export type JWTPayload = {
  sub: string;   // user id
  role: string;  // 'student' | 'teacher' | 'coordinator' | 'admin'
};

const DEFAULT_EXPIRES_IN = '7d';

export function signToken(payload: JWTPayload, opts?: jwt.SignOptions): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: DEFAULT_EXPIRES_IN, ...(opts || {}) });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, env.JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}
