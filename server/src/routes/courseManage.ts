import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

import { requireAuth, allowRoles } from '../middlewares/rbac';
import { Course } from '../models/course';
import { Enrollment } from '../models/enrollment';
import { User } from '../models/user';

const router = Router();

/** Buscar usuarios por rol (coordinador/admin) */
router.get(
  '/users/search',
  requireAuth,
  allowRoles('coordinator', 'admin'),
  async (req, res, next) => {
    try {
      const role = String(req.query.role || '').trim();
      const q = String(req.query.q || '').trim();
      if (!role) return res.status(400).json({ error: 'role requerido' });

      const filter: any = { role };
      if (q) {
        filter.$or = [
          { name: { $regex: q, $options: 'i' } },
          { email: { $regex: q, $options: 'i' } },
        ];
      }

      const rows = await User.find(filter)
        .select('_id name email role')
        .limit(20)
        .lean();

      res.json({ rows });
    } catch (e) {
      next(e);
    }
  }
);

/** Asignar docente al curso */
router.put(
  '/courses/:courseId/teacher',
  requireAuth,
  allowRoles('coordinator', 'admin'),
  async (req, res, next) => {
    try {
      const { courseId } = req.params;
      const { teacherId } = z.object({ teacherId: z.string().min(1) }).parse(req.body);

      const teacher = await User.findOne({ _id: teacherId, role: 'teacher' }).lean();
      if (!teacher) return res.status(404).json({ error: 'Docente no encontrado' });

      const course = await Course.findByIdAndUpdate(
        courseId,
        { $set: { teacher: teacherId } },
        { new: true }
      ).lean();
      if (!course) return res.status(404).json({ error: 'Curso no encontrado' });

      res.json({ ok: true, course });
    } catch (e) {
      next(e);
    }
  }
);

/* ===== Helpers para alta por email ===== */
const EnrollBody = z.union([
  z.object({ studentId: z.string().min(1) }),
  z.object({ email: z.string().email(), autoCreate: z.boolean().optional() }),
]);

function genPassword(len = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

/** Matricular alumno (por ID o por email con autoCreate) */
router.post(
  '/courses/:courseId/enroll',
  requireAuth,
  allowRoles('coordinator', 'admin'),
  async (req, res, next) => {
    try {
      const { courseId } = req.params;
      const body = EnrollBody.parse(req.body);

      const course = await Course.findById(courseId).lean();
      if (!course) return res.status(404).json({ error: 'Curso no encontrado' });

      let studentId: string;
      let createdPassword: string | undefined;

      if ('studentId' in body) {
        // Inscripción por ID existente
        const stu = await User.findOne({ _id: body.studentId, role: 'student' }).lean();
        if (!stu) return res.status(404).json({ error: 'Alumno no encontrado' });
        studentId = String(stu._id);
      } else {
        // Inscripción por email (y opcional autoCreate)
        const email = body.email.trim().toLowerCase();
        let u = await User.findOne({ email }).lean();

        if (!u && body.autoCreate) {
          const plain = genPassword();
          const passwordHash = await bcrypt.hash(plain, 10);
          const nameFromEmail = email.split('@')[0].replace(/[._-]/g, ' ');
          u = (await User.create({
            name: nameFromEmail,
            email,
            role: 'student',
            campus: (course as any).campus || 'DERQUI',
            passwordHash, // coincide con el schema
            active: true,
          })).toObject();
          createdPassword = plain;
        }

        if (!u) return res.status(404).json({ error: 'Alumno no encontrado' });
        studentId = String(u._id);
      }

      // ================= CLAVE DEL FIX =================
      // Si hay validadores en updates (runValidators on update),
      // aseguramos que year (requerido) viaje en el update doc.
      const filter = { course: courseId, student: studentId, year: course.year };
      await Enrollment.updateOne(
        filter,
        {
          $set: {
            status: 'active',
            course: courseId,
            student: studentId,
            year: course.year,   // <- garantizamos year en el update
          },
        },
        { upsert: true }
      );

      const enrollment = await Enrollment.findOne(filter).lean();
      // =================================================

      res.status(201).json({ ok: true, enrollment, createdPassword });
    } catch (e) {
      next(e);
    }
  }
);

/** Dar de baja alumno (marcamos inactivo) */
router.delete(
  '/courses/:courseId/enroll/:studentId',
  requireAuth,
  allowRoles('coordinator', 'admin'),
  async (req, res, next) => {
    try {
      const { courseId, studentId } = req.params;

      const course = await Course.findById(courseId).lean();
      if (!course) return res.status(404).json({ error: 'Curso no encontrado' });

      await Enrollment.updateOne(
        { course: courseId, student: studentId, year: course.year },
        { $set: { status: 'inactive' } }
      );

      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
