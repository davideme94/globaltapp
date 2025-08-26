import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, allowRoles } from '../middlewares/rbac';
import { PartialReport } from '../models/partialReport';
import { Course } from '../models/course';
import { Enrollment } from '../models/enrollment';

const router = Router();

/* ===== Schemas ===== */
const Term = z.enum(['MAY', 'OCT']);
const Grade = z.enum(['A', 'B', 'C', 'D', 'E']);

const gradesSchema = z.object({
  reading: Grade,
  writing: Grade,
  listening: Grade,
  speaking: Grade,
  attendance: Grade,
  commitment: Grade,
});

const upsertSchema = z.object({
  courseId: z.string().min(1),
  studentId: z.string().min(1),
  term: Term,
  grades: gradesSchema,
  comments: z.string().max(2000).optional(),
  year: z.coerce.number().int().optional(), // opcional; por defecto toma el del curso
});

/* ===== Helpers ===== */
async function ensureCourseAccess(role: string, userId: string, courseId: string) {
  if (role === 'teacher') {
    const ok = await Course.exists({ _id: courseId, teacher: userId });
    return !!ok;
  }
  return true;
}

function defaultTerm(): 'MAY' | 'OCT' {
  return new Date().getMonth() < 8 ? 'MAY' : 'OCT';
}

/* =============================================================================
 * 1) ALUMNO: mis informes
 * GET /partials/mine  -> { rows: PartialReport[], reports: PartialReport[] }
 * ========================================================================== */
router.get(
  '/partials/mine',
  requireAuth,
  // permitimos también staff para debug, pero filtra por student=yo
  allowRoles('student', 'teacher', 'coordinator', 'admin'),
  async (req, res, next) => {
    try {
      const userId = (req as any).userId as string;
      const rows = await PartialReport.find({ student: userId })
        .sort({ year: -1, term: 1 })
        .populate('course', '_id name year')
        .lean();

      // Devolvemos rows y reports para compatibilidad
      res.json({ rows, reports: rows });
    } catch (e) {
      next(e);
    }
  }
);

/* =============================================================================
 * 2) STAFF: ver curso (con roster) + parciales del term
 * GET /partials/course/:courseId?term=MAY|OCT&year=YYYY
 * -> { course:{ id,name,year,term }, rows:[{ student, partial|null }], year }
 * ========================================================================== */
router.get(
  '/partials/course/:courseId',
  requireAuth,
  allowRoles('teacher', 'coordinator', 'admin'),
  async (req, res, next) => {
    try {
      const role = (req as any).role || (req as any).userRole;
      const userId = (req as any).userId as string;
      const { courseId } = z.object({ courseId: z.string().min(1) }).parse(req.params);
      const { term, year } = z
        .object({
          term: Term.optional(),
          year: z.coerce.number().int().optional(),
        })
        .parse(req.query);

      if (!(await ensureCourseAccess(role, userId, courseId))) {
        return res.status(403).json({ error: 'No autorizado' });
      }

      const course = await Course.findById(courseId).lean();
      if (!course) return res.status(404).json({ error: 'Curso no encontrado' });

      const y = year ?? course.year;
      const t = term ?? defaultTerm();

      // roster del curso
      const roster = await Enrollment.find({ course: courseId })
        .populate('student', '_id name email')
        .lean();

      // parciales de ese term
      const prs = await PartialReport.find({ course: courseId, year: y, term: t })
        .lean();
      const byStudent = new Map<string, any>();
      prs.forEach((p) => byStudent.set(String(p.student), p));

      const rows = roster
        .map((r: any) => ({
          student: r.student ? { _id: String(r.student._id), name: r.student.name } : null,
          partial: r.student ? byStudent.get(String(r.student._id)) ?? null : null,
        }))
        .sort((a, b) => (a.student?.name || '').localeCompare(b.student?.name || ''));

      res.json({
        course: { id: String(course._id), name: course.name, year: y, term: t },
        rows,
        year: y,
      });
    } catch (e) {
      next(e);
    }
  }
);

/* =============================================================================
 * 3) STAFF: guardar (upsert)
 * PUT /partials  body: { courseId, studentId, term, grades, comments?, year? }
 * Unique por (student, course, year, term)
 * ========================================================================== */
router.put(
  '/partials',
  requireAuth,
  allowRoles('teacher', 'coordinator', 'admin'),
  async (req, res, next) => {
    try {
      const payload = upsertSchema.parse(req.body || {});
      const role = (req as any).role || (req as any).userRole;
      const userId = (req as any).userId as string;

      if (!(await ensureCourseAccess(role, userId, payload.courseId))) {
        return res.status(403).json({ error: 'No autorizado' });
      }

      // año a usar
      const course = await Course.findById(payload.courseId).lean();
      if (!course) return res.status(404).json({ error: 'Curso no encontrado' });
      const y = payload.year ?? course.year;

      // upsert
      const doc = await PartialReport.findOneAndUpdate(
        {
          student: payload.studentId,
          course: payload.courseId,
          year: y,
          term: payload.term,
        },
        {
          $set: {
            teacher: userId,
            grades: payload.grades,
            comments: payload.comments ?? '',
          },
          $setOnInsert: {
            student: payload.studentId,
            course: payload.courseId,
            year: y,
            term: payload.term,
          },
        },
        { new: true, upsert: true }
      ).lean();

      res.json({ ok: true, report: doc });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
