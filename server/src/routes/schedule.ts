// server/src/routes/schedule.ts
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, allowRoles } from '../middlewares/rbac';
import { Types } from 'mongoose';
import { Course } from '../models/course'; // nombre usual; si tu modelo se llama distinto, ajustalo

const router = Router();

// Códigos válidos de día
const DayCode = z.enum(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']);
// HH:MM (24h)
const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

// Item de horario
const scheduleItemSchema = z.object({
  day: DayCode.optional(),               // <-- importante: soportamos y guardamos el día
  start: z.string().regex(timeRegex),
  end: z.string().regex(timeRegex),
});

const payloadSchema = z.object({
  schedule: z.array(scheduleItemSchema),
});

// ------- GET /courses/:courseId/schedule
router.get(
  '/courses/:courseId/schedule',
  requireAuth,
  allowRoles('coordinator', 'admin', 'teacher', 'student'),
  async (req: any, res, next) => {
    try {
      const { courseId } = req.params;
      if (!Types.ObjectId.isValid(courseId)) {
        return res.status(400).json({ error: 'courseId inválido' });
      }
      const course = await Course.findById(courseId, { name: 1, year: 1, schedule: 1 }).lean();
      if (!course) return res.status(404).json({ error: 'Curso no encontrado' });

      // Normalizamos por si hay items antiguos sin "day"
      const schedule = Array.isArray((course as any).schedule) ? (course as any).schedule : [];
      const normalized = schedule
        .filter((it: any) => it && it.start && it.end) // evitamos basura
        .map((it: any) => ({
          day: it.day ?? it.dayCode ?? undefined, // compat si alguien guardó dayCode
          start: it.start,
          end: it.end,
        }));

      return res.json({
        course: { _id: String((course as any)._id), name: course.name, year: course.year },
        schedule: normalized,
      });
    } catch (e) {
      next(e);
    }
  }
);

// ------- PUT /courses/:courseId/schedule
router.put(
  '/courses/:courseId/schedule',
  requireAuth,
  allowRoles('coordinator', 'admin', 'teacher'),
  async (req: any, res, next) => {
    try {
      const { courseId } = req.params;
      if (!Types.ObjectId.isValid(courseId)) {
        return res.status(400).json({ error: 'courseId inválido' });
      }

      const body = payloadSchema.parse(req.body || {});

      // Sanitizamos: solo day/start/end
      const items = body.schedule.map((i) => ({
        ...(i.day ? { day: i.day } : {}), // si no viene, no forzamos
        start: i.start,
        end: i.end,
      }));

      const course = await Course.findById(courseId);
      if (!course) return res.status(404).json({ error: 'Curso no encontrado' });

      (course as any).schedule = items;
      course.markModified('schedule');
      await course.save();

      return res.json({ ok: true, schedule: items });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
