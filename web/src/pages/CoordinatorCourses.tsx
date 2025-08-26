import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

type Teacher = { _id:string; name:string; email:string };

// Soportamos que el backend devuelva teacher:
// - como string (ID)   -> buscamos el nombre en teachers
// - como objeto        -> usamos name/email
function teacherLabel(teacher: unknown, teacherById: Map<string, Teacher>) {
  if (!teacher) return '—';
  if (typeof teacher === 'string') {
    return teacherById.get(teacher)?.name || '—';
  }
  if (typeof teacher === 'object') {
    const t = teacher as Partial<Teacher>;
    return t.name || t.email || '—';
  }
  return '—';
}

export default function CoordinatorCourses() {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState<number>(thisYear);
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Crear curso
  const [cName, setCName] = useState('Inglés A1');
  const [cCampus, setCCampus] = useState<'DERQUI'|'JOSE_C_PAZ'>('DERQUI');
  const [cTeacher, setCTeacher] = useState<string>('');

  // Docentes
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [newTName, setNewTName] = useState('');
  const [newTEmail, setNewTEmail] = useState('');
  const [newTCampus, setNewTCampus] = useState<'DERQUI'|'JOSE_C_PAZ'>('DERQUI');

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true); setErr(null);
      try {
        const [{ courses }, { rows }] = await Promise.all([
          api.courses.list({ year }),
          api.users.list({ role: 'teacher' })
        ]);
        if (!alive) return;
        setCourses(courses);
        // normalizamos teachers
        setTeachers((rows as any[]).map(r => ({ _id:r._id, name:r.name, email:r.email })));
      } catch (e:any) {
        if (!alive) return;
        setErr(e.message || 'Error');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [year]);

  const teacherById = useMemo(
    () => new Map(teachers.map(t => [t._id, t])),
    [teachers]
  );

  const createCourse = async () => {
    try {
      const { course } = await api.courses.create({ name: `${cName} ${year}`, year, campus: cCampus });
      if (cTeacher) {
        await api.courses.assignTeacher(course._id, cTeacher);
      }
      setCourses(prev => [course, ...prev]);
      setCName('Inglés A1');
    } catch (e:any) {
      alert(e.message || 'No se pudo crear el curso');
    }
  };

  const quickCreateTeacher = async () => {
    if (!newTName || !newTEmail) return alert('Nombre y email son requeridos');
    const password = 'profe123';
    try {
      const { user } = await api.users.create({
        name: newTName,
        email: newTEmail,
        role: 'teacher',
        campus: newTCampus,
      } as any);
      setTeachers(prev => [{ _id:user._id, name:user.name, email:user.email }, ...prev]);
      setCTeacher(user._id);
      setNewTName('');
      setNewTEmail('');
      alert(`Docente creado.\nUsuario: ${user.email}\nClave: ${password}`);
    } catch (e:any) {
      alert(e.message || 'No se pudo crear el docente');
    }
  };

  return (
    <div className="space-y-3">
      <h1 className="font-heading text-xl">Cursos ({year})</h1>

      {/* Filtros/Año */}
      <div className="card p-4 grid grid-cols-1 md:grid-cols-[160px,1fr,auto] gap-3 items-end">
        <div>
          <label className="text-sm block mb-1">Año</label>
          <input
            className="input w-full"
            type="number"
            value={year}
            onChange={e => setYear(Number(e.target.value || thisYear))}
          />
        </div>
      </div>

      {/* Crear curso */}
      <div className="card p-4 grid grid-cols-1 md:grid-cols-[1fr,160px,220px,220px,120px,auto] gap-3 items-end">
        <div>
          <label className="text-sm block mb-1">Nombre</label>
          <input className="input w-full" value={cName} onChange={e => setCName(e.target.value)} placeholder="Inglés A1 / 2° KIDS / ..." />
        </div>
        <div>
          <label className="text-sm block mb-1">Año</label>
          <input className="input w-full" type="number" value={year} onChange={e => setYear(Number(e.target.value || thisYear))} />
        </div>
        <div>
          <label className="text-sm block mb-1">Sede</label>
          <select className="input w-full" value={cCampus} onChange={e => setCCampus(e.target.value as any)}>
            <option value="DERQUI">Derqui</option>
            <option value="JOSE_C_PAZ">José C. Paz</option>
          </select>
        </div>
        <div>
          <label className="text-sm block mb-1">Docente</label>
          <select className="input w-full" value={cTeacher} onChange={e => setCTeacher(e.target.value)}>
            <option value="">— Seleccionar —</option>
            {teachers.map(t => (
              <option key={t._id} value={t._id}>{t.name} — {t.email}</option>
            ))}
          </select>
        </div>
        <div>
          <button className="btn btn-primary w-full" onClick={createCourse}>Crear</button>
        </div>
      </div>

      {/* Crear docente rápido */}
      <div className="card p-4 grid grid-cols-1 md:grid-cols-[1fr,1fr,150px,120px] gap-3 items-end">
        <div>
          <label className="text-sm block mb-1">Nuevo docente — Nombre completo</label>
          <input className="input w-full" value={newTName} onChange={e => setNewTName(e.target.value)} />
        </div>
        <div>
          <label className="text-sm block mb-1">Email</label>
          <input className="input w-full" value={newTEmail} onChange={e => setNewTEmail(e.target.value)} />
        </div>
        <div>
          <label className="text-sm block mb-1">Sede</label>
          <select className="input w-full" value={newTCampus} onChange={e => setNewTCampus(e.target.value as any)}>
            <option value="DERQUI">Derqui</option>
            <option value="JOSE_C_PAZ">José C. Paz</option>
          </select>
        </div>
        <div>
          <button className="btn btn-secondary w-full" onClick={quickCreateTeacher}>Crear docente</button>
        </div>
      </div>

      {/* Listado */}
      <div className="card p-4 overflow-x-auto">
        {loading && <div className="h-24 skeleton" />}
        {err && <div className="text-danger">{err}</div>}
        {!loading && !err && (
          <table className="min-w-full">
            <thead>
              <tr className="text-left text-sm text-neutral-700">
                <th className="px-3 py-2 border-b">Nombre</th>
                <th className="px-3 py-2 border-b">Sede</th>
                <th className="px-3 py-2 border-b">Año</th>
                <th className="px-3 py-2 border-b">Docente</th>
                <th className="px-3 py-2 border-b">Acciones</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {courses.map((c:any) => (
                <tr key={c._id} className="hover:bg-neutral-50">
                  <td className="px-3 py-2">{c.name}</td>
                  <td className="px-3 py-2">{c.campus === 'DERQUI' ? 'DERQUI' : 'JOSE C. PAZ'}</td>
                  <td className="px-3 py-2">{c.year}</td>
                  <td className="px-3 py-2">
                    {teacherLabel((c as any).teacher, teacherById)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <Link to={`/coordinator/course/${c._id}/manage`} className="text-brand-primary underline">Gestionar</Link>
                      <Link to={`/coordinator/course/${c._id}/schedule`} className="text-brand-primary underline">Horarios</Link>
                      <Link to={`/coordinator/course/${c._id}/practice`} className="text-brand-primary underline">Práctica</Link>
                      <Link to={`/coordinator/course/${c._id}/topics`} className="text-brand-primary underline">Libro de temas</Link>
                      <Link to={`/coordinator/course/${c._id}/materials`} className="text-brand-primary underline">Material</Link>
                      <Link to={`/coordinator/course/${c._id}/partials`} className="text-brand-primary underline">Informes parciales</Link>
                      <Link to={`/coordinator/course/${c._id}/boletin`} className="text-brand-primary underline">Boletín</Link>
                      <Link to={`/coordinator/course/${c._id}/british`} className="text-brand-primary underline">Británico</Link>
                    </div>
                  </td>
                </tr>
              ))}
              {courses.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-neutral-700">Sin cursos para {year}.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
