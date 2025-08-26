import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, allowRoles } from '../middlewares/rbac';
import { Course } from '../models/course';
import { CourseSchedule } from '../models/courseSchedule';

const router = Router();

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
const dayEnum = z.enum(['MON','TUE','WED','THU','FRI','SAT']);

const scheduleSchema = z.object({
  schedule: z.array(z.object({
    day: dayEnum,
    start: z.string().regex(timeRegex, 'Formato HH:MM'),
    end:   z.string().regex(timeRegex, 'Formato HH:MM'),
  })).max(12),
});

/** Obtener horarios (cualquier rol autenticado) */
router.get('/courses/:courseId/schedule', requireAuth, async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const course = await Course.findById(courseId).lean();
    if (!course) return res.status(404).json({ error: 'Curso no encontrado' });

    const doc = await CourseSchedule.findOne({ course: courseId }).lean();
    res.json({
      course: { _id: String(course._id), name: course.name, year: course.year },
      schedule: doc?.items ?? [],
    });
  } catch (e) { next(e); }
});

/** Guardar horarios (coord/admin) */
router.put('/courses/:courseId/schedule', requireAuth, allowRoles('coordinator','admin'), async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const body = scheduleSchema.parse(req.body);

    const course = await Course.findById(courseId).lean();
    if (!course) return res.status(404).json({ error: 'Curso no encontrado' });

    // ordenar por día (Lunes a Sábado)
    const order: Record<string, number> = { MON:1, TUE:2, WED:3, THU:4, FRI:5, SAT:6 };
    const items = body.schedule.slice().sort((a,b)=>order[a.day]-order[b.day]);

    const doc = await CourseSchedule.findOneAndUpdate(
      { course: courseId },
      { $set: { items } },
      { new: true, upsert: true }
    ).lean();

    res.json({ ok: true, schedule: doc?.items ?? [] });
  } catch (e) { next(e); }
});

export default router;
