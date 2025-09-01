// src/components/StudentAttendanceCard.tsx
import { useQueries, useQuery } from '@tanstack/react-query';
import { Calendar, UserRound } from 'lucide-react';

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

type Course = { _id: string; name: string; year: number; campus: 'DERQUI'|'JOSE_C_PAZ' };
type MyCourseRow = { course: Course; schedule: { day?: string; start: string; end: string }[] };
type MineCoursesResp = { year: number; rows: MyCourseRow[] };

const statusClass: Record<string, string> = {
  P: 'bg-green-500',
  A: 'bg-red-500',
  T: 'bg-yellow-500',
  J: 'bg-blue-500',
  null: 'bg-gray-200',
};

export default function StudentAttendanceCard() {
  // Mis cursos
  const coursesQ = useQuery<MineCoursesResp>({
    queryKey: ['courses','mine'],
    queryFn: async () => {
      const data = await get<MineCoursesResp>('/courses/mine');
      console.debug('[AttendanceCard] /courses/mine ->', data);
      return data;
    },
    staleTime: 60_000,
  });

  const rows = coursesQ.data?.rows ?? [];

  // Asistencia por curso
  const attendanceQs = useQueries({
    queries: rows.map((r) => ({
      queryKey: ['attendance','mine', r.course._id],
      queryFn: async () => {
        const d = await get<{ dates: string[]; row: {
          statusByDate: Record<string,'P'|'A'|'T'|'J'|null>;
          resume: { P:number; A:number; J:number; T:number; total:number; percent:number };
        } }>(`/attendance/mine?courseId=${encodeURIComponent(r.course._id)}`);
        console.debug('[AttendanceCard] /attendance/mine', r.course._id, d);
        return d;
      },
      enabled: !!r.course._id,
      staleTime: 60_000,
      retry: false,
    })),
  });

  // Docente por curso
  const teacherQs = useQueries({
    queries: rows.map((r) => ({
      queryKey: ['courses','teacher', r.course._id],
      queryFn: async () => {
        const d = await get<{ teacher: { _id:string; name:string; email:string; photoUrl?:string } | null }>(
          `/courses/${encodeURIComponent(r.course._id)}/teacher`
        );
        console.debug('[AttendanceCard] /courses/:id/teacher', r.course._id, d);
        return d;
      },
      enabled: !!r.course._id,
      staleTime: 60_000,
      retry: false,
    })),
  });

  if (coursesQ.isLoading) return <div className="p-4">Cargando asistencias…</div>;
  if (coursesQ.error) {
    console.error('[AttendanceCard] Error /courses/mine', coursesQ.error);
    return <div className="p-4 text-red-600">No se pudieron cargar tus cursos.</div>;
  }

  return (
    <div className="rounded-2xl border bg-white p-4" id="asistencias">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-pink-100 text-pink-700">
          <Calendar size={18} />
        </div>
        <h3 className="text-lg font-semibold">Asistencias</h3>
      </div>

      {rows.length === 0 && <p className="text-sm text-gray-600">No tenés cursos activos.</p>}

      <div className="space-y-6">
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

          return (
            <div key={row.course._id} className="rounded-xl border p-3">
              {/* Encabezado curso + docente */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  {/* 🔧 QUITADO el año para evitar doble “2025” */}
                  <div className="font-medium">{row.course.name}</div>
                  <div className="text-sm text-gray-600 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1">
                      <UserRound size={14} />
                      Docente:
                    </span>
                    {tQ?.isLoading ? (
                      <span>Cargando…</span>
                    ) : teacher ? (
                      <span className="font-medium">{teacher.name}</span>
                    ) : (
                      <span className="italic">No asignado</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {teacher?.photoUrl ? (
                    <img src={teacher.photoUrl} alt="Docente" className="w-9 h-9 rounded-full object-cover" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-gray-200" />
                  )}
                </div>
              </div>

              {statusMsg && <div className="mt-3 text-sm text-gray-600">{statusMsg}</div>}

              {/* Totales */}
              {a?.row?.resume && (
                <div className="mt-3 text-sm">
                  <div className="flex flex-wrap gap-4">
                    <span><b>Presentes:</b> {a.row.resume.P}</span>
                    <span><b>Ausentes:</b> {a.row.resume.A}</span>
                    <span><b>Justificadas:</b> {a.row.resume.J}</span>
                    <span><b>Tardes:</b> {a.row.resume.T}</span>
                    <span><b>% Asistencia:</b> {a.row.resume.percent}%</span>
                  </div>
                </div>
              )}

              {/* Cuadrito */}
              {a?.dates?.length ? (
                <div className="mt-3">
                  <div className="flex flex-wrap gap-1">
                    {a.dates.map((d: string) => {
                      const s = (a.row.statusByDate[d] ?? 'null') as keyof typeof statusClass;
                      return (
                        <div
                          key={d}
                          title={`${d} — ${a.row.statusByDate[d] || '—'}`}
                          className={`w-4 h-4 rounded ${statusClass[s]}`}
                        />
                      );
                    })}
                  </div>
                  <div className="mt-2 text-xs text-gray-500 flex gap-3">
                    <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500 inline-block" /> P</span>
                    <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500 inline-block" /> A</span>
                    <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-500 inline-block" /> J</span>
                    <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-500 inline-block" /> T</span>
                    <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-200 inline-block" /> —</span>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
