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

/** GET /courses/:id/roster -> { roster }  (año del curso + activos, ENRIQUECIDO) */
router.get(
  '/courses/:id/roster',
  requireAuth,
  allowRoles('coordinator', 'admin', 'teacher'),
  async (req, res, next) => {
    try {
      const { id } = req.params;

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

/** DELETE /courses/:id/enroll/:studentId  -> desinscribe
 * Soft delete (status:'inactive'). Para borrar duro: ?hard=1
 * Además, deshabilita la práctica del alumno (defensivo).
 */
router.delete(
  '/courses/:id/enroll/:studentId',
  requireAuth,
  allowRoles('coordinator', 'admin'),
  async (req, res, next) => {
    try {
      const { id, studentId } = req.params;
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
      const c = await Course.findById(req.params.id).lean();
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
      const body = z
        .object({ syllabusUrl: z.string().url().optional(), materialsUrl: z.string().url().optional() })
        .parse(req.body || {});
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

/** Schedule del curso: GET/PUT */
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

/** ★★★ NUEVO: Material para alumnos (student-materials) — GET/PUT **/
// GET: accesible también para alumnos para que puedan ver sus links
router.get(
  '/courses/:id/student-materials',
  requireAuth,
  allowRoles('coordinator', 'admin', 'teacher', 'student'),
  async (req, res, next) => {
    try {
      const c = await Course.findById(req.params.id)
        .select('name year studentMaterials')
        .setOptions({ strict: false })
        .lean();
      if (!c) return res.status(404).json({ error: 'Curso no encontrado' });

      const sm = (c as any).studentMaterials || {};
      res.json({
        course: { _id: String(c._id), name: c.name, year: c.year },
        studentMaterials: {
          studentBook: sm.studentBook || '',
          workbook: sm.workbook || '',
          reader: sm.reader || '',
        },
      });
    } catch (e) { next(e); }
  }
);

// PUT: solo coord/admin editan
router.put(
  '/courses/:id/student-materials',
  requireAuth,
  allowRoles('coordinator', 'admin'),
  async (req, res, next) => {
    try {
      const body = z
        .object({
          studentBook: z.string().optional(),
          workbook: z.string().optional(),
          reader: z.string().optional(),
        })
        .parse(req.body || {});

      const updated = await Course.findByIdAndUpdate(
        req.params.id,
        {
          $set: {
            'studentMaterials.studentBook': String(body.studentBook ?? ''),
            'studentMaterials.workbook': String(body.workbook ?? ''),
            'studentMaterials.reader': String(body.reader ?? ''),
          },
        },
        { new: true, strict: false }
      ).select('studentMaterials').lean();

      if (!updated) return res.status(404).json({ error: 'Curso no encontrado' });

      const sm = (updated as any).studentMaterials || {};
      res.json({
        ok: true,
        studentMaterials: {
          studentBook: sm.studentBook || '',
          workbook: sm.workbook || '',
          reader: sm.reader || '',
        },
      });
    } catch (e) { next(e); }
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
   NUEVO: /courses/:id/teacher
   ========================= */
// GET /courses/:id/teacher -> { teacher }
router.get(
  '/courses/:id/teacher',
  requireAuth, // accesible para alumnos
  async (req, res, next) => {
    try {
      const course = await Course.findById(req.params.id)
        .populate('teacher', 'name email photoUrl')
        .lean();
      if (!course) return res.status(404).json({ error: 'Curso no encontrado' });
      return res.json({ teacher: (course as any).teacher || null });
    } catch (e) { next(e); }
  }
);

export default router;
