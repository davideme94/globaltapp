// server/src/routes/auth.ts
import { Router } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import env from '../config';
import { User } from '../models/user';

const router = Router();

const COOKIE_NAME = process.env.COOKIE_NAME || 'gt_token';
const isProd = env.NODE_ENV === 'production';

type JwtPayload = {
  uid: string;
  role: 'student' | 'teacher' | 'coordinator' | 'admin';
};

// Opciones de cookie (dev vs prod)
const cookieOptsBase = {
  httpOnly: true as const,
  sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
  secure: isProd,
  path: '/' as const,
};

function setAuthCookie(res: any, token: string) {
  res.cookie(COOKIE_NAME, token, {
    ...cookieOptsBase,
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 días
  });
}

function clearAuthCookie(res: any) {
  // Para borrar, las opciones deben matchear
  res.clearCookie(COOKIE_NAME, {
    ...cookieOptsBase,
  });
}

function signToken(payload: JwtPayload) {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '7d' });
}

async function getUserFromTokenCookie(req: any) {
  const raw = req.cookies?.[COOKIE_NAME];
  if (!raw) return null;
  try {
    const decoded = jwt.verify(raw, env.JWT_SECRET) as JwtPayload;
    const u = await User.findById(decoded.uid).lean();
    if (!u) return null;
    // Si tu esquema tiene "active", respetalo. Si no, ignóralo.
    // @ts-ignore
    if (typeof u.active === 'boolean' && !u.active) return null;

    return {
      id: String(u._id),
      name: u.name,
      email: u.email,
      role: u.role,
      campus: u.campus,
      phone: u.phone,
      photoUrl: u.photoUrl,
    };
  } catch {
    return null;
  }
}

/** POST /auth/login */
router.post('/auth/login', async (req, res, next) => {
  try {
    const body = z.object({
      email: z.string().email(),
      password: z.string().min(1),
    }).parse(req.body);

    const user = await User.findOne({ email: body.email.toLowerCase().trim() });
    if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });

    // Si tu modelo tiene "active", solo deja loguear si está activo
    // @ts-ignore
    if (typeof user.active === 'boolean' && !user.active) {
      return res.status(403).json({ error: 'Usuario inactivo' });
    }

    const ok = await bcrypt.compare(body.password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });

    const token = signToken({ uid: String(user._id), role: user.role });
    setAuthCookie(res, token);

    return res.json({
      user: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        role: user.role,
        campus: user.campus,
        phone: user.phone,
        photoUrl: user.photoUrl,
      },
    });
  } catch (e) {
    next(e);
  }
});

/** POST /auth/logout */
router.post('/auth/logout', async (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

/** GET /auth/me */
router.get('/auth/me', async (req, res) => {
  const me = await getUserFromTokenCookie(req);
  if (!me) return res.status(401).json({ error: 'No autenticado' });
  res.json({ user: me });
});

export default router;
