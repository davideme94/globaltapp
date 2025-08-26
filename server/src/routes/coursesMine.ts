import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middlewares/rbac';
import { Enrollment } from '../models/enrollment';
import { Course } from '../models/course';
import mongoose from 'mongoose';

const router = Router();

/**
 * GET /courses/mine?year=YYYY
 * - student: cursos en los que está inscripto (status=active) ese año (con horarios)
 * - teacher: cursos donde es docente titular ese año (más tolerante con cómo se almacenó teacher)
 * Devuelve { rows, year, meta? }
 */
router.get('/courses/mine', requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).userId as string;
    const role = (req as any).role || (req as any).user?.role || 'student';

    const { year } = z.object({ year: z.coerce.number().int().optional() }).parse(req.query);
    const y = year ?? new Date().getFullYear();

    // -------- ALUMNO --------
    if (role === 'student') {
      const ens = await Enrollment.find({ student: userId, status: 'active', year: y })
        .select('course')
        .lean();

      const ids = ens.map((e) => e.course);
      if (!ids.length) return res.json({ rows: [], year: y, meta: { totalEnrollments: ens.length, years: [y] } });

      const courses = await Course.find({ _id: { $in: ids } })
        .select('_id name year campus teacher')
        .lean();

      // Horarios (si los tenés en otra colección, adaptá acá)
      // Para compat, devolvemos { course, schedule: [] }
      const rows = courses.map((c) => ({ course: c, schedule: [] as any[] }));
      return res.json({ rows, year: y, meta: { totalEnrollments: ens.length, years: [y] } });
    }

    // -------- DOCENTE --------
    if (role === 'teacher') {
      const oid = (() => {
        try { return new mongoose.Types.ObjectId(userId); } catch { return null; }
      })();

      // Tolerante: teacher puede estar como ObjectId, string o poblado {_id: …}
      const teacherMatch: any = {
        $or: [
          { teacher: userId },
          ...(oid ? [{ teacher: oid }] : []),
          { 'teacher._id': userId },
          ...(oid ? [{ 'teacher._id': oid }] : []),
        ],
      };

      const qYear = { year: y };

      // 1) Intento con filtro por año
      let courses = await Course.find({ ...teacherMatch, ...qYear })
        .select('_id name year campus teacher')
        .lean();

      // 2) Si no hay nada, traigo **sin año** para diagnosticar
      let meta: any = { candidates: [userId], years: [y] };
      if (!courses.length) {
        const anyYear = await Course.find({ ...teacherMatch })
          .select('_id name year campus teacher')
          .lean();

        // armo lista de años detectados para debug/UX
        const yearsFound = Array.from(new Set(anyYear.map((c) => c.year))).sort();
        meta = { ...meta, years: yearsFound };

        // Si había cursos en otro año, te devuelvo esos (mejor UX que vacío)
        if (anyYear.length) courses = anyYear;
      }

      return res.json({ rows: courses, year: y, meta });
    }

    // Para coordinator/admin no aplica "mine"
    return res.json({ rows: [], year: y });
  } catch (e) {
    next(e);
  }
});

export default router;
