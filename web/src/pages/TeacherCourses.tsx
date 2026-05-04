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

function getEmoji(name: string) {
  const n = name.toLowerCase();
  if (n.includes('1°')) return '🌱';
  if (n.includes('2°')) return '📘';
  if (n.includes('3°')) return '🎯';
  if (n.includes('4°')) return '🚀';
  return '📚';
}

function campusLabel(campus: string) {
  if (campus === 'JOSE_C_PAZ') return 'José C. Paz';
  if (campus === 'DERQUI') return 'Derqui';
  return campus;
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
    <div className="mx-auto w-full max-w-7xl space-y-6 px-3 py-4 sm:px-4 md:px-6">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 p-[2px] shadow-xl shadow-violet-200/60">
        <div className="relative rounded-[1.9rem] bg-white/95 p-5 sm:p-7 md:p-8">
          <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-fuchsia-200/70 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-10 h-44 w-44 rounded-full bg-violet-200/70 blur-3xl" />

          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-4 py-2 text-xs font-black uppercase tracking-wide text-violet-700">
                📚 Panel docente
              </div>

              <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                Mis cursos
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
                Accedé rápidamente a asistencia, alumnos, informes, boletín, libro de temas, materiales y muro del curso.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
              <div className="rounded-3xl border border-violet-100 bg-white px-5 py-4 shadow-sm">
                <p className="text-xs font-black uppercase tracking-wide text-violet-600">
                  Año
                </p>
                <p className="mt-1 text-3xl font-black text-slate-950">
                  {year}
                </p>
              </div>

              <div className="rounded-3xl border border-fuchsia-100 bg-white px-5 py-4 shadow-sm">
                <p className="text-xs font-black uppercase tracking-wide text-fuchsia-600">
                  Cursos
                </p>
                <p className="mt-1 text-3xl font-black text-slate-950">
                  {rows.length}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ESTADOS */}
      {loading && (
        <section className="rounded-3xl border border-violet-100 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
          <p className="font-bold text-slate-600">Cargando tus cursos...</p>
        </section>
      )}

      {err && (
        <section className="rounded-3xl border border-rose-200 bg-rose-50 p-5 text-sm font-bold text-rose-700 shadow-sm">
          {err}
        </section>
      )}

      {!loading && !err && rows.length === 0 && (
        <section className="rounded-3xl border border-dashed border-violet-200 bg-violet-50/60 p-10 text-center shadow-sm">
          <div className="mb-3 text-5xl">🗂️</div>
          <h2 className="text-xl font-black text-slate-900">
            No tenés cursos asignados
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Cuando tengas cursos asignados para este año, van a aparecer acá.
          </p>
        </section>
      )}

      {/* CURSOS */}
      {!loading && !err && rows.length > 0 && (
        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((c) => (
            <article
              key={c._id}
              className="group relative overflow-hidden rounded-[1.75rem] bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 p-[2px] shadow-lg shadow-violet-100 transition duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-violet-200"
            >
              <div className="relative h-full rounded-[1.65rem] bg-white p-5">
                <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-fuchsia-100 blur-2xl transition group-hover:bg-fuchsia-200" />

                {/* HEADER CARD */}
                <div className="relative mb-4 flex items-start gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-violet-100 bg-violet-50 text-3xl shadow-sm">
                    {getEmoji(c.name)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h2 className="break-words text-2xl font-black leading-tight tracking-tight text-slate-950">
                      {c.name}
                    </h2>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-700">
                        {campusLabel(c.campus)}
                      </span>

                      <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-violet-700">
                        {c.year}
                      </span>
                    </div>
                  </div>
                </div>

                {/* INFO */}
                <div className="relative mb-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                      Alumnos
                    </p>
                    <p className="mt-1 text-2xl font-black text-slate-950">
                      {c.studentsCount ?? 0}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-violet-100 bg-violet-50 p-3">
                    <p className="text-xs font-black uppercase tracking-wide text-violet-600">
                      Horario
                    </p>
                    <p className="mt-1 text-sm font-bold leading-snug text-violet-900">
                      {c.scheduleLabel || 'Sin horarios'}
                    </p>
                  </div>
                </div>

                {/* ACCIONES PRINCIPALES */}
                <div className="relative">
                  <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-400">
                    Acciones del curso
                  </p>

                  <div className="grid grid-cols-2 gap-2">
                    <Link
                      to={`/teacher/course/${c._id}/attendance`}
                      className="rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-3 py-3 text-center text-xs font-black uppercase tracking-wide text-white shadow-lg shadow-violet-200 transition hover:scale-[1.02]"
                    >
                      📋 Asistencia
                    </Link>

                    <Link
                      to={`/teacher/course/${c._id}/students`}
                      className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-center text-xs font-black uppercase tracking-wide text-slate-700 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
                    >
                      👥 Alumnos
                    </Link>

                    <Link
                      to={`/teacher/course/${c._id}/partials`}
                      className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-center text-xs font-black uppercase tracking-wide text-slate-700 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
                    >
                      📝 Parciales
                    </Link>

                    <Link
                      to={`/teacher/course/${c._id}/boletin`}
                      className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-center text-xs font-black uppercase tracking-wide text-slate-700 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
                    >
                      📊 Boletín
                    </Link>

                    <Link
                      to={`/teacher/course/${c._id}/british`}
                      className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-center text-xs font-black uppercase tracking-wide text-slate-700 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
                    >
                      🇬🇧 Británico
                    </Link>

                    <Link
                      to={`/teacher/course/${c._id}/topics`}
                      className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-center text-xs font-black uppercase tracking-wide text-slate-700 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
                    >
                      📖 Libro de temas
                    </Link>

                    <Link
                      to={`/teacher/course/${c._id}/materials`}
                      className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-center text-xs font-black uppercase tracking-wide text-slate-700 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
                    >
                      📁 Material
                    </Link>

                    <Link
                      to={`/teacher/course/${c._id}/board`}
                      className="rounded-2xl border border-fuchsia-200 bg-fuchsia-50 px-3 py-3 text-center text-xs font-black uppercase tracking-wide text-fuchsia-700 shadow-sm transition hover:bg-fuchsia-100"
                    >
                      💬 Muro
                    </Link>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
