import { Router } from 'express';
import { z } from 'zod';

import { requireAuth, allowRoles } from '../middlewares/rbac';
import { Attendance } from '../models/attendance';
import { AttendanceFollowUp } from '../models/attendanceFollowUp';
import { Course } from '../models/course';
import { Enrollment } from '../models/enrollment';

const router = Router();

const followUpStatusSchema = z.enum([
  'PENDING',
  'CONTACTED',
  'JUSTIFIED',
  'DROP_REQUEST',
  'DROPPED',
  'RESOLVED',
]);

const listQuerySchema = z.object({
  year: z.coerce.number().int().optional(),
  courseId: z.string().optional(),
  status: followUpStatusSchema.optional(),
});

const noRecordsQuerySchema = z.object({
  year: z.coerce.number().int().optional(),
  courseId: z.string().optional(),
});

const updateSchema = z.object({
  status: followUpStatusSchema.optional(),
  reason: z.string().optional(),
  notes: z.string().optional(),
});

const dropAndUnenrollSchema = z.object({
  reason: z.string().optional(),
  notes: z.string().optional(),
});

function getReqUserId(req: any) {
  return req.user?._id || req.user?.id || req.auth?._id || req.auth?.id;
}

function normalizeCourse(c: any) {
  if (!c) return null;

  return {
    _id: String(c._id),
    name: c.name || '',
    year: c.year,
    campus: c.campus,
    teacher:
      c.teacher && typeof c.teacher === 'object'
        ? {
            _id: String(c.teacher._id),
            name: c.teacher.name || '',
            email: c.teacher.email || '',
          }
        : c.teacher
          ? String(c.teacher)
          : null,
  };
}

function normalizeStudent(s: any) {
  if (!s) return null;

  return {
    _id: String(s._id),
    name: s.name || '',
    email: s.email || '',
    campus: s.campus,
    active: s.active,
  };
}

