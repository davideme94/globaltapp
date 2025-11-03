import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { requireAuth, allowRoles } from '../middlewares/rbac';
import { PracticeAccess, PracticeAttempt, PracticeQuestion, PracticeSet } from '../models/practice';
import { Course } from '../models/course';
import { Enrollment } from '../models/enrollment';

const router = Router();

/* ====== SETS (coord/admin) ====== */
const setSchema = z.object({
  title: z.string().min(3),
  units: z.number().int().min(1).max(99).optional(),
  tags:  z.array(z.string()).optional(),
});

router.get(
  '/practice/sets',
  requireAuth,
  allowRoles('coordinator', 'admin'),
  async (_req, res, next) => {
    try {
      const rows = await PracticeSet.find().sort({ updatedAt: -1 }).limit(200).lean();
      res.json({ rows });
    } catch (e) { next(e); }
  }
);

router.post(
  '/practice/sets',
  requireAuth,
  allowRoles('coordinator', 'admin'),
  async (req, res, next) => {
    try {
      const b = setSchema.parse(req.body);
      const uid = (req as any).userId as string;
      const doc = await PracticeSet.create({ ...b, createdBy: uid });
      res.json({ ok: true, set: doc });
    } catch (e) { next(e); }
  }
);

router.put(
  '/practice/sets/:id',
  requireAuth,
  allowRoles('coordinator', 'admin'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const body = setSchema.partial().parse(req.body);
      const doc = await PracticeSet.findByIdAndUpdate(id, { $set: body }, { new: true }).lean();
      if (!doc) return res.status(404).json({ error: 'Set no encontrado' });
      res.json({ ok: true, set: doc });
    } catch (e) { next(e); }
  }
);

router.delete(
  '/practice/sets/:id',
  requireAuth,
  allowRoles('coordinator', 'admin'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      await PracticeQuestion.deleteMany({ set: id });
      await PracticeSet.deleteOne({ _id: id });
      res.json({ ok: true });
    } catch (e) { next(e); }
  }
);

/* ===== Acceso (coord/admin) =====
   ✅ Lista alumnos activos del curso. Si viene ?setId, devuelve enabled para ese set. */
router.get(
  '/practice/access/course/:courseId',
  requireAuth,
  allowRoles('coordinator', 'admin'),
  async (req, res, next) => {
    try {
      const { courseId } = req.params;
      const { setId } = req.query as { setId?: string };

      const course = await Course.findById(courseId).lean();
      if (!course) return res.status(404).json({ error: 'Curso no encontrado' });

      const rosterDocs = await Enrollment.find({
        course: courseId,
        year: course.year,
        status: 'active',
      }).populate('student', 'name email').lean();

      const studentIds = rosterDocs.map((r: any) => r?.student?._id).filter(Boolean);

      const accFilter: any = { student: { $in: studentIds } };
      if (setId) accFilter.set = setId;

      const accs = await PracticeAccess.find(accFilter).lean();
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
    } catch (e) { next(e); }
  }
);

/* PUT acceso – soporta modo global (legacy) y por set */
router.put(
  '/practice/access',
  requireAuth,
  allowRoles('coordinator', 'admin'),
  async (req, res, next) => {
    try {
      const body = z.object({
        studentId: z.string(),
        enabled: z.boolean(),
        setId: z.string().optional(),
        courseId: z.string().optional(),
      }).parse(req.body);

      const uid = (req as any).userId as string;

      const filter: any = { student: body.studentId };
      if (body.setId) filter.set = body.setId;

      const update: any = { $set: { enabled: body.enabled, updatedBy: uid } };
      if (body.setId)    update.$set.set    = body.setId;
      if (body.courseId) update.$set.course = body.courseId;

      const doc = await PracticeAccess.findOneAndUpdate(filter, update, { new: true, upsert: true }).lean();
      res.json({ ok: true, access: doc });
    } catch (e) { next(e); }
  }
);

/* ===== Preguntas (coord/admin/teacher) ===== */
const qSchema = z.object({
  setId: z.string().optional(),
  unit: z.number().int().min(1).max(99).optional(),
  prompt: z.string().min(3),
  type: z.enum(['MC', 'GAP']),
  options: z.array(z.string()).optional(),
  answer: z.string().min(1),
  imageUrl: z.string().url().optional(),
  embedUrl: z.string().url().optional(),
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

      const payload: any = {
        prompt: b.prompt,
        type: b.type,
        options: b.options,
        answer: b.answer,
        level: b.level,
        course: b.courseId || null,
        createdBy: uid,
      };
      if (b.setId)    payload.set  = b.setId;
      if (b.unit)     payload.unit = b.unit;
      if (b.imageUrl) payload.imageUrl = b.imageUrl;
      if (b.embedUrl) payload.embedUrl = b.embedUrl;

      const q = await PracticeQuestion.create(payload);
      res.json({ ok: true, question: q });
    } catch (e) { next(e); }
  }
);

