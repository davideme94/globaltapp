import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, allowRoles } from '../middlewares/rbac';
import { Course } from '../models/course';
import { TopicEntry } from '../models/topic';

const router = Router();

const upsertSchema = z.object({
  courseId: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  topic1: z.string().optional(),
  topic2: z.string().optional(),
  book: z.string().optional(),
  notes: z.string().optional(),
});

// Solo el docente del curso puede editar (coord/admin visualizan)
async function canEdit(userId: string, role: string, courseId: string) {
  if (role !== 'teacher') return false;
  const ok = await Course.exists({ _id: courseId, teacher: userId });
  return !!ok;
}

// PUT /topics  (upsert por curso/fecha)
router.put('/topics', requireAuth, allowRoles('teacher','coordinator','admin'), async (req, res, next) => {
  try {
    const body = upsertSchema.parse(req.body);
    const uid = (req as any).userId as string;
    const role = (req as any).userRole as string;

    if (!(await canEdit(uid, role, body.courseId)))
      return res.status(403).json({ error: 'Solo el docente asignado puede editar' });

    const doc = await TopicEntry.findOneAndUpdate(
      { course: body.courseId, date: body.date },
      { $set: { topic1: body.topic1, topic2: body.topic2, book: body.book, notes: body.notes, createdBy: uid } },
      { new: true, upsert: true }
    ).lean();

    res.json({ ok: true, entry: doc });
  } catch (e) { next(e); }
});

// GET /topics/grid?courseId=...&from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/topics/grid', requireAuth, allowRoles('teacher','coordinator','admin'), async (req, res, next) => {
  try {
    const { courseId, from, to } = req.query as any;
    if (!courseId) return res.status(400).json({ error: 'courseId requerido' });

    const q: any = { course: courseId };
    if (from) q.date = { ...(q.date||{}), $gte: from };
    if (to)   q.date = { ...(q.date||{}), $lte: to };

    const rows = await TopicEntry.find(q).sort({ date: 1 }).lean();
    res.json({ rows });
  } catch (e) { next(e); }
});

export default router;
