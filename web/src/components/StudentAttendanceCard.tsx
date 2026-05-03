// src/components/StudentAttendanceCard.tsx
import { useQueries, useQuery } from '@tanstack/react-query';
import { Calendar, UserRound, Percent, CheckCircle2, XCircle, Clock3, FileCheck2 } from 'lucide-react';

const ORIGIN = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const BASE = ORIGIN ? `${ORIGIN}/api` : '/api';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { credentials: 'include' });
  const ct = res.headers.get('content-type') || '';
  const isJSON = ct.includes('application/json');
  const payload: any = isJSON ? await res.json() : await res.text();

  if (!res.ok) {
    const msg = (payload && payload.error) || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return payload as T;
}

type Course = {
  _id: string;
  name: string;
  year: number;
  campus: 'DERQUI' | 'JOSE_C_PAZ';
};

type MyCourseRow = {
  course: Course;
  schedule: { day?: string; start: string; end: string }[];
};

type MineCoursesResp = {
  year: number;
  rows: MyCourseRow[];
};

const statusClass: Record<string, string> = {
  P: 'bg-emerald-500',
  A: 'bg-rose-500',
  T: 'bg-amber-400',
  J: 'bg-sky-500',
  null: 'bg-neutral-200',
};

function campusLabel(campus?: string) {
  if (campus === 'DERQUI') return 'Derqui';
  if (campus === 'JOSE_C_PAZ') return 'José C. Paz';
  return campus || 'Sin sede';
}

function StatBox({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number | string;
  icon: any;
  tone: 'emerald' | 'rose' | 'sky' | 'amber' | 'violet';
}) {
  const styles = {
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    rose: 'border-rose-100 bg-rose-50 text-rose-700',
    sky: 'border-sky-100 bg-sky-50 text-sky-700',
    amber: 'border-amber-100 bg-amber-50 text-amber-700',
    violet: 'border-violet-100 bg-violet-50 text-violet-700',
  }[tone];

  return (
    <div className={`rounded-3xl border px-4 py-3 ${styles}`}>
      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide opacity-80">
        <Icon size={14} />
        {label}
      </p>

      <p className="mt-1 text-2xl font-black">
        {value}
      </p>
    </div>
  );
}

