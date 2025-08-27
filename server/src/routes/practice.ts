import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, allowRoles } from '../middlewares/rbac';
import { PracticeAccess, PracticeAttempt, PracticeQuestion } from '../models/practice';
import { Course } from '../models/course';
import { Enrollment } from '../models/enrollment';

const router = Router();

/* ===== Acceso (coord/admin) =====
   ✅ Solo lista alumnos con INSCRIPCIÓN ACTIVA en el AÑO del curso */
router.get(
  '/practice/access/course/:courseId',
  requireAuth,
  allowRoles('coordinator', 'admin'),
  async (req, res, next) => {
    try {
      const { courseId } = req.params;

      const course = await Course.findById(courseId).lean();
      if (!course) return res.status(404).json({ error: 'Curso no encontrado' });
      const y = course.year;

      // Solo inscripciones activas del año del curso
      const rosterDocs = await Enrollment.find({
        course: courseId,
        year: y,
        status: 'active',
      })
        .populate('student', 'name email')
        .lean();

      const studentIds = rosterDocs
        .map((r: any) => r?.student?._id)
        .filter(Boolean);

      // Estado de práctica solo para los alumnos del roster
      const accs = await PracticeAccess.find({ student: { $in: studentIds } }).lean();
      const enabledById = new Map(accs.map(a => [String(a.student), !!a.enabled]));

      const rows = rosterDocs.map((r: any) => ({
        student: {
          _id: String(r.student._id),
          name: r.student.name,
          email: r.student.email,
        },
        enabled: enabledById.get(String(r.student._id)) || false,
      }));

      res.json({ rows });
    } catch (e) {
      next(e);
    }
  }
);

router.put(
  '/practice/access',
  requireAuth,
  allowRoles('coordinator', 'admin'),
  async (req, res, next) => {
    try {
      const body = z.object({ studentId: z.string(), enabled: z.boolean() }).parse(req.body);
      const uid = (req as any).userId as string;

      const doc = await PracticeAccess.findOneAndUpdate(
        { student: body.studentId },
        { $set: { enabled: body.enabled, updatedBy: uid } },
        { new: true, upsert: true }
      ).lean();

      res.json({ ok: true, access: doc });
    } catch (e) {
      next(e);
    }
  }
);

/* ===== Preguntas (coord/admin/teacher) ===== */
const qSchema = z.object({
  prompt: z.string().min(3),
  type: z.enum(['MC', 'GAP']),
  options: z.array(z.string()).optional(),
  answer: z.string().min(1),
  level: z.string().optional(),
  courseId: z.string().optional(),
});

router.post(
  '/practice/questions',
  requireAuth,
  allowRoles('coordinator', 'admin', 'teacher'),
  async (req, res, next) => {
    try {
      const b = qSchema.parse(req.body);
      const uid = (req as any).userId as string;
      const q = await PracticeQuestion.create({
        prompt: b.prompt,
        type: b.type,
        options: b.options,
        answer: b.answer,
        level: b.level,
        course: b.courseId || null,
        createdBy: uid,
      });
      res.json({ ok: true, question: q });
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  '/practice/questions',
  requireAuth,
  allowRoles('coordinator', 'admin', 'teacher'),
  async (_req, res, next) => {
    try {
      const list = await PracticeQuestion.find().sort({ createdAt: -1 }).limit(200).lean();
      res.json({ questions: list });
    } catch (e) {
      next(e);
    }
  }
);

/* Seed rápido (opcional) */
router.post(
  '/practice/seed-simple',
  requireAuth,
  allowRoles('coordinator', 'admin'),
  async (req, res, next) => {
    try {
      const count = await PracticeQuestion.countDocuments();
      if (count > 0) return res.json({ ok: true, created: 0 });
      const uid = (req as any).userId as string;
      const payload = [
        { prompt: 'Choose the correct option: __ am David.', type: 'MC', options: ['I', 'He', 'She'], answer: 'I' },
        { prompt: 'Complete: How ___ you?', type: 'GAP', answer: 'are' },
        { prompt: 'Choose: They ___ from Argentina.', type: 'MC', options: ['is', 'are', 'am'], answer: 'are' },
        { prompt: 'Complete: What ___ your name?', type: 'GAP', answer: 'is' },
        { prompt: 'Choose: She ___ a teacher.', type: 'MC', options: ['are', 'is', 'am'], answer: 'is' },
        { prompt: 'Complete: I ___ 12 years old.', type: 'GAP', answer: 'am' },
        { prompt: 'Choose: We ___ happy.', type: 'MC', options: ['is', 'are', 'am'], answer: 'are' },
        { prompt: 'Complete: Where ___ you from?', type: 'GAP', answer: 'are' },
        { prompt: 'Choose: He ___ football.', type: 'MC', options: ['play', 'plays', 'playing'], answer: 'plays' },
        { prompt: 'Complete: They ___ students.', type: 'GAP', answer: 'are' },
        { prompt: 'Choose: It ___ cold today.', type: 'MC', options: ['is', 'are', 'am'], answer: 'is' },
        { prompt: 'Complete: My name ___ Ana.', type: 'GAP', answer: 'is' },
      ].map(q => ({ ...q, createdBy: uid }));
      await PracticeQuestion.insertMany(payload);
      res.json({ ok: true, created: payload.length });
    } catch (e) {
      next(e);
    }
  }
);

/* ===== Juego del alumno ===== */
router.get(
  '/practice/play',
  requireAuth,
  allowRoles('student'),
  async (req, res, next) => {
    try {
      const uid = (req as any).userId as string;
      const acc = await PracticeAccess.findOne({ student: uid }).lean();
      if (!acc || !acc.enabled)
        return res.status(403).json({ error: 'Práctica no habilitada. Consultá al coordinador.' });

      // 10 aleatorias
      const list = await PracticeQuestion.aggregate([{ $sample: { size: 10 } }]);
      res.json({
        questions: list.map((q: any) => ({
          _id: q._id,
          prompt: q.prompt,
          type: q.type,
          options: q.options ?? null,
        })),
      });
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  '/practice/submit',
  requireAuth,
  allowRoles('student'),
  async (req, res, next) => {
    try {
      const b = z.object({ questionId: z.string(), answer: z.string() }).parse(req.body);
      const q = await PracticeQuestion.findById(b.questionId).lean();
      if (!q) return res.status(404).json({ error: 'Pregunta no encontrada' });
      const uid = (req as any).userId as string;
      const correct = q.answer.trim().toLowerCase() === b.answer.trim().toLowerCase();
      await PracticeAttempt.create({ student: uid, question: q._id, given: b.answer, correct });
      res.json({ correct });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
