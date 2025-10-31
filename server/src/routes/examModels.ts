// server/src/routes/examModels.ts
import { Router } from 'express';
import { z } from 'zod';
import mongoose, { type Types } from 'mongoose';
import { requireAuth, allowRoles } from '../middlewares/rbac';
import { ExamModel } from '../models/examModel';
import { ExamGrade } from '../models/examGrade';
// import { Enrollment } from '../models/enrollment'; // (no se usa aquí)

const r = Router();

function baseModels() {
  return [
    { category: 'MID_YEAR', number: 1 as const, gradeType: 'PASS3' as const },
    { category: 'MID_YEAR', number: 2 as const, gradeType: 'NUMERIC' as const },
    { category: 'END_YEAR', number: 1 as const, gradeType: 'PASS3' as const },
    { category: 'END_YEAR', number: 2 as const, gradeType: 'PASS3' as const },
    { category: 'END_YEAR', number: 3 as const, gradeType: 'NUMERIC' as const },
    { category: 'END_YEAR', number: 4 as const, gradeType: 'NUMERIC' as const },
  ];
}

/* ========= Semilla manual (permanece igual) ========= */
r.post(
  '/courses/:courseId/exam-models/seed',
  requireAuth, allowRoles('coordinator', 'admin'),
  async (req, res, next) => {
    try {
      const user = (req as any).user as { _id?: Types.ObjectId } | undefined;
      if (!user?._id) return res.status(401).json({ error: 'Unauthorized' });

      const course = new mongoose.Types.ObjectId(req.params.courseId);
      const docs = await ExamModel.insertMany(
        baseModels().map(b => ({ ...b, course, updatedBy: user._id })),
        { ordered: false }
      );
      res.json({ ok: true, created: docs.length });
    } catch (err) { next(err); }
  }
);

/* ========= Listado público con AUTOSEED =========
   - Si el curso no tiene modelos, los crea automáticamente (sin sesión) y devuelve los 6.
   - Si hay sesión y es alumno → devuelve solo visibles + su myGrade.
   - Si hay sesión y es staff → devuelve todos + gradesCount.
   - Si NO hay sesión → devuelve solo visibles (myGrade=null).
*/
r.get('/courses/:courseId/exam-models', async (req, res, next) => {
  try {
    const user = (req as any).user as
      | { _id?: Types.ObjectId; role?: 'student'|'teacher'|'coordinator'|'admin' }
      | undefined;

    const course = new mongoose.Types.ObjectId(req.params.courseId);

    // Traer existentes
    let models = await ExamModel.find({ course }).sort({ category: 1, number: 1 }).lean();

    // AUTOSEED si no hay ninguno (sin exigir sesión)
    if (!models.length) {
      await ExamModel.insertMany(baseModels().map(b => ({ ...b, course })), { ordered: false });
      models = await ExamModel.find({ course }).sort({ category: 1, number: 1 }).lean();
    }

    // Sin user → visibles sin myGrade
    if (!user?.role) {
      return res.json(models.filter(m => m.visible).map(m => ({ ...m, myGrade: null })));
    }

    // Alumno → visibles + su myGrade
    if (user.role === 'student') {
      const visibles = models.filter(m => m.visible);
      const ids = visibles.map(m => m._id);
      const grades = await ExamGrade.find({ exam: { $in: ids }, student: user._id })
        .select('exam resultPass3 resultNumeric').lean();
      const map = new Map(grades.map(g => [String(g.exam), g]));
      return res.json(visibles.map(m => ({ ...m, myGrade: map.get(String(m._id)) || null })));
    }

    // Staff → todos + count de calificaciones
    const ids = models.map(m => m._id);
    const agg = await ExamGrade.aggregate([
      { $match: { exam: { $in: ids } } },
      { $group: { _id: '$exam', count: { $sum: 1 } } },
    ]);
    const counts = new Map(agg.map(a => [String(a._id), a.count]));
    res.json(models.map(m => ({ ...m, gradesCount: counts.get(String(m._id)) || 0 })));
  } catch (err) { next(err); }
});

/* ========= Editar link/visibilidad (protegido) ========= */
const editSchema = z.object({
  driveUrl: z.string().url().optional().or(z.literal('')),
  visible: z.boolean().optional(),
});

r.put(
  '/exam-models/:id',
  requireAuth, allowRoles('coordinator', 'admin', 'teacher'),
  async (req, res, next) => {
    try {
      const user = (req as any).user as { _id?: Types.ObjectId; role?: 'student'|'teacher'|'coordinator'|'admin' } | undefined;
      if (!user?._id || !user?.role) return res.status(401).json({ error: 'Unauthorized' });

      const body = editSchema.parse(req.body);

      // Docente NO puede modificar el link; sí puede visible
      if (user.role === 'teacher' && Object.prototype.hasOwnProperty.call(body, 'driveUrl')) {
        return res.status(403).json({ error: 'Solo coordinador/administrativo puede editar el link.' });
      }

      const doc = await ExamModel.findByIdAndUpdate(
        req.params.id,
        { ...body, updatedBy: user._id },
        { new: true }
      );
      res.json(doc);
    } catch (err) { next(err); }
  }
);

/* ========= Cargar nota (protegido) ========= */
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
      const user = (req as any).user as { _id?: Types.ObjectId } | undefined;
      if (!user?._id) return res.status(401).json({ error: 'Unauthorized' });

      const { studentId, resultPass3, resultNumeric } = gradeSchema.parse(req.body);
      const examId = new mongoose.Types.ObjectId(req.params.id);
      const m = await ExamModel.findById(examId).select('course').lean();
      if (!m) return res.status(404).json({ error: 'Exam model not found' });

      const up = await ExamGrade.findOneAndUpdate(
        { exam: examId, student: new mongoose.Types.ObjectId(studentId) },
        {
          course: m.course,
          resultPass3: resultPass3 ?? null,
          resultNumeric: resultNumeric ?? null,
          updatedBy: user._id,
        },
        { upsert: true, new: true }
      );
      res.json(up);
    } catch (err) { next(err); }
  }
);

export default r;