export default function StudentAttendanceCard() {
  const coursesQ = useQuery<MineCoursesResp>({
    queryKey: ['courses', 'mine'],
    queryFn: async () => {
      const data = await get<MineCoursesResp>('/courses/mine');
      console.debug('[AttendanceCard] /courses/mine ->', data);
      return data;
    },
    staleTime: 60_000,
  });

  const rows = coursesQ.data?.rows ?? [];

  const attendanceQs = useQueries({
    queries: rows.map((r) => ({
      queryKey: ['attendance', 'mine', r.course._id],
      queryFn: async () => {
        const d = await get<{
          dates: string[];
          row: {
            statusByDate: Record<string, 'P' | 'A' | 'T' | 'J' | null>;
            resume: { P: number; A: number; J: number; T: number; total: number; percent: number };
          };
        }>(`/attendance/mine?courseId=${encodeURIComponent(r.course._id)}`);

        console.debug('[AttendanceCard] /attendance/mine', r.course._id, d);

        return d;
      },
      enabled: !!r.course._id,
      staleTime: 60_000,
      retry: false,
    })),
  });

  const teacherQs = useQueries({
    queries: rows.map((r) => ({
      queryKey: ['courses', 'teacher', r.course._id],
      queryFn: async () => {
        const d = await get<{
          teacher: { _id: string; name: string; email: string; photoUrl?: string } | null;
        }>(`/courses/${encodeURIComponent(r.course._id)}/teacher`);

        console.debug('[AttendanceCard] /courses/:id/teacher', r.course._id, d);

        return d;
      },
      enabled: !!r.course._id,
      staleTime: 60_000,
      retry: false,
    })),
  });

  if (coursesQ.isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-32 animate-pulse rounded-3xl bg-neutral-100" />
        <div className="h-32 animate-pulse rounded-3xl bg-neutral-100" />
      </div>
    );
  }

  if (coursesQ.error) {
    console.error('[AttendanceCard] Error /courses/mine', coursesQ.error);

    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-bold text-rose-700">
        No se pudieron cargar tus cursos.
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-neutral-200 bg-neutral-50 p-8 text-center">
        <div className="mb-3 flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-500">
            <Calendar size={28} />
          </div>
        </div>

        <h3 className="text-lg font-black text-neutral-800">
          No tenés cursos activos
        </h3>

        <p className="mt-1 text-sm text-neutral-500">
          Cuando tengas cursos, tu asistencia aparecerá en esta sección.
        </p>
      </div>
    );
  }

  return (
    <div id="asistencias" className="space-y-5">
      {rows.map((row, idx) => {
        const aQ = attendanceQs[idx];
        const tQ = teacherQs[idx];

        const a = aQ?.data as any;
        const teacher = (tQ?.data as any)?.teacher || null;

        const statusMsg = aQ?.error
          ? 'No se pudo cargar tu asistencia.'
          : tQ?.error
            ? 'No se pudo cargar el docente.'
            : aQ?.isLoading || tQ?.isLoading
              ? 'Cargando…'
              : null;

        const resume = a?.row?.resume;

        return (
          <article
            key={row.course._id}
            className="overflow-hidden rounded-[1.75rem] border border-neutral-200 bg-white shadow-sm transition hover:border-emerald-200 hover:shadow-lg"
          >
            <div className="relative overflow-hidden bg-gradient-to-r from-slate-950 via-violet-700 to-indigo-700 px-5 py-4 text-white">
              <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/10 blur-2xl" />

              <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 shadow-sm backdrop-blur">
                    <Calendar size={22} />
                  </div>

                  <div className="min-w-0">
                    <h3 className="break-words text-lg font-black leading-tight sm:text-xl">
                      {row.course.name}
                    </h3>

                    <p className="mt-1 text-sm font-semibold text-white/80">
                      {campusLabel(row.course.campus)} · Ciclo lectivo {row.course.year}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-3xl border border-white/20 bg-white/15 px-4 py-3 shadow-sm backdrop-blur">
                  {teacher?.photoUrl ? (
                    <img
                      src={teacher.photoUrl}
                      alt="Docente"
                      className="h-10 w-10 rounded-full object-cover ring-2 ring-white/40"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                      <UserRound size={20} />
                    </div>
                  )}

                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-wide text-white/70">
                      Docente
                    </p>
                    <p className="max-w-[220px] truncate text-sm font-bold text-white">
                      {tQ?.isLoading ? 'Cargando…' : teacher ? teacher.name : 'No asignado'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4 p-4 sm:p-5">
              {statusMsg && (
                <div className="rounded-3xl border border-neutral-200 bg-neutral-50 px-5 py-4 text-sm font-bold text-neutral-600">
                  {statusMsg}
                </div>
              )}

              {resume && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <StatBox label="Presentes" value={resume.P} icon={CheckCircle2} tone="emerald" />
                  <StatBox label="Ausentes" value={resume.A} icon={XCircle} tone="rose" />
                  <StatBox label="Justificadas" value={resume.J} icon={FileCheck2} tone="sky" />
                  <StatBox label="Tardes" value={resume.T} icon={Clock3} tone="amber" />
                  <StatBox label="Asistencia" value={`${resume.percent}%`} icon={Percent} tone="violet" />
                </div>
              )}

              {a?.dates?.length ? (
                <div className="rounded-3xl border border-neutral-200 bg-neutral-50 p-4">
                  <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <h4 className="text-sm font-black uppercase tracking-wide text-neutral-700">
                      Registro por clase
                    </h4>

                    <span className="w-fit rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-black text-neutral-500">
                      {a.dates.length} registro{a.dates.length === 1 ? '' : 's'}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {a.dates.map((d: string) => {
                      const s = (a.row.statusByDate[d] ?? 'null') as keyof typeof statusClass;

                      return (
                        <div
                          key={d}
                          title={`${d} — ${a.row.statusByDate[d] || '—'}`}
                          className={`h-4 w-4 rounded-md shadow-sm ${statusClass[s]}`}
                        />
                      );
                    })}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3 text-xs font-bold text-neutral-500">
                    <span className="inline-flex items-center gap-1">
                      <span className="h-3 w-3 rounded bg-emerald-500" /> P
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-3 w-3 rounded bg-rose-500" /> A
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-3 w-3 rounded bg-sky-500" /> J
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-3 w-3 rounded bg-amber-400" /> T
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-3 w-3 rounded bg-neutral-200" /> —
                    </span>
                  </div>
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed border-neutral-200 bg-neutral-50 p-6 text-center">
                  <p className="text-sm font-bold text-neutral-700">
                    Todavía no hay registros de asistencia para este curso.
                  </p>
                </div>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
