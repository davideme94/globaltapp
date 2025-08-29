// routes/cases.ts
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, allowRoles } from '../middlewares/rbac';
import { Case, type CaseCategory, type CaseStatus, type CaseSeverity } from '../models/case';
import { CaseReply } from '../models/caseReply';
import { Course } from '../models/course';

const router = Router();

const createSchema = z.object({
  studentId: z.string(),
  courseId: z.string().optional(),
  title: z.string().min(3),
  description: z.string().optional(),
  category: z.enum(['ACADEMIC_DIFFICULTY','BEHAVIOR','ATTENDANCE','ADMIN','OTHER']),
  severity: z.enum(['LOW','MEDIUM','HIGH']).default('MEDIUM'),
  checklist: z.array(z.string()).optional(),
  assigneeId: z.string().optional(),
});

async function teacherCanCreate(userId: string, role: string, courseId?: string | null) {
  if (!courseId) return role !== 'teacher' ? true : false; // teacher necesita curso
  if (role !== 'teacher') return true;
  const ok = await Course.exists({ _id: courseId, teacher: userId });
  return !!ok;
}

// Crear caso manual
router.post(
  '/cases',
  requireAuth,
  allowRoles('teacher','coordinator','admin'),
  async (req, res, next) => {
    try {
      const body = createSchema.parse(req.body || {});
      const uid  = (req as any).userId as string;
      const role = (req as any).userRole as 'teacher'|'coordinator'|'admin';
      if (!(await teacherCanCreate(uid, role, body.courseId))) {
        return res.status(403).json({ error: 'No autorizado' });
      }

      const checklist = (body.checklist || []).map(label => ({ label, done:false }));
      const doc = await Case.create({
        student: body.studentId,
        course: body.courseId || null,
        createdBy: uid,
        watchers: [uid],
        assignee: body.assigneeId || null,
        category: body.category as CaseCategory,
        severity: body.severity as CaseSeverity,
        status: 'OPEN' as CaseStatus,
        source: 'MANUAL',
        title: body.title,
        description: body.description || '',
        checklist,
      });
      res.json({ ok: true, case: doc });
    } catch (e) { next(e); }
  }
);

// Listado con filtros
router.get(
  '/cases',
  requireAuth,
  allowRoles('teacher','coordinator','admin'),
  async (req, res, next) => {
    try {
      const uid  = (req as any).userId as string;
      const role = (req as any).userRole as 'teacher'|'coordinator'|'admin';
      const { status, category, studentId, courseId, severity } = req.query as any;

      const q: any = {};
      if (status)   q.status = status;
      if (category) q.category = category;
      if (studentId) q.student = studentId;
      if (courseId)  q.course  = courseId;
      if (severity)  q.severity = severity;

      // Permisos:
      // - teacher: casos que creó o donde figura en watchers o de sus cursos
      // - coordinator/admin: todos
      if (role === 'teacher') {
        q.$or = [{ createdBy: uid }, { watchers: uid }];
      }

      const rows = await Case.find(q)
        .sort({ updatedAt: -1 })
        .populate('student','name email')
        .populate('course','name year campus')
        .populate('createdBy','name')
        .populate('assignee','name')
        .lean();

      res.json({ rows });
    } catch (e) { next(e); }
  }
);

// Actualización básica (estado, severidad, assignee)
router.put(
  '/cases/:id',
  requireAuth,
  allowRoles('teacher','coordinator','admin'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const role = (req as any).userRole as 'teacher'|'coordinator'|'admin';
      const allowed = ['status','severity','assignee'];
      const patch: any = {};
      allowed.forEach(k => { if (req.body[k] !== undefined) patch[k] = req.body[k]; });

      if (role === 'teacher' && patch.assignee) {
        return res.status(403).json({ error: 'No podés reasignar como docente' });
      }

      const doc = await Case.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean();
      if (!doc) return res.status(404).json({ error: 'No encontrado' });
      res.json({ ok: true, case: doc });
    } catch (e) { next(e); }
  }
);

// Responder en el hilo
router.post(
  '/cases/:id/replies',
  requireAuth,
  allowRoles('teacher','coordinator','admin'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const uid  = (req as any).userId as string;
      const role = (req as any).userRole as 'teacher'|'coordinator'|'admin';
      const body = String(req.body?.body || '').trim();
      if (!body) return res.status(400).json({ error: 'Mensaje vacío' });

      const exists = await Case.exists({ _id: id });
      if (!exists) return res.status(404).json({ error: 'Caso no encontrado' });

      const r = await CaseReply.create({ case: id, user: uid, role, body });
      res.json({ ok: true, reply: r });
    } catch (e) { next(e); }
  }
);

export default router;
