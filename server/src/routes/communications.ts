import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, allowRoles } from '../middlewares/rbac';
import { Course } from '../models/course';
import { Enrollment } from '../models/enrollment';
import { Communication } from '../models/communication';
import { User } from '../models/user';
import { CommReply } from '../models/commReply'; // 👈 NUEVO

const router = Router();

const sendSchema = z.object({
  courseId: z.string(),
  studentId: z.string().optional(), // si no viene => broadcast al curso
  category: z.enum(['TASK','BEHAVIOR','ADMIN','INFO']),
  title: z.string().min(2),
  body: z.string().min(2)
});

// docentes solo pueden enviar a sus cursos; coord/admin cualquiera
async function canSend(userId: string, role: string, courseId: string) {
  if (role === 'teacher') {
    const ok = await Course.exists({ _id: courseId, teacher: userId });
    return !!ok;
  }
  return true;
}

/* ===== Helpers de autorización para replies ===== */
async function canViewOrReply(uid: string, role: 'student'|'teacher'|'coordinator'|'admin', comm: any) {
  if (!comm) return false;
  if (role === 'student') {
    return String(comm.student) === String(uid);
  }
  if (role === 'teacher') {
    const ok = await Course.exists({ _id: comm.course, teacher: uid });
    return !!ok;
  }
  // coordinador/admin ven todo
  return role === 'coordinator' || role === 'admin';
}

/* ========= Envío ========= */

// POST /communications  -> enviar (a alumno o a todo el curso)
router.post('/communications', requireAuth, allowRoles('teacher','coordinator','admin'), async (req, res, next) => {
  try {
    const body = sendSchema.parse(req.body);
    const uid  = (req as any).userId as string;
    const role = (req as any).userRole as 'teacher'|'coordinator'|'admin';

    if (!(await canSend(uid, role, body.courseId))) return res.status(403).json({ error: 'No autorizado' });
    const course = await Course.findById(body.courseId).lean();
    if (!course) return res.status(404).json({ error: 'Curso no encontrado' });

    // Si viene studentId => a un alumno. Si no => broadcast a todos los activos del curso/año.
    if (body.studentId) {
      const doc = await Communication.create({
        course: body.courseId, student: body.studentId, sender: uid, senderRole: role,
        year: course.year, category: body.category, title: body.title, body: body.body
      });
      return res.json({ ok: true, sent: 1, ids: [doc._id] });
    } else {
      const roster = await Enrollment.find({ course: body.courseId, year: course.year, status: 'active' }).select('student').lean();
      const payload = roster.map(r => ({
        course: body.courseId, student: r.student, sender: uid, senderRole: role,
        year: course.year, category: body.category, title: body.title, body: body.body
      }));
      const created = await Communication.insertMany(payload);
      return res.json({ ok: true, sent: created.length, ids: created.map(d => d._id) });
    }
  } catch (e) { next(e); }
});

// GET /communications/course/:courseId  -> histórico del curso
router.get('/communications/course/:courseId', requireAuth, allowRoles('teacher','coordinator','admin'), async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const { studentId, year } = req.query as any;
    const course = await Course.findById(courseId).lean();
    if (!course) return res.status(404).json({ error: 'Curso no encontrado' });

    const q: any = { course: courseId };
    if (studentId) q.student = studentId;
    if (year) q.year = Number(year);
    const rows = await Communication.find(q).sort({ createdAt: -1 }).populate('student','name').populate('sender','name').lean();
    res.json({ rows });
  } catch (e) { next(e); }
});

// GET /communications/mine -> alumno ve las suyas
router.get('/communications/mine', requireAuth, allowRoles('student'), async (req, res, next) => {
  try {
    const studentId = (req as any).userId as string;

    const rows = await Communication.find({ student: studentId })
      .sort({ createdAt: -1 })
      .populate('course','name year')
      .populate('sender','name')
      .lean();

    res.json({ rows });
  } catch (e) { next(e); }
});

// PUT /communications/:id/read -> alumno marca como leído
router.put('/communications/:id/read', requireAuth, allowRoles('student'), async (req, res, next) => {
  try {
    const id = req.params.id;
    const uid = (req as any).userId as string;
    const c = await Communication.findOneAndUpdate(
      { _id: id, student: uid, readAt: null },
      { $set: { readAt: new Date() } },
      { new: true }
    ).lean();
    if (!c) return res.status(404).json({ error: 'No encontrado' });
    res.json({ ok: true, item: c });
  } catch (e) { next(e); }
});

