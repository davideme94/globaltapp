import { Router } from 'express';
import { z } from 'zod';
import { allowRoles, requireAuth } from '../middlewares/rbac';
import { User } from '../models/user';

/* ➕ NUEVO: para el endpoint enriquecido */
import { Course } from '../models/course';
import { Enrollment } from '../models/enrollment';

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

/* ========= NUEVO: endpoint enriquecido para “Buscar alumno” ========= */
/**
 * GET /students/courses?q=&year=&campus=
 * Devuelve alumnos con sus cursos del año y el DOCENTE (con photoUrl).
 * No reemplaza nada existente: es un agregado seguro.
 */
router.get(
  '/students/courses',
  requireAuth,
  allowRoles('coordinator', 'admin', 'teacher'),
  async (req, res, next) => {
    try {
      const q = (req.query.q as string | undefined)?.trim().toLowerCase() || '';
      const year = Number(req.query.year) || new Date().getFullYear();
      const campus = (req.query.campus as 'DERQUI' | 'JOSE_C_PAZ' | undefined) || undefined;

      // 1) Cursos del año (+ campus si vino), con docente poblado (name + photoUrl)
      const cWhere: any = { year };
      if (campus) cWhere.campus = campus;

      const courses = await Course.find(cWhere)
        .select('_id name year campus teacher')
        .populate('teacher', 'name photoUrl')
        .lean();

      const courseIds = courses.map(c => c._id);
      const courseMap = new Map<string, any>(
        courses.map(c => [
          String(c._id),
          {
            _id: String(c._id),
            name: c.name,
            year: c.year,
            campus: c.campus,
            teacher: c.teacher
              ? {
                  _id: String((c.teacher as any)._id),
                  name: (c.teacher as any).name,
                  photoUrl: (c.teacher as any).photoUrl || null,
                }
              : null,
          },
        ])
      );

      // 2) Inscripciones activas, con datos básicos del alumno
      const enrolls = await Enrollment.find({
        course: { $in: courseIds },
        status: 'active',
      })
        .populate('student', 'name email photoUrl dob phone tutor tutorPhone guardianPhone campus')
        .select('course student')
        .lean();

      // 3) Agrupamos por alumno + filtro q si vino
      const byStudent = new Map<string, any>();
      for (const e of enrolls) {
        const s = e.student as any;
        if (!s?._id) continue;

        if (
          q &&
          !(`${s.name || ''} ${s.email || ''}`.toLowerCase().includes(q))
        ) {
          continue;
        }

        const sid = String(s._id);
        if (!byStudent.has(sid)) {
          byStudent.set(sid, {
            _id: sid,
            name: s.name,
            email: s.email || '',
            photoUrl: s.photoUrl || null,
            dob: s.dob ?? null,
            phone: s.phone || '',
            tutor: s.tutor || '',
            tutorPhone: s.tutorPhone || s.guardianPhone || '',
            campus: s.campus,
            courses: [] as any[],
          });
        }
        const row = byStudent.get(sid);
        const cinfo = courseMap.get(String(e.course));
        if (cinfo && !row.courses.find((x: any) => x._id === cinfo._id)) {
          row.courses.push(cinfo);
        }
      }

      const rows = Array.from(byStudent.values()).sort((a, b) =>
        String(a.name).localeCompare(String(b.name), 'es', { sensitivity: 'base' })
      );

      res.json({ year, rows });
    } catch (e) {
      next(e);
    }
  }
);

/* ========= Endpoints ya existentes (se mantienen igual) ========= */

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
      // where.active = true; // si quisieras solo activos

      const rows = await User.find(where, { passwordHash: 0 })
        .sort({ name: 1 })
        .limit(20)
        .lean();

      const payload = rows.map(toStudentPublic);
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

// PUT por id (coordinador/admin)
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
      const u = await User.findByIdAndUpdate(
        req.params.id,
        { $set },
        { new: true, projection: { passwordHash: 0 } }
      ).lean();
      res.json({ ok: true, student: u ? toStudentPublic(u) : null });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
