// src/routes/courses.ts
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, allowRoles } from '../middlewares/rbac';
import { Course } from '../models/course';
import { User } from '../models/user';
import { Enrollment } from '../models/enrollment';

const router = Router();

const campusSchema = z.enum(['DERQUI', 'JOSE_C_PAZ']);

// helper defensivo para rutas con :id (evita que 'mine' intente castearse a ObjectId)
const isObjectId = (s: string) => /^[0-9a-fA-F]{24}$/.test(String(s || ''));

/** GET /courses?year=&campus=  -> { courses } */
router.get(
  '/courses',
  requireAuth,
  allowRoles('coordinator', 'admin', 'teacher'),
  async (req, res, next) => {
    try {
      const q = z
        .object({
          year: z.coerce.number().int().optional(),
          campus: campusSchema.optional(),
        })
        .parse(req.query);

      const where: any = {};
      if (q.year) where.year = q.year;
      if (q.campus) where.campus = q.campus;

      const courses = await Course.find(where)
        .populate('teacher', 'name email')
        .sort({ year: -1, name: 1 })
        .lean();

      res.json({ courses });
    } catch (e) {
      next(e);
    }
  }
);

/** POST /courses  -> { course } */
router.post(
  '/courses',
  requireAuth,
  allowRoles('coordinator', 'admin'),
  async (req, res, next) => {
    try {
      const body = z
        .object({
          name: z.string().min(2),
          year: z.number().int().min(2000).max(3000),
          campus: campusSchema,
        })
        .parse(req.body);

      const course = await Course.create({
        name: body.name,
        year: body.year,
        campus: body.campus,
      });

      const populated = await Course.findById(course._id)
        .populate('teacher', 'name email')
        .lean();

      res.status(201).json({ course: populated });
    } catch (e) {
      next(e);
    }
  }
);

/** ✅ DELETE /courses/:id  -> borra curso y sus inscripciones */
router.delete(
  '/courses/:id',
  requireAuth,
  allowRoles('coordinator', 'admin'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      if (!isObjectId(id)) return res.status(404).json({ error: 'Curso no encontrado' });

      const course = await Course.findById(id).lean();
      if (!course) return res.status(404).json({ error: 'Curso no encontrado' });

      // 1) Borrar inscripciones del curso (todas; si querés limitar por año, agrega year: course.year)
      await Enrollment.deleteMany({ course: id });

      // 2) (Opcional) limpiar otros datos que dependan del curso aquí

      // 3) Borrar el curso
      await Course.deleteOne({ _id: id });

      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  }
);

/** PUT /courses/:id/teacher  -> asigna docente */
router.put(
  '/courses/:id/teacher',
  requireAuth,
  allowRoles('coordinator', 'admin'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      if (!isObjectId(id)) return res.status(404).json({ error: 'Curso no encontrado' });

      const { teacherId } = z.object({ teacherId: z.string() }).parse(req.body);

      const teacher = await User.findOne({ _id: teacherId, role: 'teacher' }).lean();
      if (!teacher) return res.status(404).json({ error: 'Docente no encontrado' });

      const updated = await Course.findByIdAndUpdate(
        id,
        { $set: { teacher: teacher._id } },
        { new: true }
      )
        .populate('teacher', 'name email')
        .lean();

      if (!updated) return res.status(404).json({ error: 'Curso no encontrado' });
      res.json({ ok: true, course: updated });
    } catch (e) {
      next(e);
    }
  }
);

