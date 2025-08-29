import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, allowRoles } from '../middlewares/rbac';
import { User } from '../models/user';

const router = Router();

const campusSchema = z.enum(['DERQUI', 'JOSE_C_PAZ']);

// ✅ Aceptamos URL ABSOLUTA (http/https) o RELATIVA que empiece con /uploads/
const photoUrlSchema = z
  .string()
  .min(1)
  .refine(
    (v) => /^https?:\/\//i.test(v) || v.startsWith('/uploads/'),
    { message: 'Invalid url' }
  );

// Campos permitidos a editar por el dueño del perfil.
const payloadSchema = z.object({
  name: z.string().min(2).optional(),
  campus: campusSchema.optional(),
  phone: z.string().max(40).optional(),
  photoUrl: photoUrlSchema.optional(), // 👈 aquí el cambio

  // Nuevos (opcionales)
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), // YYYY-MM-DD
  tutor: z.string().max(120).optional(),
  tutorPhone: z.string().max(40).optional(),
});

router.put(
  '/me',
  requireAuth,
  allowRoles('student', 'teacher', 'coordinator', 'admin'),
  async (req: any, res, next) => {
    try {
      const body = payloadSchema.parse(req.body || {});
      const uid = req.userId as string;

      // --- Mapeo a los nombres que usa la DB ---
      const $set: any = {};

      if (body.name !== undefined) $set.name = body.name;
      if (body.campus !== undefined) $set.campus = body.campus;
      if (body.phone !== undefined) $set.phone = body.phone;
      if (body.photoUrl !== undefined) $set.photoUrl = body.photoUrl;

      // dob: guardamos como Date y reflejamos en birthDate
      if (body.dob !== undefined) {
        const d = new Date(`${body.dob}T00:00:00.000Z`);
        if (isNaN(d.getTime())) {
          return res.status(400).json({ error: 'dob inválido' });
        }
        $set.dob = d;
        $set.birthDate = d;
      }

      // Tutor
      if (body.tutor !== undefined) $set.tutor = body.tutor;

      // Tel. Tutor: reflejamos en guardianPhone y tutorPhone
      if (body.tutorPhone !== undefined) {
        $set.guardianPhone = body.tutorPhone;
        $set.tutorPhone = body.tutorPhone;
      }

      const updated = await User.findByIdAndUpdate(
        uid,
        { $set },
        { new: true, strict: false, projection: { passwordHash: 0 } }
      ).lean();

      if (!updated) return res.status(404).json({ error: 'Usuario no encontrado' });

      // Normalizamos dob para devolver YYYY-MM-DD
      const dobDate = (updated as any).dob || (updated as any).birthDate || null;
      const dobStr = dobDate
        ? new Date(dobDate).toISOString().slice(0, 10)
        : null;

      res.json({
        ok: true,
        user: {
          _id: String(updated._id),
          name: updated.name,
          email: updated.email || '',
          role: updated.role,
          campus: updated.campus,
          phone: (updated as any).phone || '',
          photoUrl: (updated as any).photoUrl || '',
          dob: dobStr,
          tutor: (updated as any).tutor || '',
          tutorPhone:
            (updated as any).tutorPhone ||
            (updated as any).guardianPhone ||
            '',
        },
      });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