/* =========================
 * NUEVO: REPLIES (GET/POST)
 * ========================= */

// GET /communications/:id/replies  -> lista de respuestas (staff ve todas; alumno solo las suyas)
router.get(
  '/communications/:id/replies',
  requireAuth,
  allowRoles('student','teacher','coordinator','admin'),
  async (req, res, next) => {
    try {
      const id = req.params.id;
      const uid = (req as any).userId as string;
      const role = (req as any).userRole as 'student'|'teacher'|'coordinator'|'admin';

      const comm = await Communication.findById(id).lean();
      if (!comm) return res.status(404).json({ error: 'Comunicación no encontrada' });

      if (!(await canViewOrReply(uid, role, comm))) return res.status(403).json({ error: 'No autorizado' });

      const replies = await CommReply.find({ communication: id })
        .sort({ createdAt: 1 })
        .populate('user','name')
        .lean();

      res.json({
        replies: replies.map(r => ({
          _id: String(r._id),
          body: r.body,
          role: r.role,
          createdAt: r.createdAt,
          user: r.user, // {_id, name}
        })),
      });
    } catch (e) { next(e); }
  }
);

// POST /communications/:id/replies  -> crear respuesta (alumno y también staff)
router.post(
  '/communications/:id/replies',
  requireAuth,
  allowRoles('student','teacher','coordinator','admin'),
  async (req, res, next) => {
    try {
      const schema = z.object({ body: z.string().min(1).max(2000) });
      const { body } = schema.parse(req.body || {});
      const id = req.params.id;
      const uid = (req as any).userId as string;
      const role = (req as any).userRole as 'student'|'teacher'|'coordinator'|'admin';

      const comm = await Communication.findById(id).lean();
      if (!comm) return res.status(404).json({ error: 'Comunicación no encontrada' });

      if (!(await canViewOrReply(uid, role, comm))) return res.status(403).json({ error: 'No autorizado' });

      const doc = await CommReply.create({
        communication: id,
        user: uid,
        role,
        body: body.trim(),
      });

      res.json({ ok: true, reply: { _id: doc._id, body: doc.body, role: doc.role, createdAt: doc.createdAt } });
    } catch (e) { next(e); }
  }
);

/* ============================
 * NUEVO: BROADCAST MASIVO
 * ============================ */
router.post(
  '/communications/broadcast',
  requireAuth,
  allowRoles('coordinator', 'admin'),
  async (req, res, next) => {
    try {
      const schema = z.object({
        title: z.string().min(3),
        body: z.string().min(1),
        category: z.enum(['TASK', 'BEHAVIOR', 'ADMIN', 'INFO']).default('INFO'),
        roles: z.array(z.enum(['student', 'teacher', 'coordinator', 'admin'])).optional(),
        campuses: z.array(z.enum(['DERQUI', 'JOSE_C_PAZ'])).optional(),
        active: z.boolean().optional(),
        courseId: z.string().optional(),
      });

      const {
        title, body, category, roles, campuses, active, courseId,
      } = schema.parse(req.body || {});

      if (courseId) {
        const exists = await Course.exists({ _id: courseId });
        if (!exists) return res.status(404).json({ error: 'Curso no encontrado' });
      }

      const where: any = {};
      if (roles?.length) where.role = { $in: roles };
      if (campuses?.length) where.campus = { $in: campuses };
      if (typeof active === 'boolean') where.active = active;

      const recipients = await User.find(where, { _id: 1 }).lean();
      if (!recipients.length) return res.json({ ok: true, sent: 0, ids: [] });

      const year = new Date().getFullYear();
      const senderId = (req as any).userId as string;
      const senderRole = (req as any).userRole as 'coordinator'|'admin'|'teacher';

      const docs = recipients.map((u) => ({
        course: courseId || undefined,
        student: u._id,
        sender: senderId,
        senderRole,
        year,
        category,
        title,
        body,
        readAt: null,
      }));

      const inserted = await Communication.insertMany(docs, { ordered: false });
      const ids = inserted.map((d) => String(d._id));
      res.json({ ok: true, sent: ids.length, ids });
    } catch (e) { next(e); }
  }
);

export default router;
