import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middlewares/rbac';
import { Enrollment } from '../models/enrollment';
import { Course } from '../models/course';

const router = Router();

/**
 * GET /enrollments/mine?year=2025
 * - student: devuelve inscripciones activas de ese año con el curso populado (básico)
 * - teacher: devuelve cursos donde es titular ese año (compat para el mismo widget)
 */
router.get('/enrollments/mine', requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).userId as string;
    const role = (req as any).role || (req as any).user?.role || 'student';

    const { year } = z
      .object({ year: z.coerce.number().int().optional() })
      .parse(req.query);
    const y = year ?? new Date().getFullYear();

    if (role === 'student') {
      const ens = await Enrollment.find({
        student: userId,
        status: 'active',
        year: y,
      })
        .select('_id course year status')
        .lean();

      const courseIds = ens.map((e) => e.course);
      const courses = await Course.find({ _id: { $in: courseIds } })
        .select('_id name year campus teacher')
        .lean();

      const byId = new Map(courses.map((c) => [String(c._id), c]));
      const rows = ens.map((e) => ({
        enrollmentId: e._id,
        year: e.year,
        status: e.status,
        course: byId.get(String(e.course)) || { _id: e.course },
      }));

      return res.json({ rows, year: y });
    }

    if (role === 'teacher') {
      const courses = await Course.find({ teacher: userId, year: y })
        .select('_id name year campus teacher')
        .lean();

      const rows = courses.map((c) => ({
        enrollmentId: null,
        year: c.year,
        status: 'active',
        course: c,
      }));

      return res.json({ rows, year: y });
    }

    // Para coordinator/admin no hay "mine"
    return res.json({ rows: [], year: y });
  } catch (e) {
    next(e);
  }
});

export default router;

