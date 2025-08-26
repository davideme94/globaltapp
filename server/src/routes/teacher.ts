import { Router } from 'express';
import { requireRole } from '../middlewares/auth';
import { Course } from '../models/course';

const router = Router();

// Cursos asignados al docente autenticado
router.get('/teacher/courses', requireRole('teacher'), async (req, res, next) => {
  try {
    const teacherId = (req as any).user?._id;
    const year = req.query.year ? Number(req.query.year) : undefined;

    const filter: any = { teacher: teacherId };
    if (year) filter.year = year;

    const courses = await Course.find(filter)
      .populate('teacher', 'name email')
      .sort({ year: -1, name: 1 })
      .lean();

    res.json({ courses });
  } catch (e) {
    next(e);
  }
});

export default router;
