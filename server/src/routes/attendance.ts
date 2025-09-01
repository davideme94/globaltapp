import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, allowRoles } from '../middlewares/rbac';
import { Course } from '../models/course';
import { Enrollment } from '../models/enrollment';
import { Attendance } from '../models/attendance';

const router = Router();

const upsertSchema = z.object({
  courseId: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  studentId: z.string(),
  status: z.enum(['P','A','T','J'])
});

async function canEditCourse(userId: string, role: string, courseId: string) {
  if (role === 'teacher') {
    const ok = await Course.exists({ _id: courseId, teacher: userId });
    return !!ok;
  }
  // coord/admin sí
  return true;
}

// PUT /attendance -> upsert (un alumno, un día)
router.put('/attendance', requireAuth, allowRoles('teacher','coordinator','admin'), async (req, res, next) => {
  try {
    const body = upsertSchema.parse(req.body);
    const role = (req as any).userRole as string;
    const uid = (req as any).userId as string;

    if (!(await canEditCourse(uid, role, body.courseId))) return res.status(403).json({ error: 'No autorizado' });

    // validar que el alumno esté en el curso y activo en ese año
    const course = await Course.findById(body.courseId).lean();
    if (!course) return res.status(404).json({ error: 'Curso no encontrado' });

    const enr = await Enrollment.exists({ course: body.courseId, student: body.studentId, year: course.year, status: 'active' });
    if (!enr) return res.status(400).json({ error: 'Alumno no pertenece al curso o no está activo' });

    const doc = await Attendance.findOneAndUpdate(
      { course: body.courseId, student: body.studentId, date: body.date },
      { $set: { status: body.status, createdBy: uid } },
      { new: true, upsert: true }
    ).lean();

    res.json({ ok: true, item: doc });
  } catch (e) { next(e); }
});

// GET /attendance/grid?courseId=...&from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/attendance/grid', requireAuth, allowRoles('teacher','coordinator','admin'), async (req, res, next) => {
  try {
    const { courseId, from, to } = req.query as { courseId?: string; from?: string; to?: string };
    if (!courseId) return res.status(400).json({ error: 'courseId requerido' });

    const course = await Course.findById(courseId).lean();
    if (!course) return res.status(404).json({ error: 'Curso no encontrado' });

    // roster
    const roster = await Enrollment.find({ course: courseId, year: course.year, status: 'active' })
      .populate('student', 'name email')
      .sort({ 'student.name': 1 })
      .lean();

    const q: any = { course: courseId };
    if (from) q.date = { ...(q.date||{}), $gte: from };
    if (to)   q.date = { ...(q.date||{}), $lte: to };

    const items = await Attendance.find(q).lean();

    // fechas únicas (columnas)
    const dateSet = new Set<string>();
    items.forEach(it => dateSet.add(it.date));
    const dates = Array.from(dateSet).sort((a,b)=> a.localeCompare(b));

    // mapa studentId -> { date -> status }
    const byStudent: Record<string, Record<string, string>> = {};
    for (const it of items) {
      const sid = String(it.student);
      byStudent[sid] = byStudent[sid] || {};
      byStudent[sid][it.date] = it.status;
    }

    // filas + resumen
    const rows = roster.map(r => {
      const sid = String((r.student as any)._id);
      const name = (r.student as any).name;
      const rec: Record<string, string|null> = {};
      let P=0,A=0,T=0,J=0;
      for (const d of dates) {
        const v = byStudent[sid]?.[d] ?? null;
        rec[d] = v as any;
        if (v==='P') P++;
        else if (v==='A') A++;
        else if (v==='T') T++;
        else if (v==='J') J++;
      }
      const total = P + A + T + J;
      const percent = total ? Math.round((P / total) * 100) : 0;
      return { student: { _id: sid, name }, statusByDate: rec, resume: { P, A, J, T, total, percent } };
    });

    res.json({ dates, rows });
  } catch (e) { next(e); }
});

/* =========================
   NUEVO: /attendance/mine
   ========================= */
// GET /attendance/mine?courseId=...&from=YYYY-MM-DD&to=YYYY-MM-DD[&studentId=...]
router.get('/attendance/mine', requireAuth, async (req, res, next) => {
  try {
    const { courseId, from, to, studentId } = req.query as {
      courseId?: string; from?: string; to?: string; studentId?: string;
    };
    if (!courseId) return res.status(400).json({ error: 'courseId es requerido' });

    const role = (req as any).userRole as string | undefined;
    const uid  = (req as any).userId as string;
    const sid  = role === 'student' ? uid : (studentId || uid);

    const course = await Course.findById(courseId).lean();
    if (!course) return res.status(404).json({ error: 'Curso no encontrado' });

    const qDates: any = { course: courseId };
    if (from) qDates.date = { ...(qDates.date||{}), $gte: from };
    if (to)   qDates.date = { ...(qDates.date||{}), $lte: to };

    const itemsCourse = await Attendance.find(qDates).lean();

    const dateSet = new Set<string>();
    itemsCourse.forEach(it => dateSet.add(it.date));
    const dates = Array.from(dateSet).sort((a,b)=> a.localeCompare(b));

    const qStudent: any = { ...qDates, student: sid };
    const items = await Attendance.find(qStudent).lean();

    const statusByDate: Record<string, 'P'|'A'|'T'|'J'|null> = {};
    let P=0,A=0,T=0,J=0;
    for (const d of dates) statusByDate[d] = null;
    for (const it of items) {
      statusByDate[it.date] = it.status as any;
      if (it.status==='P') P++;
      else if (it.status==='A') A++;
      else if (it.status==='T') T++;
      else if (it.status==='J') J++;
    }
    const total = P + A + T + J;
    const percent = total ? Math.round((P / total) * 100) : 0;

    return res.json({
      dates,
      row: {
        student: { _id: String(sid) },
        statusByDate,
        resume: { P, A, J, T, total, percent },
      }
    });
  } catch (e) { next(e); }
});

export default router;
