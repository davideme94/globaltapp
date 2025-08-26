import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, allowRoles } from '../middlewares/rbac';
import { Course } from '../models/course';
import { User } from '../models/user';
import { Enrollment } from '../models/enrollment';

const router = Router();

const campusSchema = z.enum(['DERQUI', 'JOSE_C_PAZ']);

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
          campus: campusSchema.optional()
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
          campus: campusSchema
        })
        .parse(req.body);

      const course = await Course.create({
        name: body.name,
        year: body.year,
        campus: body.campus
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

/** PUT /courses/:id/teacher  -> asigna docente */
router.put(
  '/courses/:id/teacher',
  requireAuth,
  allowRoles('coordinator', 'admin'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
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

/** GET /courses/:id/roster -> { roster } */
router.get(
  '/courses/:id/roster',
  requireAuth,
  allowRoles('coordinator', 'admin', 'teacher'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const rows = await Enrollment.find({ course: id })
        .populate('student', 'name email')
        .lean();

      const roster = rows.map((r: any) => ({
        _id: String(r._id),
        student: r.student
          ? { _id: String(r.student._id), name: r.student.name, email: r.student.email }
          : null
      }));

      res.json({ roster });
    } catch (e) {
      next(e);
    }
  }
);

/** POST /courses/:id/enroll  (por studentId O por email) */
router.post(
  '/courses/:id/enroll',
  requireAuth,
  allowRoles('coordinator', 'admin'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const body = z
        .object({
          studentId: z.string().optional(),
          email: z.string().email().optional(),
          autoCreate: z.boolean().optional()
        })
        .refine((v) => !!(v.studentId || v.email), { message: 'Proveer studentId o email' })
        .parse(req.body || {});

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
          const created = await User.create({
            name: email.split('@')[0],
            email,
            role: 'student',
            campus: 'DERQUI',
            password: hash,
            active: true
          });
          student = created.toObject();
          createdPassword = plain;
        }
        if (!student) return res.status(404).json({ error: 'Alumno no encontrado' });
      }

      const exists = await Enrollment.findOne({ course: id, student: student._id }).lean();
      let enrollment = exists;
      if (!exists) {
        enrollment = await Enrollment.create({ course: id, student: student._id });
      }

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
      await Enrollment.findOneAndDelete({ course: id, student: studentId });
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
      const c = await Course.findById(req.params.id).lean();
      if (!c) return res.status(404).json({ error: 'Curso no encontrado' });
      res.json({ course: { _id: String(c._id), name: c.name, year: c.year }, links: (c as any).links || null });
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
      const body = z.object({ syllabusUrl: z.string().url().optional(), materialsUrl: z.string().url().optional() }).parse(req.body || {});
      const updated = await Course.findByIdAndUpdate(
        req.params.id,
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

/** (opcionales) Schedule del curso: GET/PUT */
router.get(
  '/courses/:id/schedule',
  requireAuth,
  allowRoles('coordinator', 'admin', 'teacher'),
  async (req, res, next) => {
    try {
      const c = await Course.findById(req.params.id).lean();
      if (!c) return res.status(404).json({ error: 'Curso no encontrado' });
      res.json({
        course: { _id: String(c._id), name: c.name, year: c.year },
        schedule: (c as any).schedule || []
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
      const payload = z
        .object({
          schedule: z
            .array(
              z.object({
                day: z.enum(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']),
                start: z.string(),
                end: z.string()
              })
            )
            .default([])
        })
        .parse(req.body || {});
      const updated = await Course.findByIdAndUpdate(
        req.params.id,
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

/** ★★★ NUEVO: Mis cursos (alumno actual) ★★★
 * GET /courses/mine -> { year, rows: [{ course, schedule }] }
 * Filtra por course.year y normaliza schedule (day o dayOfWeek).
 */
router.get(
  '/courses/mine',
  requireAuth,
  async (req: any, res, next) => {
    try {
      const { year } = z.object({ year: z.coerce.number().int().optional() }).parse(req.query);
      const y = year ?? new Date().getFullYear();
      const userId = req.userId as string;

      const enrolls = await Enrollment.find({ student: userId })
        .populate({ path: 'course', select: '_id name year campus schedule', model: Course })
        .lean();

      const mapNumToCode = (n: number) => ['SUN','MON','TUE','WED','THU','FRI','SAT'][n];

      const rows = (enrolls || [])
        .map((e: any) => e.course)
        .filter(Boolean)
        .filter((c: any) => c.year === y)
        .map((c: any) => {
          const sch = Array.isArray(c.schedule) ? c.schedule : [];
          const schedule = sch.map((it: any) => {
            // Soporta ambas formas: { day: 'MON' } o { dayOfWeek: 1 }
            if (it.day) return { day: it.day, start: it.start, end: it.end };
            if (typeof it.dayOfWeek === 'number') {
              const code = mapNumToCode(it.dayOfWeek);
              if (code === 'SUN') return null; // tu front no usa domingo
              return { day: code, start: it.start, end: it.end };
            }
            return null;
          }).filter(Boolean);

          return {
            course: { _id: String(c._id), name: c.name, year: c.year, campus: c.campus },
            schedule
          };
        });

      res.json({ year: y, rows });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
