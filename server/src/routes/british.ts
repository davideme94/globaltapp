// server/src/routes/british.ts
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middlewares/rbac';
import { BritishExam } from '../models/britishExam';
import { Course } from '../models/course';
import { User } from '../models/user';

const router = Router();

// ---------- helpers ----------
const qYearSchema = z.object({ year: z.coerce.number().int().optional() });
const upsertSchema = z.object({
  courseId: z.string().min(1),
  studentId: z.string().min(1),
  provider: z.enum(['TRINITY', 'CAMBRIDGE', 'BRITANICO']).optional(),
  oral: z.coerce.number().min(0).max(100).nullable().optional(),
  written: z.coerce.number().min(0).max(100).nullable().optional(),
  year: z.coerce.number().int().optional(),
});

const getUserId = (req: any) =>
  (req.userId ?? req.user?._id ?? req.user?.id ?? req.session?.userId) as string | undefined;

const getRoleLoose = (req: any) =>
  (req.role ??
    req.user?.role ??
    req.auth?.role ??
    req.session?.user?.role ??
    req.session?.role) as string | undefined;

// fallback: si no hay rol en la request, lo leo de la DB
async function resolveRole(req: any): Promise<string | undefined> {
  let role = getRoleLoose(req);
  if (role) return role;
  const uid = getUserId(req);
  if (!uid) return undefined;
  const u = await User.findById(uid).select('role').lean();
  return u?.role as string | undefined;
}

// ---------- Rutas ----------

/** GET /british/mine (alumno) */
router.get('/british/mine', requireAuth, async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const { year } = qYearSchema.parse(req.query);

    const filter: any = { student: userId };
    if (year) filter.year = year;

    const rows = await BritishExam.find(filter)
      .populate('course', '_id name year')
      .lean();

    res.json({ results: rows });
  } catch (e) { next(e); }
});

/** GET /british/course/:courseId (coordinator/teacher/admin) */
router.get('/british/course/:courseId', requireAuth, async (req, res, next) => {
  try {
    const role = await resolveRole(req);
    if (!['coordinator', 'teacher', 'admin'].includes(role || '')) {
      return res.status(403).json({ error: 'forbidden', reason: 'roleNotAllowed', role });
    }

    const { courseId } = z.object({ courseId: z.string().min(1) }).parse(req.params);
    const { year } = qYearSchema.parse(req.query);
    const y = year ?? new Date().getFullYear();

    // Si es teacher, validar que sea su curso
    if (role === 'teacher') {
      const c = await Course.findById(courseId).lean();
      if (!c) return res.status(404).json({ error: 'course not found' });
      if (String(c.teacher) !== String(getUserId(req))) {
        return res.status(403).json({ error: 'forbidden', reason: 'teacherNotOwner' });
      }
    }

    const rows = await BritishExam.find({ course: courseId, year: y })
      .populate('student', '_id name email')
      .populate('course', '_id name year')
      .lean();

    res.json({ rows, year: y });
  } catch (e) { next(e); }
});

/** PUT /british (coordinator/teacher/admin) */
router.put('/british', requireAuth, async (req, res, next) => {
  try {
    const role = await resolveRole(req);
    const userId = getUserId(req);

    if (!['coordinator', 'teacher', 'admin'].includes(role || '')) {
      return res.status(403).json({ error: 'forbidden', reason: 'roleNotAllowed', role });
    }

    const body = upsertSchema.parse(req.body);
    const y = body.year ?? new Date().getFullYear();

    // Si es teacher, validar que sea su curso
    if (role === 'teacher') {
      const c = await Course.findById(body.courseId).lean();
      if (!c) return res.status(404).json({ error: 'course not found' });
      if (String(c.teacher) !== String(userId)) {
        return res.status(403).json({ error: 'forbidden', reason: 'teacherNotOwner' });
      }
    }

    const $set: any = {
      updatedBy: userId,
      year: y,
      provider: body.provider ?? 'BRITANICO',
    };
    if ('oral' in body)    $set.oral    = body.oral ?? null;
    if ('written' in body) $set.written = body.written ?? null;

    const result = await BritishExam.findOneAndUpdate(
      { student: body.studentId, course: body.courseId, year: y },
      { $set, $setOnInsert: { student: body.studentId, course: body.courseId } },
      { new: true, upsert: true }
    ).lean();

    res.json({ ok: true, result });
  } catch (e) { next(e); }
});

export default router;