/** GET /courses/:id/roster -> { roster }  (año del curso + activos, ENRIQUECIDO) */
router.get(
  '/courses/:id/roster',
  requireAuth,
  allowRoles('coordinator', 'admin', 'teacher'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      if (!isObjectId(id)) return res.status(404).json({ error: 'Curso no encontrado' });

      const course = await Course.findById(id).lean();
      if (!course) return res.status(404).json({ error: 'Curso no encontrado' });

      const rows = await Enrollment.find({
        course: id,
        year: course.year,
        status: 'active',
      })
        .populate(
          'student',
          'name email phone photoUrl dob birthDate tutor tutorPhone guardianPhone'
        )
        .lean();

      // Acepta dob 'YYYY-MM-DD', 'DD/MM/YYYY' o Date (birthDate)
      const parseDob = (val: any): Date | null => {
        if (!val) return null;
        if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
        if (typeof val === 'string') {
          const s = val.trim();
          // DD/MM/YYYY -> YYYY-MM-DD
          if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
            const [d, m, y] = s.split('/').map(Number);
            const dt = new Date(Date.UTC(y, m - 1, d));
            return isNaN(dt.getTime()) ? null : dt;
          }
          // YYYY-MM-DD (o ISO)
          const dt = new Date(s);
          return isNaN(dt.getTime()) ? null : dt;
        }
        return null;
      };

      const calcAge = (d: Date | null) => {
        if (!d) return null;
        const now = new Date();
        let age = now.getUTCFullYear() - d.getUTCFullYear();
        const m = now.getUTCMonth() - d.getUTCMonth();
        if (m < 0 || (m === 0 && now.getUTCDate() < d.getUTCDate())) age--;
        return age;
      };

      const roster = rows.map((r: any) => {
        const s = r.student;
        const dobDate = parseDob(s?.dob ?? s?.birthDate ?? null);
        const dobISO = dobDate
          ? new Date(
              Date.UTC(dobDate.getUTCFullYear(), dobDate.getUTCMonth(), dobDate.getUTCDate())
            )
              .toISOString()
              .slice(0, 10)
          : null;

        return {
          _id: String(r._id),
          student: s
            ? {
                _id: String(s._id),
                name: s.name,
                email: s.email,
                phone: s.phone || '',
                photoUrl: s.photoUrl || '',
                dob: dobISO,                         // normalizado YYYY-MM-DD
                age: calcAge(dobDate),               // edad calculada (si hay fecha)
                tutor: s.tutor || '',
                tutorName: s.tutor || '',            // compat front que usa tutorName
                tutorPhone: s.tutorPhone || s.guardianPhone || '',
              }
            : null,
        };
      });

      res.json({ roster });
    } catch (e) {
      next(e);
    }
  }
);

/** POST /courses/:id/enroll  (por studentId O por email)  -> upsert (course,student,year) + status:active */
router.post(
  '/courses/:id/enroll',
  requireAuth,
  allowRoles('coordinator', 'admin'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      if (!isObjectId(id)) return res.status(404).json({ error: 'Curso no encontrado' });

      const body = z
        .object({
          studentId: z.string().optional(),
          email: z.string().email().optional(),
          autoCreate: z.boolean().optional(),
        })
        .refine((v) => !!(v.studentId || v.email), { message: 'Proveer studentId o email' })
        .parse(req.body || {});

      const course = await Course.findById(id).lean();
      if (!course) return res.status(404).json({ error: 'Curso no encontrado' });
      const year = course.year;

      let student: any = null;
      let createdPassword: string | undefined;

      if (body.studentId) {
        student = await User.findOne({ _id: body.studentId, role: 'student' }).lean();
        if (!student) return res.status(404).json({ error: 'Alumno no encontrado' });
      } else if (body.email) {
        const email = body.email.toLowerCase();
        student = await User.findOne({ email, role: 'student' }).lean();
        if (!student && (body.autoCreate ?? true)) {
          const plain = Math.random().toString(36).slice(-10) + 'A1';
          const bcrypt = (await import('bcryptjs')).default;
          const hash = await bcrypt.hash(plain, 10);
          const created = await (await import('../models/user')).User.create({
            name: email.split('@')[0],
            email,
            role: 'student',
            campus: 'DERQUI',
            passwordHash: hash,
            active: true,
          } as any);
          student = created.toObject();
          createdPassword = plain;
        }
        if (!student) return res.status(404).json({ error: 'Alumno no encontrado' });
      }

      const enrollment = await Enrollment.findOneAndUpdate(
        { course: id, student: student._id, year },
        { $set: { status: 'active' }, $setOnInsert: { course: id, student: student._id, year } },
        { new: true, upsert: true }
      ).lean();

      res.json({ ok: true, enrollment, createdPassword });
    } catch (e) {
      next(e);
    }
  }
);

