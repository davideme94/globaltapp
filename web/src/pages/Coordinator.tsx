import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createCourse, enrollByEmail, getCourses } from '../lib/courses';
import { useState } from 'react';
import { logout } from '../lib/api';

const thisYear = new Date().getFullYear();

function errMsg(e: unknown) {
  try {
    const m = (e as any)?.message || '';
    if (!m) return 'Error inesperado';
    const j = JSON.parse(m);
    return j?.error || m;
  } catch {
    return (e as any)?.message || 'Error inesperado';
  }
}

export default function Coordinator() {
  const qc = useQueryClient();
  const [year, setYear] = useState(thisYear);
  const [campus, setCampus] = useState<'DERQUI' | 'JOSE_C_PAZ'>('DERQUI');

  const { data, isLoading } = useQuery({
    queryKey: ['courses', year, campus],
    queryFn: () => getCourses({ year, campus })
  });

  // Crear curso
  const [form, setForm] = useState({
    name: '2° KIDS',
    level: 'Kids',
    teacherEmail: 'teacher@globalt.test',
    daysOfWeek: '2,4',
    startTime: '18:00',
    endTime: '19:00'
  });

  const createMut = useMutation({
    mutationFn: () =>
      createCourse({
        name: form.name,
        level: form.level || undefined,
        year,
        campus,
        teacherEmail: form.teacherEmail,
        daysOfWeek: form.daysOfWeek
          .split(',')
          .map((n) => parseInt(n.trim(), 10))
          .filter((n) => Number.isFinite(n)),
        startTime: form.startTime || undefined,
        endTime: form.endTime || undefined
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['courses', year, campus] })
  });

  // Inscribir por email
  const [enroll, setEnroll] = useState({ studentEmail: 'alumno1@globalt.test', courseId: '' });
  const enrollMut = useMutation({
    mutationFn: () => enrollByEmail({ studentEmail: enroll.studentEmail, courseId: enroll.courseId }),
    onSuccess: () => alert('Alumno inscripto ✔️')
  });

  return (
    <div className="min-h-screen p-6 space-y-8">
      <header className="flex flex-wrap gap-3 items-end justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Coordinación</h1>
          <span className="text-gray-500 text-sm">Gestión de cursos e inscripciones</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="border rounded-xl px-3 py-2"
            value={campus}
            onChange={(e) => setCampus(e.target.value as any)}
          >
            <option value="DERQUI">Derqui</option>
            <option value="JOSE_C_PAZ">José C. Paz</option>
          </select>
          <input
            type="number"
            className="border rounded-xl px-3 py-2 w-28"
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value || `${thisYear}`, 10))}
          />
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

      <section className="grid md:grid-cols-2 gap-6">
        {/* Crear curso */}
        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="font-semibold mb-4">Crear curso</h2>
          <div className="grid gap-3">
            <input className="border rounded-xl px-3 py-2" placeholder="Nombre (ej: 2° KIDS)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="border rounded-xl px-3 py-2" placeholder="Nivel" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} />
            <input className="border rounded-xl px-3 py-2" placeholder="Email del docente" value={form.teacherEmail} onChange={(e) => setForm({ ...form, teacherEmail: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <input className="border rounded-xl px-3 py-2" placeholder="Días (1..7) ej: 2,4" value={form.daysOfWeek} onChange={(e) => setForm({ ...form, daysOfWeek: e.target.value })} />
              <div className="flex gap-2">
                <input className="border rounded-xl px-3 py-2 flex-1" placeholder="Inicio 18:00" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
                <input className="border rounded-xl px-3 py-2 flex-1" placeholder="Fin 19:00" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
              </div>
            </div>
            <button
              onClick={() => createMut.mutate()}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2 disabled:opacity-50"
              disabled={createMut.isPending}
            >
              {createMut.isPending ? 'Creando…' : 'Crear curso'}
            </button>
            {createMut.error && <p className="text-sm text-red-600">{errMsg(createMut.error)}</p>}
          </div>
        </div>

        {/* Inscribir alumno */}
        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="font-semibold mb-4">Inscribir alumno por email</h2>
          <div className="grid gap-3">
            <input className="border rounded-xl px-3 py-2" placeholder="Email del alumno" value={enroll.studentEmail} onChange={(e) => setEnroll({ ...enroll, studentEmail: e.target.value })} />
            <select
              className="border rounded-xl px-3 py-2"
              value={enroll.courseId}
              onChange={(e) => setEnroll({ ...enroll, courseId: e.target.value })}
            >
              <option value="">Elegí un curso…</option>
              {(data?.courses ?? []).map((c: any) => (
                <option key={c._id} value={c._id}>
                  {c.name} • {c.year} • {c.campus}
                </option>
              ))}
            </select>
            <button
              onClick={() => enroll.courseId && enrollMut.mutate()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-2 disabled:opacity-50"
              disabled={enrollMut.isPending || !enroll.courseId}
            >
              {enrollMut.isPending ? 'Inscribiendo…' : 'Inscribir'}
            </button>
            {enrollMut.error && <p className="text-sm text-red-600">{errMsg(enrollMut.error)}</p>}
          </div>
        </div>
      </section>

      {/* Lista de cursos */}
      <section className="bg-white rounded-2xl shadow p-6">
        <h2 className="font-semibold mb-4">Cursos ({isLoading ? 'cargando…' : data?.courses?.length ?? 0})</h2>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-left border-b">
              <tr>
                <th className="py-2 pr-3">Nombre</th>
                <th className="py-2 pr-3">Año</th>
                <th className="py-2 pr-3">Sede</th>
                <th className="py-2 pr-3">Docente</th>
                <th className="py-2 pr-3">Días</th>
                <th className="py-2 pr-3">Horario</th>
              </tr>
            </thead>
            <tbody>
              {(data?.courses ?? []).map((c: any) => (
                <tr key={c._id} className="border-b last:border-0">
                  <td className="py-2 pr-3">{c.name}</td>
                  <td className="py-2 pr-3">{c.year}</td>
                  <td className="py-2 pr-3">{c.campus === 'DERQUI' ? 'Derqui' : 'José C. Paz'}</td>
                  <td className="py-2 pr-3">{c.teacher?.name} ({c.teacher?.email})</td>
                  <td className="py-2 pr-3">{(c.daysOfWeek || []).join(', ')}</td>
                  <td className="py-2 pr-3">{c.startTime} - {c.endTime}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
