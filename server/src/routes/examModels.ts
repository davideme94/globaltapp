// server/src/routes/examModels.ts
import { Router } from 'express';
import { z } from 'zod';
import mongoose, { type Types } from 'mongoose';
import { requireAuth, allowRoles } from '../middlewares/rbac';
import { ExamModel } from '../models/examModel';
import { ExamGrade } from '../models/examGrade';
import { Enrollment } from '../models/enrollment';

const r = Router();

/* Seed: crea 6 modelos por curso */
r.post(
  '/courses/:courseId/exam-models/seed',
  requireAuth, allowRoles('coordinator', 'admin'),
  async (req, res, next) => {
    try {
      // cast local para tipos (no cambia la lógica)
      const user = (req as any).user as { _id: Types.ObjectId; role: 'student' | 'teacher' | 'coordinator' | 'admin' };

      const course = new mongoose.Types.ObjectId(req.params.courseId);
      const base = [
        { category: 'MID_YEAR', number: 1, gradeType: 'PASS3' as const },
        { category: 'MID_YEAR', number: 2, gradeType: 'NUMERIC' as const },
        { category: 'END_YEAR', number: 1, gradeType: 'PASS3' as const },
        { category: 'END_YEAR', number: 2, gradeType: 'PASS3' as const },
        { category: 'END_YEAR', number: 3, gradeType: 'NUMERIC' as const },
        { category: 'END_YEAR', number: 4, gradeType: 'NUMERIC' as const },
      ];
      const docs = await ExamModel.insertMany(
        base.map(b => ({ ...b, course, updatedBy: user._id })),
        { ordered: false }
      );
      res.json({ ok: true, created: docs.length });
    } catch (err) { next(err); }
  }
);

/* Listado (staff ve todo; alumnos solo visibles + su nota) */
r.get(
  '/courses/:courseId/exam-models',
  requireAuth,
  async (req, res, next) => {
    try {
      // cast local para tipos (no cambia la lógica)
      const user = (req as any).user as { _id: Types.ObjectId; role: 'student' | 'teacher' | 'coordinator' | 'admin' };

      const course = new mongoose.Types.ObjectId(req.params.courseId);
      const models = await ExamModel.find({ course }).sort({ category: 1, number: 1 }).lean();

      // Si es alumno: filtrar visibles y agregar su grade
      if (user.role === 'student') {
        const ids = models.filter(m => m.visible).map(m => m._id);
        const grades = await ExamGrade.find({ exam: { $in: ids }, student: user._id })
          .select('exam resultPass3 resultNumeric').lean();
        const map = new Map(grades.map(g => [String(g.exam), g]));
        return res.json(models.filter(m => m.visible).map(m => ({ ...m, myGrade: map.get(String(m._id)) || null })));
      }

      // Staff: devuelve todas + conteo de grades por estado
      const ids = models.map(m => m._id);
      const agg = await ExamGrade.aggregate([
        { $match: { exam: { $in: ids } } },
        { $group: { _id: '$exam', count: { $sum: 1 } } }
      ]);
      const counts = new Map(agg.map(a => [String(a._id), a.count]));
      res.json(models.map(m => ({ ...m, gradesCount: counts.get(String(m._id)) || 0 })));
    } catch (err) { next(err); }
  }
);

/* Editar link/visibilidad */
const editSchema = z.object({
  driveUrl: z.string().url().optional().or(z.literal('')),
  visible: z.boolean().optional(),
});

r.put(
  '/exam-models/:id',
  requireAuth, allowRoles('coordinator', 'admin', 'teacher'),
  async (req, res, next) => {
    try {
      // cast local para tipos (no cambia la lógica)
      const user = (req as any).user as { _id: Types.ObjectId };

      const body = editSchema.parse(req.body);
      const doc = await ExamModel.findByIdAndUpdate(
        req.params.id,
        { ...body, updatedBy: user._id },
        { new: true }
      );
      res.json(doc);
    } catch (err) { next(err); }
  }
);

/* Cargar nota de un alumno */
const gradeSchema = z.object({
  studentId: z.string(),
  resultPass3: z.enum(['PASS', 'BARELY_PASS', 'FAILED']).optional(),
  resultNumeric: z.number().int().min(1).max(10).optional(),
});

r.put(
  '/exam-models/:id/grade',
  requireAuth, allowRoles('teacher', 'coordinator', 'admin'),
  async (req, res, next) => {
    try {
      // cast local para tipos (no cambia la lógica)
      const user = (req as any).user as { _id: Types.ObjectId };

      const { studentId, resultPass3, resultNumeric } = gradeSchema.parse(req.body);
      const examId = new mongoose.Types.ObjectId(req.params.id);
      const courseId = (await ExamModel.findById(examId).select('course')).course;

      const up = await ExamGrade.findOneAndUpdate(
        { exam: examId, student: new mongoose.Types.ObjectId(studentId) },
        {
          course: courseId,
          resultPass3: resultPass3 ?? null,
          resultNumeric: resultNumeric ?? null,
          updatedBy: user._id
        },
        { upsert: true, new: true }
      );
      res.json(up);
    } catch (err) { next(err); }
  }
);

export default r;
