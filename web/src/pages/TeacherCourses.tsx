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

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!me) return;
      setLoading(true);
      setErr(null);
      try {
        const r = await api.courses.mine({ year });
        if (!alive) return;

        setYear(r.year ?? year);

        const base = (r.rows || []) as any[];

        let mineCourses: { course: Course; schedule?: CourseScheduleItem[] }[] = base.map((it) =>
          it?.course
            ? { course: it.course as Course, schedule: (it.schedule || []) as CourseScheduleItem[] }
            : { course: it as Course }
        );

        if (!mineCourses.length) {
          const all = await api.courses.list({ year });
          const filtered = (all.courses || []).filter((c) => isMine(c, me.id));
          mineCourses = filtered.map((course) => ({ course }));
        }

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
    <div className="space-y-4">
      <h1 className="font-heading text-2xl font-semibold">Mis cursos ({year})</h1>

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
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((c) => (
            <div
              key={c._id}
              className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm hover:shadow-md transition"
            >
              {/* HEADER */}
              <div className="mb-3">
                <div className="text-lg font-semibold">{c.name}</div>
                <div className="text-sm text-neutral-600">{c.campus}</div>

                {c.scheduleLabel && (
                  <div className="mt-2">
                    <span className="px-2 py-1 rounded-full text-xs bg-neutral-100 border">
                      {c.scheduleLabel}
                    </span>
                  </div>
                )}
              </div>

              {/* INFO */}
              <div className="mb-3 text-sm">
                <span className="font-semibold">{c.studentsCount ?? 0}</span> alumnos
              </div>

              {/* ACCIONES */}
              <div className="flex flex-wrap gap-2">
                <Link to={`/teacher/course/${c._id}/attendance`} className="px-3 py-1 text-xs rounded-full bg-neutral-100 hover:bg-neutral-200 transition">
                  Asistencia
                </Link>

                <Link to={`/teacher/course/${c._id}/students`} className="px-3 py-1 text-xs rounded-full bg-neutral-100 hover:bg-neutral-200 transition">
                  Alumnos
                </Link>

                <Link to={`/teacher/course/${c._id}/partials`} className="px-3 py-1 text-xs rounded-full bg-neutral-100 hover:bg-neutral-200 transition">
                  Parciales
                </Link>

                <Link to={`/teacher/course/${c._id}/boletin`} className="px-3 py-1 text-xs rounded-full bg-neutral-100 hover:bg-neutral-200 transition">
                  Boletín
                </Link>

                <Link to={`/teacher/course/${c._id}/british`} className="px-3 py-1 text-xs rounded-full bg-neutral-100 hover:bg-neutral-200 transition">
                  Británico
                </Link>

                <Link to={`/teacher/course/${c._id}/topics`} className="px-3 py-1 text-xs rounded-full bg-neutral-100 hover:bg-neutral-200 transition">
                  Libro
                </Link>

                <Link to={`/teacher/course/${c._id}/materials`} className="px-3 py-1 text-xs rounded-full bg-neutral-100 hover:bg-neutral-200 transition">
                  Material
                </Link>

                <Link to={`/teacher/course/${c._id}/board`} className="px-3 py-1 text-xs rounded-full bg-purple-600 text-white hover:bg-purple-700 transition">
                  MURO
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
