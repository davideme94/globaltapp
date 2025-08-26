import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { CourseScheduleItem, DayCode } from '../lib/api';
import { Calendar } from 'lucide-react';

const DAY_LABEL: Record<DayCode, string> = {
  MON: 'Lunes',
  TUE: 'Martes',
  WED: 'Miércoles',
  THU: 'Jueves',
  FRI: 'Viernes',
  SAT: 'Sábado',
};

function fmtScheduleItem(it: CourseScheduleItem) {
  const dayLabel = it.day ? DAY_LABEL[it.day] : ''; // soporta items sin 'day'
  return `${dayLabel ? dayLabel + ' ' : ''}${it.start}-${it.end}`;
}

export default function MyCoursesCard() {
  // ⚠️ Forzamos re-fetch para evitar caché viejo
  const q = useQuery({
    queryKey: ['courses', 'mine', 'v3'], // cambia la key para invalidar caché previo
    queryFn: () => api.courses.mine(),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });

  const year = q.data?.year ?? new Date().getFullYear();

  return (
    <div className="mt-6 rounded-2xl border p-4 bg-white">
      <h2 className="text-lg font-semibold mb-2">Mis cursos y horarios ({year})</h2>

      {q.isLoading && <p>Cargando…</p>}
      {q.error && <p className="text-red-600">Error: {(q.error as any)?.message || 'No se pudo cargar'}</p>}

      {q.data && q.data.rows.length === 0 && (
        <p className="text-gray-600">Aún no estás matriculado en cursos o no tienen horarios cargados.</p>
      )}

      <ul className="space-y-3">
        {q.data?.rows.map(({ course, schedule }: any) => (
          <li key={course._id} className="flex items-start justify-between gap-4 rounded-xl border p-3">
            <div>
              <div className="font-medium">{course.name} — {course.year}</div>
              <div className="text-sm text-gray-600">
                Sede: {course.campus === 'DERQUI' ? 'Derqui' : 'José C. Paz'}
              </div>
            </div>
            <div className="text-sm text-gray-800 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {Array.isArray(schedule) && schedule.length ? (
                <span>{schedule.map((it: CourseScheduleItem) => fmtScheduleItem(it)).join(' · ')}</span>
              ) : (
                <span className="text-gray-500">Sin horarios cargados</span>
              )}
            </div>
          </li>
        ))}
      </ul>

      {/* Debug en dev: muestra el JSON que vuelve del server */}
      {import.meta.env.DEV && q.data && (
        <details className="mt-3 text-xs text-gray-500">
          <summary>Debug</summary>
          <pre className="overflow-auto">{JSON.stringify(q.data, null, 2)}</pre>
        </details>
      )}
    </div>
  );
}
