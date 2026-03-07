import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';

type Role = 'student'|'teacher';
type Campus = 'DERQUI'|'JOSE_C_PAZ';

type Row = {
  _id: string; name: string; email: string; role: Role; campus: Campus; active: boolean;
};

export default function CoordinatorUsers() {
  const [role, setRole] = useState<Role>('student');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  const [studentCourses, setStudentCourses] = useState<Record<string, string[]>>({});
  const [loadingStudentCourses, setLoadingStudentCourses] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<{ name: string; email?: string; campus: Campus; role: Role }>({
    name: '',
    email: '',
    campus: 'DERQUI',
    role: 'student',
  });

  const [justCreated, setJustCreated] = useState<{ email: string; password: string } | null>(null);

  const filtered = useMemo(() => rows, [rows]);

  async function load() {
    setLoading(true);
    try {
      const { rows } = await api.users.list({ role, q, limit: 50, page: 1 });
      setRows(rows as Row[]);
    } catch (e) {
      console.error(e);
      alert('Error cargando usuarios');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [role, q]);

  useEffect(() => {
    if (role !== 'student' || !rows.length) {
      setStudentCourses({});
      return;
    }
    let alive = true;
    (async () => {
      setLoadingStudentCourses(true);
      try {
        const year = new Date().getFullYear();
        const ids = new Set(rows.map(r => String(r._id)));
        const map: Record<string, string[]> = {};
        const { courses } = await api.courses.list({ year });

        for (const c of courses) {
          if (!alive) return;
          try {
            const { roster } = await api.courses.roster(c._id);
            for (const item of (roster || [])) {
              const sid = String(item?.student?._id || '');
              if (!sid || !ids.has(sid)) continue;
              if (!map[sid]) map[sid] = [];
              map[sid].push(c.name);
            }
          } catch {}
        }

        if (!alive) return;
        setStudentCourses(map);
      } finally {
        if (alive) setLoadingStudentCourses(false);
      }
    })();
    return () => { alive = false; };
  }, [role, rows]);

  const onChange = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      const email = form.email && form.email.trim() ? form.email.trim() : undefined;

      const { user, password } = await api.users.create({
        name: form.name.trim(),
        email,
        campus: form.campus,
        role: form.role,
      });

      setRows(prev => [user as unknown as Row, ...prev]);
      setShowCreate(false);
      setJustCreated({ email: (user as any).email || '(sin email)', password });
      setForm({ name: '', email: '', campus: form.campus, role });

    } catch (err: any) {
      alert(err.message || 'No se pudo crear');
    }
  }

  async function handleReset(u: Row) {
    if (!confirm(`Resetear contraseña de ${u.name}?`)) return;

    try {
      const { password } = await api.users.resetPassword(u._id);

      setJustCreated({
        email: u.email || '(sin email)',
        password
      });

    } catch (e: any) {
      alert(e.message || 'No se pudo resetear');
    }
  }

  async function handleToggleActive(u: Row) {
    try {
      const { user } = await api.users.setActive(u._id, !u.active);
      setRows(prev => prev.map(r => r._id === u._id ? (user as any as Row) : r));
    } catch (e: any) {
      alert(e.message || 'No se pudo actualizar');
    }
  }

  async function handleDelete(u: Row) {
    if (!confirm(`Eliminar a ${u.name}? Esta acción no se puede deshacer.`)) return;
    try {
      await api.users.delete(u._id);
      setRows(prev => prev.filter(r => r._id !== u._id));
    } catch (e: any) {
      alert(e.message || 'No se pudo eliminar (verifique dependencias).');
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Usuarios</h1>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select
          className="border rounded px-3 py-2"
          value={role}
          onChange={e => { const r = e.target.value as Role; setRole(r); setForm(f => ({ ...f, role: r })); }}
        >
          <option value="student">Alumnos</option>
          <option value="teacher">Docentes</option>
        </select>

        <input
          className="border rounded px-3 py-2 flex-1 min-w-[220px]"
          placeholder="Buscar por nombre o email..."
          value={q}
          onChange={e => setQ(e.target.value)}
        />

        <button
          onClick={() => { setForm(f => ({ ...f, role })); setShowCreate(true); }}
          className="bg-indigo-600 text-white px-4 py-2 rounded"
        >
          Crear {role === 'teacher' ? 'docente' : 'alumno'}
        </button>
      </div>

      <div className="overflow-x-auto -mx-2 sm:mx-0">
        <div className="inline-block min-w-[980px] align-middle">
          <div className="bg-white rounded shadow">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="p-3">Nombre</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Rol</th>
                  <th className="p-3">Sede</th>
                  <th className="p-3">Curso(s)</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3">Acciones</th>
                </tr>
              </thead>

              <tbody>
                {loading && (<tr><td className="p-3" colSpan={7}>Cargando...</td></tr>)}

                {!loading && filtered.length === 0 && (
                  <tr><td className="p-3" colSpan={7}>Sin resultados.</td></tr>
                )}

                {!loading && filtered.map(u => (
                  <tr key={u._id} className="border-t">
                    <td className="p-3 font-medium">{u.name}</td>
                    <td className="p-3">{u.email || <span className="text-slate-500">—</span>}</td>
                    <td className="p-3">{u.role}</td>
                    <td className="p-3">{u.campus}</td>

                    <td className="p-3">
                      {u.role === 'student'
                        ? (studentCourses[u._id]?.join(', ') || (loadingStudentCourses ? '...' : ''))
                        : ''}
                    </td>

                    <td className="p-3">{u.active ? 'Activo' : 'Inactivo'}</td>

                    <td className="p-3 space-x-3 whitespace-nowrap">
                      <button className="underline text-indigo-700" onClick={() => handleReset(u)}>Reset clave</button>
                      <button className="underline text-emerald-700" onClick={() => handleToggleActive(u)}>
                        {u.active ? 'Desactivar' : 'Activar'}
                      </button>
                      <button className="underline text-rose-700" onClick={() => handleDelete(u)}>Eliminar</button>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreate}
            className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-screen overflow-y-auto"
          >
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold">Crear {role === 'teacher' ? 'docente' : 'alumno'}</h2>
              <button type="button" onClick={() => setShowCreate(false)}>✕</button>
            </div>

            <div className="p-4 space-y-3">

              <div>
                <label className="text-sm block mb-1">Nombre</label>
                <input className="border rounded px-3 py-2 w-full" value={form.name} onChange={e => onChange('name', e.target.value)} required />
              </div>

              <div>
                <label className="text-sm block mb-1">Email (opcional)</label>
                <input className="border rounded px-3 py-2 w-full" value={form.email || ''} onChange={e => onChange('email', e.target.value)} />
              </div>

              <div>
                <label className="text-sm block mb-1">Sede</label>
                <select className="border rounded px-3 py-2 w-full" value={form.campus} onChange={e => onChange('campus', e.target.value as Campus)}>
                  <option value="DERQUI">DERQUI</option>
                  <option value="JOSE_C_PAZ">JOSE_C_PAZ</option>
                </select>
              </div>

            </div>

            <div className="p-4 border-t flex justify-end gap-2">
              <button type="button" className="px-3 py-2 rounded border" onClick={() => setShowCreate(false)}>Cancelar</button>
              <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded">Crear</button>
            </div>

          </form>
        </div>
      )}

      {justCreated && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">

            <div className="p-4 border-b">
              <h2 className="text-lg font-semibold">Credenciales</h2>
            </div>

            <div className="p-4 space-y-3 text-sm">

              <div><b>Email:</b> {justCreated.email}</div>

              <div>
                <b>Contraseña:</b> <code>{justCreated.password}</code>
              </div>

              <button
                className="px-3 py-2 border rounded"
                onClick={() => {
                  const text = `Email: ${justCreated.email}
Contraseña: ${justCreated.password}`;
                  navigator.clipboard.writeText(text);
                }}
              >
                Copiar
              </button>

            </div>

            <div className="p-4 border-t text-right">
              <button className="px-3 py-2 rounded border" onClick={() => setJustCreated(null)}>
                Cerrar
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
