import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

import { requireAuth, allowRoles } from '../middlewares/rbac';
import { User } from '../models/user';
import { Enrollment } from '../models/enrollment';
import { Course } from '../models/course';
import { buildDefaultEmail } from '../utils/email'; // ⬅️ NUEVO

const router = Router();

// ===== Schemas & helpers =====
const campusSchema = z.enum(['DERQUI', 'JOSE_C_PAZ']);
const roleSchema = z.enum(['student', 'teacher', 'coordinator', 'admin']);

const listQuerySchema = z.object({
  role: z.enum(['student', 'teacher']).optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

const createUserSchema = z.object({
  name: z.string().min(2),
  role: z.enum(['student', 'teacher']),
  campus: campusSchema,
  email: z.string().email().optional()
});

const setActiveSchema = z.object({ active: z.boolean() });

function genPassword(len = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function toPublic(u: any) {
  return {
    _id: String(u._id),
    name: u.name,
    email: u.email || '',
    role: u.role,
    campus: u.campus,
    active: !!u.active,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt
  };
}

// Pequeño helper para asegurar unicidad si el email fue auto-generado
async function uniqueEmail(candidate: string) {
  let e = candidate;
  let i = 1;
  while (await User.exists({ email: e })) {
    const [local, domain] = candidate.split('@');
    e = `${local}${i}@${domain}`;
    i++;
  }
  return e;
}

// ===== Routes =====

/** GET /users  (paginado) */
router.get(
  '/users',
  requireAuth,
  allowRoles('coordinator', 'admin'),
  async (req, res, next) => {
    try {
      const { role, q, page, limit } = listQuerySchema.parse(req.query);
      const where: any = {};
      if (role) where.role = role;
      if (q && q.trim()) {
        const rx = new RegExp(q.trim(), 'i');
        where.$or = [{ name: rx }, { email: rx }];
      }

      const [rows, total] = await Promise.all([
        User.find(where, { passwordHash: 0 }) // ⬅️ ocultamos hash
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        User.countDocuments(where)
      ]);

      res.json({
        rows: rows.map(toPublic),
        total,
        page,
        limit
      });
    } catch (e) {
      next(e);
    }
  }
);

/** GET /users/search?role=&q=  (top 10) */
router.get(
  '/users/search',
  requireAuth,
  allowRoles('coordinator', 'admin', 'teacher'),
  async (req, res, next) => {
    try {
      const { role, q } = listQuerySchema.partial().parse(req.query);
      const where: any = {};
      if (role) where.role = role;
      if (q && q.trim()) {
        const rx = new RegExp(q.trim(), 'i');
        where.$or = [{ name: rx }, { email: rx }];
      }
      const rows = await User.find(where, { passwordHash: 0 }).limit(10).lean();
      res.json({ rows: rows.map(toPublic) });
    } catch (e) {
      next(e);
    }
  }
);

/** POST /users  (crea y devuelve password para entregar) */
router.post(
  '/users',
  requireAuth,
  allowRoles('coordinator', 'admin'),
  async (req, res, next) => {
    try {
      const data = createUserSchema.parse(req.body);
      let email = (data.email || '').toLowerCase().trim();

      // Si vino email explícito, validar duplicado
      if (email) {
        const exists = await User.findOne({ email }).lean();
        if (exists) return res.status(409).json({ error: 'El email ya está registrado' });
      } else {
        // Si no vino, generar con el dominio por defecto y asegurar unicidad
        email = await uniqueEmail(buildDefaultEmail(data.name));
      }

      // generar contraseña y guardar HASH en passwordHash
      const plain = genPassword();
      const passwordHash = await bcrypt.hash(plain, 10);

      const user = await User.create({
        name: data.name,
        role: data.role,
        campus: data.campus,
        email,
        passwordHash,         // ⬅️ campo correcto del esquema
        active: false         // empieza inactivo; luego "Activar" desde la UI
      });

      res.status(201).json({ user: toPublic(user), password: plain });
    } catch (e) {
      next(e);
    }
  }
);

/** PUT /users/:id/active */
router.put(
  '/users/:id/active',
  requireAuth,
  allowRoles('coordinator', 'admin'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { active } = setActiveSchema.parse(req.body);
      const updated = await User.findByIdAndUpdate(
        id,
        { $set: { active } },
        { new: true, projection: { passwordHash: 0 } }
      );
      if (!updated) return res.status(404).json({ error: 'Usuario no encontrado' });
      res.json({ user: toPublic(updated) });
    } catch (e) {
      next(e);
    }
  }
);

/** POST /users/:id/reset-password  -> { user, password } */
router.post(
  '/users/:id/reset-password',
  requireAuth,
  allowRoles('coordinator', 'admin'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const plain = genPassword();
      const passwordHash = await bcrypt.hash(plain, 10);

      const updated = await User.findByIdAndUpdate(
        id,
        { $set: { passwordHash } },    // ⬅️ actualizar el hash correcto
        { new: true, projection: { passwordHash: 0 } }
      );
      if (!updated) return res.status(404).json({ error: 'Usuario no encontrado' });

      res.json({ user: toPublic(updated), password: plain });
    } catch (e) {
      next(e);
    }
  }
);

/** DELETE /users/:id  (permite borrar alumno si NO tiene inscripciones ACTIVAS) */
router.delete(
  '/users/:id',
  requireAuth,
  allowRoles('coordinator', 'admin'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const u = await User.findById(id).lean();
      if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });

      if (u.role === 'student') {
        // ✅ Solo bloquea si hay inscripciones ACTIVAS
        const activeCount = await Enrollment.countDocuments({ student: id, status: 'active' });
        if (activeCount > 0) {
          return res.status(409).json({ error: 'No se puede borrar: alumno con inscripciones ACTIVAS' });
        }

        // Limpieza opcional: purgar inscripciones históricas (no activas)
        await Enrollment.deleteMany({ student: id, status: { $ne: 'active' } });
      }

      if (u.role === 'teacher') {
        const cnt = await Course.countDocuments({ teacher: id });
        if (cnt > 0) return res.status(409).json({ error: 'No se puede borrar: docente asignado a cursos' });
      }

      await User.findByIdAndDelete(id);
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
