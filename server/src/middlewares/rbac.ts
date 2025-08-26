import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import env from '../config';

/** Lee token desde cookies ('gt_token' por defecto, o 'token' como fallback) */
function getTokenFromCookies(req: Request): string | undefined {
  const COOKIE_NAME = process.env.COOKIE_NAME || 'gt_token';
  return (req.cookies?.[COOKIE_NAME] as string | undefined) || (req.cookies?.token as string | undefined);
}

/** Requiere sesión válida */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = getTokenFromCookies(req);
  if (!token) return res.status(401).json({ error: 'No autenticado' });

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as any;
    const userId = payload?.sub ?? payload?.uid;
    const role = payload?.role as string | undefined;
    if (!userId || !role) return res.status(401).json({ error: 'No autenticado' });

    (req as any).userId = userId;
    (req as any).userRole = role;
    next();
  } catch {
    return res.status(401).json({ error: 'No autenticado' });
  }
}

/** Autorización por roles */
export function allowRoles(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = (req as any).userRole as string | undefined;
    if (!role) return res.status(401).json({ error: 'No autenticado' });
    if (roles.length && !roles.includes(role)) return res.status(403).json({ error: 'No autorizado' });
    next();
  };
}