const qPatchSchema = qSchema.partial();

router.put(
  '/practice/questions/:id',
  requireAuth,
  allowRoles('coordinator', 'admin', 'teacher'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const patch = qPatchSchema.parse(req.body);

      const toSet: any = {};
      if (patch.prompt   !== undefined) toSet.prompt   = patch.prompt;
      if (patch.type     !== undefined) toSet.type     = patch.type;
      if (patch.options  !== undefined) toSet.options  = patch.options;
      if (patch.answer   !== undefined) toSet.answer   = patch.answer;
      if (patch.unit     !== undefined) toSet.unit     = patch.unit;
      if (patch.imageUrl !== undefined) toSet.imageUrl = patch.imageUrl || null;
      if (patch.embedUrl !== undefined) toSet.embedUrl = patch.embedUrl || null;

      const q = await PracticeQuestion.findByIdAndUpdate(id, { $set: toSet }, { new: true }).lean();
      if (!q) return res.status(404).json({ error: 'Pregunta no encontrada' });
      res.json({ ok: true, question: q });
    } catch (e) { next(e); }
  }
);

router.get(
  '/practice/questions',
  requireAuth,
  allowRoles('coordinator', 'admin', 'teacher'),
  async (req, res, next) => {
    try {
      const { setId } = req.query as { setId?: string };
      const filter: any = {};
      if (setId) filter.set = setId;
      const list = await PracticeQuestion.find(filter).sort({ createdAt: -1 }).limit(200).lean();
      res.json({ questions: list });
    } catch (e) { next(e); }
  }
);

router.delete(
  '/practice/questions/:id',
  requireAuth,
  allowRoles('admin','coordinator','teacher'),
  async (req, res) => {
    try {
      const { id } = req.params;
      await PracticeQuestion.deleteOne({ _id: id });
      return res.json({ ok: true });
    } catch (e) {
      console.error('delete question', e);
      return res.status(500).json({ error: 'Failed to delete question' });
    }
  }
);

/* Seed simple (opcional) */
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
      ].map(q => ({ ...q, createdBy: uid }));
      await PracticeQuestion.insertMany(payload);
      res.json({ ok: true, created: payload.length });
    } catch (e) { next(e); }
  }
);

/* ===== Juego del alumno =====
   GET /practice/play?setId=...&unit=...
   (legacy: sin params usa acceso global)
   ➕ NUEVO: si viene setId, evita repetir preguntas ya vistas y devuelve progress/completed
*/
router.get(
  '/practice/play',
  requireAuth,
  allowRoles('student'),
  async (req, res, next) => {
    try {
      const uid = (req as any).userId as string;
      const { setId, unit } = req.query as { setId?: string; unit?: string };

      // --- MODO POR SET (nuevo)
      if (setId) {
        // permiso específico para ese set
        const acc = await PracticeAccess.findOne({ student: uid, set: setId, enabled: true }).lean();
        if (!acc) return res.status(403).json({ error: 'Práctica no habilitada para este set.' });

        const qFilter: any = { set: new mongoose.Types.ObjectId(setId) };
        if (unit) qFilter.unit = Number(unit);

        // total de preguntas en ese set/(unidad)
        const total = await PracticeQuestion.countDocuments(qFilter);

        // preguntas ya vistas por el alumno en ese set/(unidad)
        const seenFilter: any = { student: new mongoose.Types.ObjectId(uid), set: new mongoose.Types.ObjectId(setId) };
        if (unit) seenFilter.unit = Number(unit);
        const seenIds = await PracticeAttempt.distinct('question', seenFilter); // ObjectId[]

        const remaining = Math.max(0, total - seenIds.length);

        if (remaining <= 0) {
          return res.json({
            questions: [],
            completed: true,
            progress: { total, seen: seenIds.length, remaining: 0 },
          });
        }

        // sample solo entre no vistas
        const pipeline: any[] = [
          { $match: qFilter },
          { $match: { _id: { $nin: seenIds.map((x:any)=> new mongoose.Types.ObjectId(String(x))) } } },
          { $sample: { size: Math.min(10, remaining) } },
        ];

        const list = await PracticeQuestion.aggregate(pipeline);
        return res.json({
          questions: list.map((q: any) => ({
            _id: q._id,
            prompt: q.prompt,
            type: q.type,
            options: q.options ?? null,
            imageUrl: q.imageUrl ?? null,
            embedUrl: q.embedUrl ?? null,
            unit: q.unit ?? null,
          })),
          completed: false,
          progress: { total, seen: seenIds.length, remaining },
        });
      }

      // --- LEGACY (como antes)
      const acc = await PracticeAccess.findOne({ student: uid, enabled: true }).lean();
      if (!acc) return res.status(403).json({ error: 'Práctica no habilitada. Consultá al coordinador.' });

      const match: any = {};
      if (acc.set) match.set = acc.set;
      else if (acc.course) match.course = acc.course;

      const pipeline: any[] = [];
      if (Object.keys(match).length) pipeline.push({ $match: match });
      pipeline.push({ $sample: { size: 10 } });

      const list = await PracticeQuestion.aggregate(pipeline);
      res.json({
        questions: list.map((q: any) => ({
          _id: q._id,
          prompt: q.prompt,
          type: q.type,
          options: q.options ?? null,
          imageUrl: q.imageUrl ?? null,
          embedUrl: q.embedUrl ?? null,
          unit: q.unit ?? null,
        })),
        completed: false,
      });
    } catch (e) { next(e); }
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
      await PracticeAttempt.create({
        student: uid,
        question: q._id,
        given: b.answer,
        correct,
        set: q.set || null,
        unit: q.unit || null,
      });
      res.json({ correct });
    } catch (e) { next(e); }
  }
);

