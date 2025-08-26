
import { Router } from 'express';
import { z } from 'zod';
import { allowRoles, requireAuth } from '../middlewares/rbac';
import { User } from '../models/user';

const router = Router();

/* ========= Schemas & helpers ========= */

const listQuerySchema = z.object({
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const updateMeSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  phone: z.string().min(5).max(30).optional(),
  guardianPhone: z.string().min(5).max(30).optional(),
  address: z.string().min(3).max(200).optional(),
  photoUrl: z.string().url().optional(),
  // si usás string "YYYY-MM-DD", convertimos más abajo a Date
  birthDate: z.string().optional(),
});

function toStudentPublic(u: any) {
  return {
    _id: String(u._id),
    name: u.name as string,
    email: (u.email || '') as string,
    campus: u.campus as 'DERQUI' | 'JOSE_C_PAZ',
    active: !!u.active,
  };
}

/* ========= NUEVO: endpoints basados en User (role=student) ========= */

/** GET /students/search?q=  -> para autocompletes del modal */
router.get(
  '/students/search',
  requireAuth,
  allowRoles('coordinator', 'admin', 'teacher'),
  async (req, res, next) => {
    try {
      const q = (req.query.q as string | undefined)?.trim();
      const where: any = { role: 'student' };
      if (q) {
        const rx = new RegExp(q, 'i');
        where.$or = [{ name: rx }, { email: rx }];
      }
      // Si querés solo activos, descomenta:
      // where.active = true;

      const rows = await User.find(where, { passwordHash: 0 })
        .sort({ name: 1 })
        .limit(20)
        .lean();

      const payload = rows.map(toStudentPublic);
      // devolvemos ambas keys por compatibilidad con UIs antiguas
      res.json({ rows: payload, students: payload });
    } catch (e) {
      next(e);
    }
  }
);

/** GET /students  (paginado) */
router.get(
  '/students',
  requireAuth,
  allowRoles('coordinator', 'admin'),
  async (req, res, next) => {
    try {
      const { q, page, limit } = listQuerySchema.parse(req.query);
      const where: any = { role: 'student' };
      if (q && q.trim()) {
        const rx = new RegExp(q.trim(), 'i');
        where.$or = [{ name: rx }, { email: rx }];
      }
      // where.active = true; // opcional

      const [rows, total] = await Promise.all([
        User.find(where, { passwordHash: 0 })
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        User.countDocuments(where),
      ]);

      res.json({
        rows: rows.map(toStudentPublic),
        total,
        page,
        limit,
      });
    } catch (e) {
      next(e);
    }
  }
);

/* ========= Perfil del alumno (propio) ========= */

// GET propio
router.get('/students/me', requireAuth, async (req, res) => {
  const id = (req as any).userId as string;
  const u = await User.findById(id).lean();
  if (!u) return res.status(404).json({ error: 'No encontrado' });
  res.json({
    profile: {
      id: u._id,
      name: u.name,
      email: u.email,
      role: u.role,
      campus: u.campus,
      phone: u.phone || '',
      guardianPhone: u.guardianPhone || '',
      address: u.address || '',
      photoUrl: u.photoUrl || '',
      birthDate: u.birthDate ? new Date(u.birthDate).toISOString().slice(0, 10) : '',
    },
  });
});

// PUT propio (alumno edita sus datos básicos)
router.put('/students/me', requireAuth, async (req, res, next) => {
  try {
    const id = (req as any).userId as string;
    const data = updateMeSchema.parse(req.body);
    const $set: any = { ...data };
    if (data.birthDate) $set.birthDate = new Date(data.birthDate);
    const u = await User.findByIdAndUpdate(id, { $set }, { new: true }).lean();
    res.json({ ok: true, profile: { id: u?._id, name: u?.name, email: u?.email, campus: u?.campus } });
  } catch (e) {
    next(e);
  }
});

/* ========= Lectura/edición por coordinador/admin ========= */

// GET por id
router.get(
  '/students/:id',
  requireAuth,
  allowRoles('coordinator', 'admin', 'teacher'),
  async (req, res) => {
    const u = await User.findById(req.params.id, { passwordHash: 0 }).lean();
    if (!u) return res.status(404).json({ error: 'No encontrado' });
    res.json({ student: toStudentPublic(u) });
  }
);

// PUT por id (coordinador/admin editan cualquier campo básico + campus)
const adminUpdateSchema = updateMeSchema.extend({
  campus: z.enum(['DERQUI', 'JOSE_C_PAZ']).optional(),
});
router.put(
  '/students/:id',
  requireAuth,
  allowRoles('coordinator', 'admin'),
  async (req, res, next) => {
    try {
      const data = adminUpdateSchema.parse(req.body);
      const $set: any = { ...data };
      if (data.birthDate) $set.birthDate = new Date(data.birthDate);
      const u = await User.findByIdAndUpdate(req.params.id, { $set }, { new: true, projection: { passwordHash: 0 } }).lean();
      res.json({ ok: true, student: u ? toStudentPublic(u) : null });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
