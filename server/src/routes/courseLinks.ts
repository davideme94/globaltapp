import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, allowRoles } from '../middlewares/rbac';
import { Course } from '../models/course';
import { CourseLinks } from '../models/courseLinks';

const router = Router();

const setSchema = z.object({
  syllabusUrl: z.string().url().optional().or(z.literal('')),
  materialsUrl: z.string().url().optional().or(z.literal('')),
});

// GET /courses/:courseId/links
router.get('/courses/:courseId/links', requireAuth, allowRoles('teacher','coordinator','admin'), async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const course = await Course.findById(courseId).lean();
    if (!course) return res.status(404).json({ error: 'Curso no encontrado' });
    const links = await CourseLinks.findOne({ course: courseId }).lean();
    res.json({ course: { _id: course._id, name: course.name, year: course.year }, links: links || null });
  } catch (e) { next(e); }
});

// PUT /courses/:courseId/links  (coord/admin)
router.put('/courses/:courseId/links', requireAuth, allowRoles('coordinator','admin'), async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const body = setSchema.parse(req.body);
    const uid = (req as any).userId as string;

    const course = await Course.exists({ _id: courseId });
    if (!course) return res.status(404).json({ error: 'Curso no encontrado' });

    const doc = await CourseLinks.findOneAndUpdate(
      { course: courseId },
      { $set: { syllabusUrl: body.syllabusUrl || undefined, materialsUrl: body.materialsUrl || undefined, updatedBy: uid } },
      { new: true, upsert: true }
    ).lean();

    res.json({ ok: true, links: doc });
  } catch (e) { next(e); }
});

export default router;
