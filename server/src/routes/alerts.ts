// routes/alerts.ts
import { Router } from 'express';
import { requireAuth, allowRoles } from '../middlewares/rbac';
import { Case } from '../models/case';
import { Course } from '../models/course';
import { Enrollment } from '../models/enrollment';
import { Communication } from '../models/communication';
import { User } from '../models/user';
import { ReportCard } from '../models/reportCard';   // <- tu modelo de boletines
import { Attendance } from '../models/attendance';   // <- tu modelo de asistencia
import { PartialReport, Partials } from '../models/partialReport'; // <- parciales (con alias Partials)

const router = Router();

/** Helper: upsert de caso automático deduplicado por (student, course, ruleId) y abierto */
async function upsertAutoCase({
  studentId, courseId, title, description, category, severity, ruleId, createdBy,
}: {
  studentId: string; courseId?: string | null;
  title: string; description?: string;
  category: 'ACADEMIC_DIFFICULTY'|'BEHAVIOR'|'ATTENDANCE'|'ADMIN'|'OTHER';
  severity: 'LOW'|'MEDIUM'|'HIGH';
  ruleId: string; createdBy: string;
}) {
  const q: any = {
    student: studentId,
    course: courseId || null,
    status: 'OPEN',
    source: 'AUTOMATION',
    ruleId,
  };

  const existing = await Case.findOne(q).lean();
  if (existing) return existing;

  return await Case.create({
    student: studentId,
    course: courseId || null,
    createdBy,           // quién disparó (coordinador/admin, o un "system user")
    watchers: [createdBy],
    assignee: null,
    category,
    severity,
    status: 'OPEN',
    source: 'AUTOMATION',
    ruleId,
    title,
    description: description || '',
    checklist: [],
  });
}

/** 1) ATTENDANCE: 3 inasistencias seguidas o asistencia < 80% */
async function ruleAttendance(courseId: string, createdBy: string) {
  const enrolls = await Enrollment.find({ course: courseId, status: 'active' }).select('student').lean();
  for (const e of enrolls) {
    const sid = String(e.student);
    const last = await Attendance.find({ course: courseId, student: sid }).sort({ date: -1 }).limit(10).lean();

    // 3 seguidas "A"
    const last3 = last.slice(0,3);
    const ruleId1 = 'attendance_3_absences';
    if (last3.length === 3 && last3.every(a => a.status === 'A')) {
      await upsertAutoCase({
        studentId: sid, courseId,
        title: 'Asistencia: 3 inasistencias seguidas',
        description: 'Se detectaron 3 ausencias consecutivas.',
        category: 'ATTENDANCE', severity: 'MEDIUM', ruleId: ruleId1, createdBy,
      });
      continue; // no evalúo el 80% si ya disparó esta
    }

    // porcentaje < 80% en los últimos 10 registros (si hay)
    if (last.length >= 5) {
      const present = last.filter(a => a.status === 'P').length;
      const pct = (present / last.length) * 100;
      if (pct < 80) {
        await upsertAutoCase({
          studentId: sid, courseId,
          title: `Asistencia baja: ${pct.toFixed(0)}%`,
          description: `Asistencia por debajo del 80% en los últimos ${last.length} registros.`,
          category: 'ATTENDANCE', severity: 'LOW', ruleId: 'attendance_below_80', createdBy,
        });
      }
    }
  }
}

/** 2) PARCIALES con D/E o caída marcada (simplificado: si aparece D/E en cualquier área) */
async function rulePartials(courseId: string, createdBy: string) {
  // usamos el alias `Partials` para no tocar el resto del código
  const enrolls = await Enrollment.find({ course: courseId, status: 'active' }).select('student').lean();
  for (const e of enrolls) {
    const sid = String(e.student);
    const rows = await Partials.find({ course: courseId, student: sid }).lean();
    const risky = rows.some(r => {
      const g = [r?.grades?.reading, r?.grades?.writing, r?.grades?.listening, r?.grades?.speaking];
      return g.some((x: any) => x === 'D' || x === 'E');
    });
    if (risky) {
      await upsertAutoCase({
        studentId: sid, courseId,
        title: 'Parciales: rendimiento bajo (D/E)',
        description: 'Se detectaron calificaciones D/E en parciales.',
        category: 'ACADEMIC_DIFFICULTY', severity: 'MEDIUM', ruleId: 'partials_low_scores', createdBy,
      });
    }
  }
}

