import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, allowRoles } from '../middlewares/rbac';
import { Course } from '../models/course';
import { Enrollment } from '../models/enrollment';
import { ReportCard } from '../models/reportCard';
import { User } from '../models/user';

const router = Router();

const condEnum = z.enum([
  'APPROVED',
  'FAILED_ORAL',
  'FAILED_WRITTEN',
  'FAILED_BOTH',
  'PASSED_INTERNAL',
  'REPEATER',
]);

const g10 = z.number().min(1).max(10).nullable();

const term = z.object({
  writing: g10.optional(),
  speaking: g10.optional(),
  reading: g10.optional(),
  listening: g10.optional(),
  comments: z.string().max(2000).optional(),
});

const upsertSchema = z.object({
  courseId: z.string(),
  studentId: z.string(),
  t1: term.optional(),
  t2: term.optional(),
  t3: term.optional(),
  examOral: z.number().min(0).max(100).nullable().optional(),
  examWritten: z.number().min(0).max(100).nullable().optional(),
  finalOral: z.number().min(0).max(100).nullable().optional(),
  finalWritten: z.number().min(0).max(100).nullable().optional(),
  condition: condEnum.optional(),
  comments: z.string().max(2000).optional(),
});

async function ensureCourseAccess(role: string, userId: string, courseId: string) {
  if (role === 'teacher') {
    const ok = await Course.exists({ _id: courseId, teacher: userId });
    return !!ok;
  }
  return true;
}

/** Grilla por curso */
router.get(
  '/reportcards/course/:courseId',
  requireAuth,
  allowRoles('teacher', 'coordinator', 'admin'),
  async (req, res, next) => {
    try {
      const { courseId } = req.params;
      const role = (req as any).role || (req as any).userRole;
      const userId = (req as any).userId as string;

      if (!(await ensureCourseAccess(role, userId, courseId))) {
        return res.status(403).json({ error: 'No autorizado' });
      }

      const course = await Course.findById(courseId).lean();
      if (!course) return res.status(404).json({ error: 'Curso no encontrado' });
      const year = course.year;

      // No filtramos por year/status en Enrollment (suele no existir)
      const roster = await Enrollment.find({ course: courseId })
        .populate('student', '_id name email campus')
        .lean();

      const cards = await ReportCard.find({ course: courseId, year }).lean();
      const map = new Map<string, any>();
      for (const c of cards) map.set(String(c.student), c);

      const rows = roster
        .map((r: any) => ({
          student: r.student
            ? { _id: String(r.student._id), name: r.student.name, email: r.student.email }
            : null,
          card: r.student ? map.get(String(r.student._id)) || null : null,
        }))
        .sort((a, b) => (a.student?.name || '').localeCompare(b.student?.name || ''));

      res.json({ course: { id: String(course._id), name: course.name, year }, rows });
    } catch (e) {
      next(e);
    }
  }
);

/** Upsert por alumno */
router.put(
  '/reportcards',
  requireAuth,
  allowRoles('teacher', 'coordinator', 'admin'),
  async (req, res, next) => {
    try {
      const payload = upsertSchema.parse(req.body);
      const role = (req as any).role || (req as any).userRole;
      const userId = (req as any).userId as string;

      if (!(await ensureCourseAccess(role, userId, payload.courseId))) {
        return res.status(403).json({ error: 'No autorizado' });
      }

      const course = await Course.findById(payload.courseId).lean();
      if (!course) return res.status(404).json({ error: 'Curso no encontrado' });
      const year = course.year;

      // ⚠️ NO seteamos `year` en $set para evitar conflicto con $setOnInsert/filtro
      const $set: any = { teacher: userId };
      if (payload.t1) $set.t1 = { ...payload.t1 };
      if (payload.t2) $set.t2 = { ...payload.t2 };
      if (payload.t3) $set.t3 = { ...payload.t3 };
      if ('examOral' in payload) $set.examOral = payload.examOral ?? null;
      if ('examWritten' in payload) $set.examWritten = payload.examWritten ?? null;
      if ('finalOral' in payload) $set.finalOral = payload.finalOral ?? null;
      if ('finalWritten' in payload) $set.finalWritten = payload.finalWritten ?? null;
      if (payload.condition) $set.condition = payload.condition;
      if ('comments' in payload) $set.comments = payload.comments ?? '';

      const doc = await ReportCard.findOneAndUpdate(
        { student: payload.studentId, course: payload.courseId, year },
        {
          $set,
          $setOnInsert: { student: payload.studentId, course: payload.courseId, year },
        },
        { new: true, upsert: true }
      ).lean();

      res.json({ card: doc });
    } catch (e) {
      next(e);
    }
  }
);

/** Mis boletines (alumno) */
router.get(
  '/reportcards/mine',
  requireAuth,
  allowRoles('student'),
  async (req, res, next) => {
    try {
      const userId = (req as any).userId as string;
      const rows = await ReportCard.find({ student: userId })
        .sort({ year: -1 })
        .populate('course', 'name year')
        .lean();
      res.json({ cards: rows });
    } catch (e) {
      next(e);
    }
  }
);

/** Boletines de un alumno (staff) */
router.get(
  '/reportcards/student/:studentId',
  requireAuth,
  allowRoles('teacher', 'coordinator', 'admin'),
  async (req, res, next) => {
    try {
      const { studentId } = req.params;
      const rows = await ReportCard.find({ student: studentId })
        .sort({ year: -1 })
        .populate('course', 'name year')
        .lean();
      res.json({ cards: rows });
    } catch (e) {
      next(e);
    }
  }
);

/** Detalle para impresión */
router.get(
  '/reportcards/detail',
  requireAuth,
  allowRoles('teacher', 'coordinator', 'admin', 'student'),
  async (req, res, next) => {
    try {
      const { courseId, studentId } = (req.query as any) as {
        courseId?: string;
        studentId?: string;
      };
      if (!courseId || !studentId) {
        return res.status(400).json({ error: 'courseId y studentId requeridos' });
      }

      const role = (req as any).role || (req as any).userRole;
      const uid = (req as any).userId as string;

      if (role === 'teacher') {
        const ok = await Course.exists({ _id: courseId, teacher: uid });
        if (!ok) return res.status(403).json({ error: 'No autorizado' });
      }
      if (role === 'student' && uid !== studentId) {
        return res.status(403).json({ error: 'No autorizado' });
      }

      const course = await Course.findById(courseId).populate('teacher', 'name').lean();
      if (!course) return res.status(404).json({ error: 'Curso no encontrado' });

      const student = await User.findById(studentId).lean();
      if (!student) return res.status(404).json({ error: 'Alumno no encontrado' });

      const year = course.year;
      const card = await ReportCard.findOne({ student: studentId, course: courseId, year }).lean();

      res.json({
        student: { id: student._id, name: student.name, campus: student.campus },
        course: { id: course._id, name: course.name, year: course.year, campus: course.campus },
        teacher: {
          id: (course.teacher as any)?._id ?? null,
          name: (course.teacher as any)?.name ?? '',
        },
        report: card ?? null,
      });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
