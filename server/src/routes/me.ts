import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, allowRoles } from '../middlewares/rbac';
import { User } from '../models/user';

const router = Router();

const campusSchema = z.enum(['DERQUI', 'JOSE_C_PAZ']);

// Campos permitidos a editar por el dueño del perfil.
const payloadSchema = z.object({
  name: z.string().min(2).optional(),
  campus: campusSchema.optional(),
  phone: z.string().max(40).optional(),
  photoUrl: z.string().url().optional(),

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

      // dob: lo guardamos como birthDate (Date) y también como 'dob' (string ISO) para compatibilidad.
      if (body.dob !== undefined) {
        $set.birthDate = new Date(`${body.dob}T00:00:00.000Z`);
        $set.dob = body.dob; // opcional, útil para front que espera el string
      }

      // Tutor
      if (body.tutor !== undefined) $set.tutor = body.tutor;

      // Tel. Tutor: reflejamos en guardianPhone (nombre usado en el modelo) y mantenemos tutorPhone por compat.
      if (body.tutorPhone !== undefined) {
        $set.guardianPhone = body.tutorPhone;
        $set.tutorPhone = body.tutorPhone; // opcional
      }

      const updated = await User.findByIdAndUpdate(
        uid,
        { $set },
        { new: true, strict: false, projection: { passwordHash: 0 } }
      ).lean();

      if (!updated) return res.status(404).json({ error: 'Usuario no encontrado' });

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
          // devolvemos ambos por comodidad del front
          dob: (updated as any).dob || (updated as any).birthDate
            ? new Date((updated as any).birthDate).toISOString().slice(0, 10)
            : null,
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