/** 3) CONDUCTA: 2 comunicaciones de conducta en 30 días */
async function ruleBehavior(courseId: string, createdBy: string) {
  const enrolls = await Enrollment.find({ course: courseId, status: 'active' }).select('student').lean();
  const since = new Date(Date.now() - 30*24*60*60*1000);
  for (const e of enrolls) {
    const sid = String(e.student);
    const count = await Communication.countDocuments({
      course: courseId, student: sid, category: 'BEHAVIOR', createdAt: { $gte: since }
    });
    if (count >= 2) {
      await upsertAutoCase({
        studentId: sid, courseId,
        title: 'Conducta: 2 comunicaciones en 30 días',
        description: `Se registraron ${count} comunicaciones de conducta en los últimos 30 días.`,
        category: 'BEHAVIOR', severity: 'MEDIUM', ruleId: 'behavior_2_30d', createdBy,
      });
    }
  }
}

/** 4) BOLETINES: algún examen < 5 (oral/escrito/finales) */
async function ruleReportCards(courseId: string, createdBy: string) {
  const enrolls = await Enrollment.find({ course: courseId, status: 'active' }).select('student').lean();
  for (const e of enrolls) {
    const sid = String(e.student);
    const card = await ReportCard.findOne({ course: courseId, student: sid }).lean();
    if (!card) continue;
    const values = [
      card.examOral, card.examWritten,
      card.finalOral, card.finalWritten
    ].filter(v => typeof v === 'number');
    if (values.length && values.some((v: number) => v < 5)) {
      await upsertAutoCase({
        studentId: sid, courseId,
        title: 'Boletín: examen < 5',
        description: 'Se detectó calificación menor a 5 en al menos un examen.',
        category: 'ACADEMIC_DIFFICULTY', severity: 'HIGH', ruleId: 'reportcard_exam_lt5', createdBy,
      });
    }
  }
}

/** 5) Recordatorios: casos OPEN con más de N días (default 7) → ping al assignee o watchers */
async function ruleReminders(days = 7, createdBy: string) {
  const limit = new Date(Date.now() - days*24*60*60*1000);
  const stale = await Case.find({ status: 'OPEN', updatedAt: { $lte: limit } }).lean();

  for (const c of stale) {
    const target = c.assignee || (c.watchers && c.watchers[0]);
    if (!target) continue;
    await Communication.create({
      course: c.course || undefined,
      student: c.student,
      sender: createdBy,
      senderRole: 'coordinator',
      year: new Date().getFullYear(),
      category: 'ADMIN',
      title: `Recordatorio: caso abierto "${c.title}"`,
      body: `El caso lleva más de ${days} días abierto sin actualización.`,
    });
  }
}

// POST /alerts/run?courseId=...&reminders=1
router.post(
  '/alerts/run',
  requireAuth,
  allowRoles('coordinator','admin'),
  async (req, res, next) => {
    try {
      const createdBy = (req as any).userId as string;
      const { courseId, reminders } = req.query as any;

      let courses: any[] = [];
      if (courseId) {
        const c = await Course.findById(courseId).lean();
        if (!c) return res.status(404).json({ error: 'Curso no encontrado' });
        courses = [c];
      } else {
        const year = new Date().getFullYear();
        courses = await Course.find({ year }).lean();
      }

      let created = 0;
      for (const c of courses) {
        await ruleAttendance(String(c._id), createdBy);
        await rulePartials(String(c._id), createdBy);
        await ruleBehavior(String(c._id), createdBy);
        await ruleReportCards(String(c._id), createdBy);
      }

      if (String(reminders || '') === '1') {
        await ruleReminders(7, createdBy);
      }

      res.json({ ok: true, scanned: courses.length, created });
    } catch (e) { next(e); }
  }
);

export default router;
