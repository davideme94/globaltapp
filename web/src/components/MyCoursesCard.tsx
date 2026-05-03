import { useQuery } from '@tanstack/react-query';
import { CalendarDays, MapPin, BookOpen } from 'lucide-react';
import { api } from '../lib/api';
import type { CourseScheduleItem, DayCode } from '../lib/api';

const DAY_LABEL: Record<DayCode, string> = {
  MON: 'Lunes',
  TUE: 'Martes',
  WED: 'Miércoles',
  THU: 'Jueves',
  FRI: 'Viernes',
  SAT: 'Sábado',
};

function fmtScheduleItem(it: CourseScheduleItem) {
  const dayLabel = it.day ? DAY_LABEL[it.day] : '';
  return `${dayLabel ? dayLabel + ' ' : ''}${it.start}-${it.end}`;
}

function campusLabel(campus?: string) {
  if (campus === 'DERQUI') return 'Derqui';
  if (campus === 'JOSE_C_PAZ') return 'José C. Paz';
  return campus || 'Sin sede';
}

export default function MyCoursesCard() {
  const q = useQuery({
    queryKey: ['courses', 'mine', 'v3'],
    queryFn: () => api.courses.mine(),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });

  const year = q.data?.year ?? new Date().getFullYear();

  if (q.isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-20 animate-pulse rounded-3xl bg-neutral-100" />
        <div className="h-20 animate-pulse rounded-3xl bg-neutral-100" />
      </div>
    );
  }

  if (q.error) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-bold text-rose-700">
        Error: {(q.error as any)?.message || 'No se pudo cargar'}
      </div>
    );
  }

  if (q.data && q.data.rows.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-neutral-200 bg-neutral-50 p-8 text-center">
        <div className="mb-3 flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-500">
            <BookOpen size={28} />
          </div>
        </div>

        <h3 className="text-lg font-black text-neutral-800">
          No tenés cursos activos en {year}
        </h3>

        <p className="mt-1 text-sm text-neutral-500">
          Cuando estés matriculado/a en un curso, aparecerá en esta sección.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {(q.data?.rows || []).map(({ course, schedule }: any) => (
        <article
          key={course._id}
          className="overflow-hidden rounded-[1.75rem] border border-neutral-200 bg-white shadow-sm transition hover:border-violet-200 hover:shadow-lg"
        >
          <div className="relative overflow-hidden bg-gradient-to-r from-slate-950 via-violet-700 to-indigo-700 px-5 py-4 text-white">
            <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/10 blur-2xl" />

            <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 shadow-sm backdrop-blur">
                  <BookOpen size={22} />
                </div>

                <div className="min-w-0">
                  <h3 className="break-words text-lg font-black leading-tight sm:text-xl">
                    {course.name}
                  </h3>

                  <p className="mt-1 text-sm font-semibold text-white/80">
                    Ciclo lectivo {course.year}
                  </p>
                </div>
              </div>

              <span className="w-fit rounded-full border border-white/20 bg-white/15 px-4 py-2 text-xs font-black uppercase tracking-wide text-white shadow-sm backdrop-blur">
                {campusLabel(course.campus)}
              </span>
            </div>
          </div>

          <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
            <div className="rounded-3xl border border-neutral-200 bg-neutral-50 px-4 py-3">
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-neutral-400">
                <MapPin size={14} />
                Sede
              </p>

              <p className="mt-1 text-sm font-bold text-neutral-700">
                {campusLabel(course.campus)}
              </p>
            </div>

            <div className="rounded-3xl border border-neutral-200 bg-neutral-50 px-4 py-3">
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-neutral-400">
                <CalendarDays size={14} />
                Horario
              </p>

              <p className="mt-1 break-words text-sm font-bold text-neutral-700">
                {Array.isArray(schedule) && schedule.length
                  ? schedule.map((it: CourseScheduleItem) => fmtScheduleItem(it)).join(' · ')
                  : 'Sin horarios cargados'}
              </p>
            </div>
          </div>
        </article>
      ))}

      {import.meta.env.DEV && q.data && (
        <details className="rounded-3xl border border-dashed border-neutral-200 bg-neutral-50 p-4 text-xs text-neutral-500">
          <summary className="cursor-pointer font-black uppercase tracking-wide">
            Debug
          </summary>
          <pre className="mt-3 overflow-auto rounded-2xl bg-white p-3">
            {JSON.stringify(q.data, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}