/* ===== Progreso por curso + set =====
   GET /practice/progress/course/:courseId?setId=...&goal=10 */
router.get(
  '/practice/progress/course/:courseId',
  requireAuth,
  allowRoles('coordinator', 'admin'),
  async (req, res, next) => {
    try {
      const { courseId } = req.params;
      const { setId, goal } = req.query as { setId?: string; goal?: string };
      if (!setId) return res.status(400).json({ error: 'setId requerido' });

      const course = await Course.findById(courseId).lean();
      if (!course) return res.status(404).json({ error: 'Curso no encontrado' });

      const roster = await Enrollment.find({ course: courseId, year: course.year, status: 'active' })
        .populate('student', 'name email')
        .lean();

      const studentIds = roster.map((r:any) => r?.student?._id).filter(Boolean);
      const accs = await PracticeAccess.find({ student: { $in: studentIds }, set: setId }).lean();
      const enabledById = new Map(accs.map(a => [String(a.student), !!a.enabled]));

      const goalNum = Math.max(1, Number(goal ?? 10) || 10);
      const totalQuestions = await PracticeQuestion.countDocuments({ set: setId });

      const attempts = await PracticeAttempt.aggregate([
        { $match: { student: { $in: studentIds.map(id => new mongoose.Types.ObjectId(String(id))) } } },
        { $lookup: { from: 'practicequestions', localField: 'question', foreignField: '_id', as: 'q' } },
        { $unwind: '$q' },
        { $match: { 'q.set': new mongoose.Types.ObjectId(setId) } },
        { $group: {
          _id: '$student',
          attempts: { $sum: 1 },
          correct:  { $sum: { $cond: ['$correct', 1, 0] } },
          distinctSet: { $addToSet: '$question' },
          lastAt: { $max: '$createdAt' }
        }},
        { $project: {
          _id: 1,
          attempts: 1,
          correct: 1,
          distinct: { $size: '$distinctSet' },
          lastAt: 1
        }}
      ]);

      const progById = new Map(attempts.map((a:any)=> [String(a._id), a]));

      const rows = roster.map((r:any) => {
        const sid = String(r.student._id);
        const p = progById.get(sid);
        const attempts = p?.attempts || 0;
        const correct  = p?.correct  || 0;
        const distinct = p?.distinct || 0;
        const percent  = attempts ? Math.round((correct/attempts)*100) : 0;
        const completed = distinct >= goalNum || (totalQuestions>0 && distinct >= totalQuestions);
        return {
          student: { _id:sid, name: r.student.name, email: r.student.email },
          enabled: enabledById.get(sid) || false,
          attempts, correct, distinct, percent,
          lastAt: p?.lastAt || null,
          completed
        };
      });

      res.json({ rows, goal: goalNum, totalQuestions });
    } catch (e) { next(e); }
  }
);

