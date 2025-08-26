import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getAttendance,
  getEnrollments,
  getTeacherCourses,
  saveAttendanceBulk,
  type AttendanceStatus,
} from '../lib/attendance';
import { logout } from '../lib/api';

function today() {
  const d = new Date();
  const mm = `${d.getMonth() + 1}`.padStart(2, '0');
  const dd = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

const CYCLE: AttendanceStatus[] = ['P', 'A', 'T', 'J']; // Presente, Ausente, Tarde, Justificada

export default function Teacher() {
  const qc = useQueryClient();
  const [year] = useState(new Date().getFullYear());
  const [date, setDate] = useState(today());

  // Cursos del docente
  const { data: coursesData } = useQuery({
    queryKey: ['teacher-courses', year],
    queryFn: () => getTeacherCourses(year),
  });
  const courses = coursesData?.courses ?? [];
  const [courseId, setCourseId] = useState<string>('');

  // Selecciona por defecto el primer curso
  useEffect(() => {
    if (!courseId && courses[0]?._id) setCourseId(courses[0]._id);
  }, [courses, courseId]);

  // Inscriptos del curso
  const {
    data: enrollData,
    isLoading: isLoadingEnroll,
    error: enrollError,
  } = useQuery({
    queryKey: ['enrollments', courseId],
    queryFn: () => getEnrollments(courseId),
    enabled: !!courseId,
  });

  // Asistencia del día seleccionado
  const {
    data: attData,
    isLoading: isLoadingAtt,
    error: attError,
  } = useQuery({
    queryKey: ['attendance', courseId, date],
    queryFn: () => getAttendance(courseId, date),
    enabled: !!courseId && !!date,
  });

  const enrollments = enrollData?.enrollments ?? [];

  // Mapa de asistencias guardadas: studentId -> status
  const existing = useMemo(() => {
    const map = new Map<string, AttendanceStatus>();
    (attData?.attendance ?? []).forEach((a: any) =>
      map.set(a.student?._id ?? a.student, a.status as AttendanceStatus)
    );
    return map;
  }, [attData]);

  // Borrador local
  const [draft, setDraft] = useState<Record<string, AttendanceStatus>>({});
  useEffect(() => {
    const next: Record<string, AttendanceStatus> = {};
    enrollments.forEach((e: any) => {
      const sId = e.student?._id ?? e.student;
      next[sId] = existing.get(sId) ?? 'P';
    });
    setDraft(next);
  }, [enrollments, existing]);

  // ¿Hubo cambios?
  const hasChanges = useMemo(
    () =>
      enrollments.some((e: any) => {
        const id = e.student?._id ?? e.student;
        const current = draft[id] ?? 'P';
        const original = existing.get(id) ?? 'P';
        return current !== original;
      }),
    [enrollments, draft, existing]
  );

  // Cambiar estado con clic (P → A → T → J)
  function cycle(id: string) {
    setDraft((d) => {
      const current = d[id] ?? 'P';
      const idx = CYCLE.indexOf(current);
      const next = CYCLE[(idx + 1) % CYCLE.length];
      return { ...d, [id]: next };
    });
  }

  // Guardar bulk
  const saveMut = useMutation({
    mutationFn: () =>
      saveAttendanceBulk(
        courseId,
        date,
        Object.entries(draft).map(([studentId, status]) => ({ studentId, status }))
      ),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['attendance', courseId, date] });
      alert('Asistencia guardada ✔️');
    },
  });

  const loading = isLoadingEnroll || isLoadingAtt;

  return (
    <div className="min-h-screen p-6 space-y-6">
      <header className="flex flex-wrap gap-3 items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Toma de asistencia</h1>
          <p className="text-gray-500 text-sm">
            Marcá Presente (P), Ausente (A), Tarde (T) o Justificada (J).
          </p>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <input
            type="date"
            className="border rounded-xl px-3 py-2"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />

          <select
            className="border rounded-xl px-3 py-2"
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
          >
            {courses.map((c: any) => (
              <option key={c._id} value={c._id}>
                {c.name} • {c.year}
              </option>
            ))}
          </select>

          <button
            onClick={async () => {
              try {
                await logout();
              } finally {
                window.location.reload();
              }
            }}
            className="border rounded-xl px-3 py-2 hover:bg-gray-50"
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      {/* Leyenda */}
      <div className="flex gap-3 text-sm text-gray-600">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-full bg-emerald-500" /> P = Presente
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-full bg-red-500" /> A = Ausente
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-full bg-yellow-400" /> T = Tarde
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-full bg-sky-400" /> J = Justificada
        </span>
      </div>

      <section className="bg-white rounded-2xl shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">
            Alumnos ({enrollments.length})
          </h2>

          <button
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2 px-4 disabled:opacity-50"
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending || !courseId || !date || !hasChanges}
            title={!hasChanges ? 'No hay cambios para guardar' : 'Guardar asistencia'}
          >
            {saveMut.isPending ? 'Guardando…' : 'Guardar asistencia'}
          </button>
        </div>

        {loading && <div className="text-gray-500 mb-2">Cargando…</div>}
        {enrollError && (
          <div className="text-red-600 text-sm mb-2">
            {(enrollError as any).message || 'Error al cargar inscriptos'}
          </div>
        )}
        {attError && (
          <div className="text-red-600 text-sm mb-2">
            {(attError as any).message || 'Error al cargar asistencia'}
          </div>
        )}

        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-left border-b">
              <tr>
                <th className="py-2 pr-3">Alumno</th>
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">Estado (clic para cambiar)</th>
              </tr>
            </thead>
            <tbody>
              {enrollments.map((e: any) => {
                const id = e.student?._id ?? e.student;
                const name = e.student?.name ?? '(?)';
                const email = e.student?.email ?? '';
                const st = draft[id] ?? 'P';
                return (
                  <tr key={id} className="border-b last:border-0">
                    <td className="py-2 pr-3">{name}</td>
                    <td className="py-2 pr-3">{email}</td>
                    <td className="py-2 pr-3">
                      <button
                        className="border rounded-xl px-4 py-1 hover:bg-gray-50"
                        onClick={() => cycle(id)}
                        type="button"
                        title="Clic para cambiar estado"
                      >
                        {st}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {enrollments.length === 0 && !loading && (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-gray-500">
                    No hay inscriptos en este curso.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
