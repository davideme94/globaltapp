import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import env from '../config';

/**
 * Si hay JWT válido en cookies, adjunta req.user { id, _id, role }.
 * Acepta payloads con 'sub' o 'uid'. Lee 'gt_token' o 'token'.
 */
export function attachUserFromJWT(req: Request, _res: Response, next: NextFunction) {
  const COOKIE_NAME = process.env.COOKIE_NAME || 'gt_token';
  const token =
    (req.cookies?.[COOKIE_NAME] as string | undefined) ||
    (req.cookies?.token as string | undefined);

  if (token) {
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as any;
      const userId = decoded?.sub ?? decoded?.uid;
      const role = decoded?.role;
      if (userId && role) {
        (req as any).user = { id: userId, _id: userId, role };
      }
    } catch {
      // token inválido/expirado -> seguimos sin user
    }
  }
  next();
}

/**
 * Guard de rol (si algún endpoint lo usa).
 */
export function requireRole(...roles: Array<'student' | 'teacher' | 'coordinator' | 'admin'>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (roles.length && !roles.includes(user.role)) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}