function normalizeFollowUp(doc: any) {
  return {
    _id: String(doc._id),
    course: normalizeCourse(doc.course),
    student: normalizeStudent(doc.student),
    streakCount: doc.streakCount || 3,
    absenceDates: doc.absenceDates || [],
    lastAbsenceDate: doc.lastAbsenceDate,
    status: doc.status || 'PENDING',
    reason: doc.reason || '',
    notes: doc.notes || '',
    resolvedAt: doc.resolvedAt || null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/**
 * GET /attendance/followups/no-records
 *
 * Detecta alumnos inscriptos activamente que no tienen ningún registro de asistencia.
 * Importante:
 * - No borra nada
 * - No modifica nada
 * - Solo lista posibles casos de "no inició" o "sin asistencia cargada"
 */
router.get(
  '/attendance/followups/no-records',
  requireAuth,
  allowRoles('coordinator', 'admin'),
  async (req, res, next) => {
    try {
      const { year, courseId } = noRecordsQuerySchema.parse(req.query);

      const courseWhere: any = {};
      if (year) courseWhere.year = year;
      if (courseId) courseWhere._id = courseId;

      const courses = await Course.find(courseWhere)
        .populate('teacher', 'name email')
        .sort({ year: -1, name: 1 })
        .lean();

      const rows: any[] = [];

      for (const course of courses as any[]) {
        const enrollments = await Enrollment.find({
          course: course._id,
          status: 'active',
        })
          .populate('student', 'name email campus active')
          .lean();

        for (const enrollment of enrollments as any[]) {
          const student = enrollment.student;
          if (!student?._id) continue;

          const attendanceCount = await Attendance.countDocuments({
            course: course._id,
            student: student._id,
          });

          if (attendanceCount !== 0) continue;

          rows.push({
            _id: `${String(course._id)}_${String(student._id)}`,
            course: normalizeCourse(course),
            student: normalizeStudent(student),
            attendanceCount: 0,
            enrollment: {
              _id: String(enrollment._id),
              status: enrollment.status,
              createdAt: enrollment.createdAt,
              updatedAt: enrollment.updatedAt,
            },
          });
        }
      }

      rows.sort((a, b) => {
        const courseA = `${a.course?.year || ''} ${a.course?.name || ''}`;
        const courseB = `${b.course?.year || ''} ${b.course?.name || ''}`;
        const byCourse = courseA.localeCompare(courseB);
        if (byCourse !== 0) return byCourse;

        const studentA = a.student?.name || '';
        const studentB = b.student?.name || '';
        return studentA.localeCompare(studentB);
      });

      res.json({
        rows,
        total: rows.length,
      });
    } catch (e) {
      next(e);
    }
  }
);

/**
 * GET /attendance/followups
 *
 * Detecta alumnos con 3 ausentes seguidos.
 * Importante:
 * - Solo cuenta registros con status === 'A'
 * - Si no hay registro, no cuenta como ausente
 * - Si aparece P, T o J en el medio, corta la racha
 */
router.get(
  '/attendance/followups',
  requireAuth,
  allowRoles('coordinator', 'admin'),
  async (req, res, next) => {
    try {
      const { year, courseId, status } = listQuerySchema.parse(req.query);

      const courseWhere: any = {};
      if (year) courseWhere.year = year;
      if (courseId) courseWhere._id = courseId;

      const courses = await Course.find(courseWhere)
        .populate('teacher', 'name email')
        .sort({ year: -1, name: 1 })
        .lean();

      const detectedIds: string[] = [];
      const detectedRows: any[] = [];

      for (const course of courses as any[]) {
        const enrollments = await Enrollment.find({
          course: course._id,
          status: 'active',
        })
          .populate('student', 'name email campus active')
          .lean();

        for (const enrollment of enrollments as any[]) {
          const student = enrollment.student;
          if (!student?._id) continue;

          const records = await Attendance.find({
            course: course._id,
            student: student._id,
          })
            .sort({ date: -1 })
            .limit(3)
            .lean();

          const hasThreeConsecutiveAbsences =
            records.length === 3 && records.every((r) => r.status === 'A');

          if (!hasThreeConsecutiveAbsences) continue;

          const absenceDatesDesc = records.map((r) => r.date);
          const absenceDatesAsc = [...absenceDatesDesc].reverse();
          const lastAbsenceDate = absenceDatesDesc[0];

          let followUp = await AttendanceFollowUp.findOne({
            course: course._id,
            student: student._id,
            lastAbsenceDate,
          });

          if (!followUp) {
            followUp = await AttendanceFollowUp.create({
              course: course._id,
              student: student._id,
              streakCount: 3,
              absenceDates: absenceDatesAsc,
              lastAbsenceDate,
              status: 'PENDING',
              reason: '',
              notes: '',
              createdBy: getReqUserId(req),
              updatedBy: getReqUserId(req),
            });
          } else {
            followUp.streakCount = 3;
            followUp.absenceDates = absenceDatesAsc;
            followUp.updatedBy = getReqUserId(req);
            await followUp.save();
          }

          detectedIds.push(String(followUp._id));

          detectedRows.push({
            _id: String(followUp._id),
            course: normalizeCourse(course),
            student: normalizeStudent(student),
            streakCount: followUp.streakCount || 3,
            absenceDates: followUp.absenceDates || absenceDatesAsc,
            lastAbsenceDate: followUp.lastAbsenceDate,
            status: followUp.status || 'PENDING',
            reason: followUp.reason || '',
            notes: followUp.notes || '',
            resolvedAt: followUp.resolvedAt || null,
            createdAt: followUp.createdAt,
            updatedAt: followUp.updatedAt,
          });
        }
      }

      const savedWhere: any = {};
      if (status) savedWhere.status = status;
      if (courseId) savedWhere.course = courseId;

      const saved = await AttendanceFollowUp.find(savedWhere)
        .populate({
          path: 'course',
          select: 'name year campus teacher',
          populate: { path: 'teacher', select: 'name email' },
        })
        .populate('student', 'name email campus active')
        .sort({ updatedAt: -1 })
        .lean();

      const map = new Map<string, any>();

      for (const row of saved as any[]) {
        map.set(String(row._id), normalizeFollowUp(row));
      }

      for (const row of detectedRows) {
        map.set(String(row._id), row);
      }

      let rows = Array.from(map.values());

      if (status) {
        rows = rows.filter((r) => r.status === status);
      }

      rows.sort((a, b) => {
        const da = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const db = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return db - da;
      });

      res.json({
        rows,
        detected: detectedIds.length,
      });
    } catch (e) {
      next(e);
    }
  }
);

/**
 * PUT /attendance/followups/:id/drop-and-unenroll
 *
 * Marca el seguimiento como BAJA y saca al alumno del curso.
 */
router.put(
  '/attendance/followups/:id/drop-and-unenroll',
  requireAuth,
  allowRoles('coordinator', 'admin'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const data = dropAndUnenrollSchema.parse(req.body);

      const followUp = await AttendanceFollowUp.findById(id);

      if (!followUp) {
        return res.status(404).json({ error: 'Seguimiento no encontrado' });
      }

      const courseId = followUp.course;
      const studentId = followUp.student;

      const deletedEnrollment = await Enrollment.deleteMany({
        course: courseId,
        student: studentId,
      });

      followUp.status = 'DROPPED';
      followUp.reason = data.reason?.trim() || followUp.reason || 'Baja administrativa';
      followUp.notes = data.notes?.trim() || followUp.notes || 'Alumno marcado como baja y retirado del curso.';
      followUp.resolvedAt = new Date();
      followUp.updatedBy = getReqUserId(req);

      await followUp.save();

      const updated = await AttendanceFollowUp.findById(followUp._id)
        .populate({
          path: 'course',
          select: 'name year campus teacher',
          populate: { path: 'teacher', select: 'name email' },
        })
        .populate('student', 'name email campus active');

      res.json({
        ok: true,
        removedFromCourse: deletedEnrollment.deletedCount || 0,
        item: normalizeFollowUp(updated),
      });
    } catch (e) {
      next(e);
    }
  }
);

/**
 * PUT /attendance/followups/:id
 *
 * Permite guardar causa, notas y estado del seguimiento.
 */
router.put(
  '/attendance/followups/:id',
  requireAuth,
  allowRoles('coordinator', 'admin'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const data = updateSchema.parse(req.body);

      const update: any = {
        updatedBy: getReqUserId(req),
      };

      if (data.status !== undefined) {
        update.status = data.status;

        if (['JUSTIFIED', 'DROPPED', 'RESOLVED'].includes(data.status)) {
          update.resolvedAt = new Date();
        } else {
          update.resolvedAt = null;
        }
      }

      if (data.reason !== undefined) {
        update.reason = data.reason.trim();
      }

      if (data.notes !== undefined) {
        update.notes = data.notes.trim();
      }

      const updated = await AttendanceFollowUp.findByIdAndUpdate(
        id,
        { $set: update },
        { new: true }
      )
        .populate({
          path: 'course',
          select: 'name year campus teacher',
          populate: { path: 'teacher', select: 'name email' },
        })
        .populate('student', 'name email campus active');

      if (!updated) {
        return res.status(404).json({ error: 'Seguimiento no encontrado' });
      }

      res.json({
        ok: true,
        item: normalizeFollowUp(updated),
      });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