/* ===== NUEVO: Progreso del alumno para un set =====
   GET /practice/progress/mine?setId=... */
router.get(
  '/practice/progress/mine',
  requireAuth,
  allowRoles('student'),
  async (req, res, next) => {
    try {
      const uid = (req as any).userId as string;
      const { setId } = req.query as { setId?: string };
      if (!setId) return res.status(400).json({ error: 'setId requerido' });

      const total = await PracticeQuestion.countDocuments({ set: setId });

      const agg = await PracticeAttempt.aggregate([
        { $match: { student: new mongoose.Types.ObjectId(uid) } },
        { $lookup: { from: 'practicequestions', localField: 'question', foreignField: '_id', as: 'q' } },
        { $unwind: '$q' },
        { $match: { 'q.set': new mongoose.Types.ObjectId(setId) } },
        { $group: {
          _id: null,
          attempts: { $sum: 1 },
          correct:  { $sum: { $cond: ['$correct', 1, 0] } },
          distinctQ: { $addToSet: '$question' },
          lastAt: { $max: '$createdAt' }
        }},
        { $project: {
          _id: 0,
          attempts: 1,
          correct: 1,
          distinct: { $size: '$distinctQ' },
          lastAt: 1
        }}
      ]);

      const p = agg[0] || { attempts:0, correct:0, distinct:0, lastAt:null };
      const completed = total > 0 && p.distinct >= total;

      res.json({ ...p, total, completed });
    } catch (e) { next(e); }
  }
);

// ===== Tester (coord/admin): jugar como alumno =====
// GET  /practice/play-as?studentId=...&setId=...&unit=...
// POST /practice/submit-as { questionId, answer, studentId }
router.get(
  '/practice/play-as',
  requireAuth,
  allowRoles('coordinator','admin'),
  async (req, res, next) => {
    try {
      const { studentId, setId, unit } = req.query as { studentId?: string; setId?: string; unit?: string };
      if (!studentId) return res.status(400).json({ error: 'studentId requerido' });
      if (!setId) return res.status(400).json({ error: 'setId requerido' });

      const qFilter: any = { set: new mongoose.Types.ObjectId(setId) };
      if (unit) qFilter.unit = Number(unit);

      const total = await PracticeQuestion.countDocuments(qFilter);

      // ✅ no repetir correctas (repite erradas)
      const baseSeen: any = { student: new mongoose.Types.ObjectId(studentId), set: new mongoose.Types.ObjectId(setId) };
      if (unit) baseSeen.unit = Number(unit);
      const correctIds = await PracticeAttempt.distinct('question', { ...baseSeen, correct: true });
      const remaining = Math.max(0, total - correctIds.length);

      if (remaining <= 0) {
        return res.json({
          questions: [],
          completed: true,
          progress: { total, seen: total, remaining: 0 },
        });
      }

      const pipeline: any[] = [
        { $match: qFilter },
        { $match: { _id: { $nin: correctIds.map((x:any)=> new mongoose.Types.ObjectId(String(x))) } } },
        { $sample: { size: Math.min(10, remaining) } },
      ];

      const list = await PracticeQuestion.aggregate(pipeline);
      res.json({
        questions: list.map((q: any) => ({
          _id: q._id,
          prompt: q.prompt,
          type: q.type,
          options: q.options ?? null,
          // compat con imageUrl/embedUrl por ahora
          imageUrl: q.imageUrl ?? null,
          embedUrl: q.embedUrl ?? null,
          unit: q.unit ?? null,
        })),
        completed: false,
        progress: { total, seen: total - remaining, remaining },
      });
    } catch (e) { next(e); }
  }
);

router.post(
  '/practice/submit-as',
  requireAuth,
  allowRoles('coordinator','admin'),
  async (req, res, next) => {
    try {
      const b = z.object({ questionId: z.string(), answer: z.string(), studentId: z.string() }).parse(req.body);
      const q = await PracticeQuestion.findById(b.questionId).lean();
      if (!q) return res.status(404).json({ error: 'Pregunta no encontrada' });
      const correct = q.answer.trim().toLowerCase() === b.answer.trim().toLowerCase();
      await PracticeAttempt.create({
        student: b.studentId,
        question: q._id,
        given: b.answer,
        correct,
        set: q.set || null,
        unit: q.unit || null,
      });
      res.json({ correct });
    } catch (e) { next(e); }
  }
);

export default router;