/** DELETE /courses/:id/enroll/:studentId  -> desinscribe */
router.delete(
  '/courses/:id/enroll/:studentId',
  requireAuth,
  allowRoles('coordinator', 'admin'),
  async (req, res, next) => {
    try {
      const { id, studentId } = req.params;
      if (!isObjectId(id)) return res.status(404).json({ error: 'Curso no encontrado' });

      const hard = 'hard' in req.query;

      const course = await Course.findById(id).lean();
      if (!course) return res.status(404).json({ error: 'Curso no encontrado' });

      const filter = { course: id, student: studentId, year: course.year };

      if (hard) {
        await Enrollment.deleteOne(filter);
      } else {
        await Enrollment.findOneAndUpdate(filter, { $set: { status: 'inactive' } }, { new: true }).lean();
      }

      try {
        const { PracticeAccess } = await import('../models/practice');
        await PracticeAccess.updateOne(
          { student: studentId },
          { $set: { enabled: false } },
          { upsert: false }
        );
      } catch {}

      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  }
);

/** (opcionales) Links del curso: GET/PUT */
router.get(
  '/courses/:id/links',
  requireAuth,
  allowRoles('coordinator', 'admin', 'teacher'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      if (!isObjectId(id)) return res.status(404).json({ error: 'Curso no encontrado' });

      const c = await Course.findById(id).lean();
      if (!c) return res.status(404).json({ error: 'Curso no encontrado' });
      res.json({
        course: { _id: String(c._id), name: c.name, year: c.year },
        links: (c as any).links || null,
      });
    } catch (e) {
      next(e);
    }
  }
);

router.put(
  '/courses/:id/links',
  requireAuth,
  allowRoles('coordinator', 'admin', 'teacher'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      if (!isObjectId(id)) return res.status(404).json({ error: 'Curso no encontrado' });

      const body = z
        .object({ syllabusUrl: z.string().url().optional(), materialsUrl: z.string().url().optional() })
        .parse(req.body || {});
      const updated = await Course.findByIdAndUpdate(
        id,
        { $set: { links: body } },
        { new: true }
      ).lean();
      if (!updated) return res.status(404).json({ error: 'Curso no encontrado' });
      res.json({ ok: true, links: (updated as any).links || null });
    } catch (e) {
      next(e);
    }
  }
);

/** Schedule del curso: GET/PUT */
router.get(
  '/courses/:id/schedule',
  requireAuth,
  allowRoles('coordinator', 'admin', 'teacher'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      if (!isObjectId(id)) return res.status(404).json({ error: 'Curso no encontrado' });

      const c = await Course.findById(id).lean();
      if (!c) return res.status(404).json({ error: 'Curso no encontrado' });
      res.json({
        course: { _id: String(c._id), name: c.name, year: c.year },
        schedule: (c as any).schedule || [],
      });
    } catch (e) {
      next(e);
    }
  }
);

router.put(
  '/courses/:id/schedule',
  requireAuth,
  allowRoles('coordinator', 'admin'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      if (!isObjectId(id)) return res.status(404).json({ error: 'Curso no encontrado' });

      const payload = z
        .object({
          schedule: z
            .array(
              z.object({
                day: z.enum(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']),
                start: z.string(),
                end: z.string(),
              })
            )
            .default([]),
        })
        .parse(req.body || {});
      const updated = await Course.findByIdAndUpdate(
        id,
        { $set: { schedule: payload.schedule } },
        { new: true }
      ).lean();
      if (!updated) return res.status(404).json({ error: 'Curso no encontrado' });
      res.json({ ok: true, schedule: (updated as any).schedule || [] });
    } catch (e) {
      next(e);
    }
  }
);

