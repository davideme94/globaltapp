import { Router } from 'express';
import { requireAuth, allowRoles } from '../middlewares/rbac';
import { Course } from '../models/course';
import { Enrollment } from '../models/enrollment';

const router = Router();

// GET /courses/:courseId/roster -> alumnos activos
router.get('/courses/:courseId/roster', requireAuth, allowRoles('teacher','coordinator','admin'), async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const course = await Course.findById(courseId).lean();
    if (!course) return res.status(404).json({ error: 'Curso no encontrado' });

    const roster = await Enrollment.find({ course: courseId, year: course.year, status: 'active' })
      .populate('student', 'name email')
      .sort({ 'student.name': 1 })
      .lean();

    const simplified = roster.map(r => ({
      _id: r._id,
      student: {
        _id: (r.student as any)._id,
        name: (r.student as any).name,
        email: (r.student as any).email
      }
    }));

    res.json({ roster: simplified });
  } catch (e) { next(e); }
});

export default router;