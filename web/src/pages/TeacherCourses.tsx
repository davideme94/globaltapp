// web/src/pages/TeacherCourses.tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  api,
  type Course,
  type Me,
  type CourseScheduleItem,
  type DayCode,
} from '../lib/api';

type Row = Course & {
  scheduleLabel?: string;
  studentsCount?: number;
};

const DAY_LABEL: Record<DayCode, string> = {
  MON: 'Lun',
  TUE: 'Mar',
  WED: 'Mié',
  THU: 'Jue',
  FRI: 'Vie',
  SAT: 'Sáb',
};

function fmtSchedule(items: CourseScheduleItem[] = []): string {
  return items
    .map((s) => `${s.day ? (DAY_LABEL[s.day as DayCode] + ' ') : ''}${s.start}-${s.end}`)
    .join(' · ');
}

function isMine(c: any, myId: string): boolean {
  const t = c?.teacher;
  if (!t) return false;
  if (typeof t === 'string') return String(t) === String(myId);
  if (typeof t === 'object') {
    if (t?._id) return String(t._id) === String(myId);
  }
  return false;
}

export default function TeacherCourses() {
  const [me, setMe] = useState<Me['user'] | null>(null);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // 1) Cargar usuario
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await api.me();
        if (!alive) return;
        setMe(r.user);
      } catch {
        if (!alive) return;
        setMe(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // 2) Cargar cursos del profe
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!me) return;
      setLoading(true);
      setErr(null);
      try {
        // ---------- A) Primer intento: backend /courses/mine ----------
        const r = await api.courses.mine({ year });
        if (!alive) return;

        setYear(r.year ?? year);

        // r.rows puede venir como Course[] (teacher) o como { course, schedule }[] (student compat)
        const base = (r.rows || []) as any[];

        // Normalizo a Course[]
        let mineCourses: { course: Course; schedule?: CourseScheduleItem[] }[] = base.map((it) =>
          it?.course
            ? { course: it.course as Course, schedule: (it.schedule || []) as CourseScheduleItem[] }
            : { course: it as Course }
        );

        // ---------- B) Fallback: si vino vacío, traigo todos y filtro en cliente ----------
        if (!mineCourses.length) {
          const all = await api.courses.list({ year });
          const filtered = (all.courses || []).filter((c) => isMine(c, me.id));
          mineCourses = filtered.map((course) => ({ course }));
        }

        // ---------- C) Enriquecer (horarios y cantidad alumnos) en paralelo ----------
        const enriched: Row[] = await Promise.all(
          mineCourses.map(async ({ course, schedule }) => {
            let finalSchedule = schedule;
            if (!finalSchedule) {
              try {
                const s = await api.courses.schedule.get(course._id);
                finalSchedule = s.schedule || [];
              } catch {
                finalSchedule = [];
              }
            }

            let studentsCount = 0;
            try {
              const rr = await api.courses.roster(course._id);
              studentsCount = (rr.roster || []).length;
            } catch {
              studentsCount = 0;
            }

            return {
              ...course,
              scheduleLabel: fmtSchedule(finalSchedule),
              studentsCount,
            };
          })
        );

        if (!alive) return;
        setRows(enriched);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || 'No se pudieron cargar tus cursos.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [me, year]);

  return (
    <div className="space-y-3">
      <h1 className="font-heading text-xl">Mis cursos ({year})</h1>

      {loading && (
        <div className="card p-4 space-y-2">
          <div className="h-5 w-48 skeleton" />
          <div className="h-20 skeleton" />
        </div>
      )}

      {!loading && err && <div className="card p-4 text-danger">{err}</div>}

      {!loading && !err && rows.length === 0 && (
        <div className="card p-4">No tenés cursos asignados en {year}.</div>
      )}

      {!loading && !err && rows.length > 0 && (
        <div className="card p-4">
          {rows.map((c) => (
            <div key={c._id} className="mb-3">
              <div className="font-medium">
                {c.name}{' '}
                <span className="italic text-neutral-700">— {c.campus}</span>{' '}
                {c.scheduleLabel && (
                  <>
                    —{' '}
                    <span className="px-2 py-0.5 rounded-full text-xs border border-neutral-300 bg-neutral-50">
                      {c.scheduleLabel}
                    </span>
                  </>
                )}
                {' '}—{' '}
                <span className="inline-flex items-center gap-1">
                  <span className="font-medium">{c.studentsCount ?? 0}</span> alumnos
                </span>
                {' '}—{' '}
                {/* Acciones */}
                <Link to={`/teacher/course/${c._id}/attendance`} className="text-brand-primary underline">
                  Tomar asistencia
                </Link>{' '}{'·'}{' '}
                <Link to={`/teacher/course/${c._id}/partials`} className="text-brand-primary underline">
                  Informes parciales
                </Link>{' '}{'·'}{' '}
                <Link to={`/teacher/course/${c._id}/boletin`} className="text-brand-primary underline">
                  Boletín
                </Link>{' '}{'·'}{' '}
                <Link to={`/teacher/course/${c._id}/british`} className="text-brand-primary underline">
                  Británico
                </Link>{' '}{'·'}{' '}
                <Link to={`/teacher/course/${c._id}/topics`} className="text-brand-primary underline">
                  Libro de temas
                </Link>{' '}{'·'}{' '}
                <Link to={`/teacher/course/${c._id}/materials`} className="text-brand-primary underline">
                  Material del curso
                </Link>{' '}{'·'}{' '}
                <Link to={`/course/${c._id}/communications`} className="text-brand-primary underline">
                  Comunicaciones
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