/** ★ Mis cursos (alumno actual): GET /courses/mine -> { year, rows:[{course,schedule}] } */
router.get('/courses/mine', requireAuth, async (req: any, res, next) => {
  try {
    const { year } = z.object({ year: z.coerce.number().int().optional() }).parse(req.query);
    const y = year ?? new Date().getFullYear();
    const userId = req.userId as string;

    const enrolls = await Enrollment.find({ student: userId, year: y, status: 'active' })
      .populate({ path: 'course', select: '_id name year campus schedule', model: Course })
      .lean();

    const mapNumToCode = (n: number) =>
      ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][n];

    const rows = (enrolls || [])
      .map((e: any) => e.course)
      .filter(Boolean)
      .map((c: any) => {
        const sch = Array.isArray(c.schedule) ? c.schedule : [];
        const schedule = sch
          .map((it: any) => {
            if (it.day) return { day: it.day, start: it.start, end: it.end };
            if (typeof it.dayOfWeek === 'number') {
              const code = mapNumToCode(it.dayOfWeek);
              if (code === 'SUN') return null;
              return { day: code, start: it.start, end: it.end };
            }
            return null;
          })
          .filter(Boolean);

        return {
          course: { _id: String(c._id), name: c.name, year: c.year, campus: c.campus },
          schedule,
        };
      });

    res.json({ year: y, rows });
  } catch (e) {
    next(e);
  }
});

/* =========================
   NUEVO: Material de alumnos
   ========================= */

// GET /courses/:id/student-materials  -> { course, materials }
router.get(
  '/courses/:id/student-materials',
  requireAuth,
  // lo pueden ver todos los roles autenticados (incluye student)
  allowRoles('coordinator', 'admin', 'teacher', 'student'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      if (!isObjectId(id)) return res.status(404).json({ error: 'Curso no encontrado' });

      const c = await Course.findById(id).lean();
      if (!c) return res.status(404).json({ error: 'Curso no encontrado' });

      const materials = (c as any).studentMaterials || null;
      res.json({
        course: { _id: String(c._id), name: c.name, year: c.year },
        materials,
      });
    } catch (e) {
      next(e);
    }
  }
);

// Aceptamos POST y PUT por compatibilidad
const studentMaterialsSchema = z.object({
  materials: z
    .object({
      studentBook: z.string().url().optional(),
      workbook: z.string().url().optional(),
      reader: z.string().url().optional(),
    })
    .partial()
    .default({}),
});

async function upsertStudentMaterials(req: any, res: any, next: any) {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) return res.status(404).json({ error: 'Curso no encontrado' });

    const body = studentMaterialsSchema.parse(req.body || {});
    const updated = await Course.findByIdAndUpdate(
      id,
      { $set: { studentMaterials: body.materials } },
      { new: true }
    ).lean();

    if (!updated) return res.status(404).json({ error: 'Curso no encontrado' });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

router.post(
  '/courses/:id/student-materials',
  requireAuth,
  allowRoles('coordinator', 'admin', 'teacher'),
  upsertStudentMaterials
);

router.put(
  '/courses/:id/student-materials',
  requireAuth,
  allowRoles('coordinator', 'admin', 'teacher'),
  upsertStudentMaterials
);

/* =========================
   NUEVO: /courses/:id/teacher
   ========================= */
router.get(
  '/courses/:id/teacher',
  requireAuth, // accesible para alumnos
  async (req, res, next) => {
    try {
      const { id } = req.params;
      if (!isObjectId(id)) return res.status(404).json({ error: 'Curso no encontrado' });

      const course = await Course.findById(id)
        .populate('teacher', 'name email photoUrl')
        .lean();
      if (!course) return res.status(404).json({ error: 'Curso no encontrado' });
      return res.json({ teacher: (course as any).teacher || null });
    } catch (e) { next(e); }
  }
);

export default router;

