import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';

type Role = 'student'|'teacher';
type Campus = 'DERQUI'|'JOSE_C_PAZ';

type Row = {
  _id: string; name: string; email: string; role: Role; campus: Campus; active: boolean;
};

type EditForm = {
  name: string;
  email: string;
  campus: Campus;
};

function roleLabel(role: Role) {
  return role === 'teacher' ? 'Docente' : 'Alumno';
}

function campusLabel(campus: Campus) {
  return campus === 'DERQUI' ? 'Derqui' : 'José C. Paz';
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={
        active
          ? 'inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700'
          : 'inline-flex rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-700'
      }
    >
      {active ? 'Activo' : 'Inactivo'}
    </span>
  );
}

function RoleBadge({ role }: { role: Role }) {
  return (
    <span
      className={
        role === 'teacher'
          ? 'inline-flex rounded-full bg-purple-100 px-3 py-1 text-xs font-bold text-purple-700'
          : 'inline-flex rounded-full bg-sky-100 px-3 py-1 text-xs font-bold text-sky-700'
      }
    >
      {roleLabel(role)}
    </span>
  );
}

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

  const [editingUser, setEditingUser] = useState<Row | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    name: '',
    email: '',
    campus: 'DERQUI',
  });
  const [savingEdit, setSavingEdit] = useState(false);

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

  function openEdit(u: Row) {
    setEditingUser(u);
    setEditForm({
      name: u.name || '',
      email: u.email || '',
      campus: u.campus,
    });
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();

    if (!editingUser) return;
    if (!editForm.name.trim()) {
      alert('El nombre no puede estar vacío');
      return;
    }

    setSavingEdit(true);

    try {
      const { user } = await api.users.update(editingUser._id, {
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        campus: editForm.campus,
      });

      setRows(prev =>
        prev.map(r => r._id === editingUser._id ? (user as Row) : r)
      );

      setEditingUser(null);
    } catch (e: any) {
      alert(e.message || 'No se pudo editar el usuario');
    } finally {
      setSavingEdit(false);
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
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      {/* Header */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-600 via-fuchsia-500 to-pink-500 p-[2px] shadow-xl">
        <div className="relative rounded-3xl bg-white/95 p-6 md:p-8">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-purple-200/60 blur-3xl" />
          <div className="absolute -bottom-12 -left-10 h-40 w-40 rounded-full bg-pink-200/60 blur-3xl" />

          <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-3 w-fit rounded-full border border-purple-100 bg-purple-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-purple-700">
                Gestión institucional
              </div>

              <h1 className="font-heading text-3xl font-black tracking-tight text-neutral-900 md:text-4xl">
                Personas
              </h1>

              <p className="mt-2 max-w-2xl text-sm text-neutral-600 md:text-base">
                Administrá alumnos y docentes. Podés crear usuarios, editar información,
                resetear claves, activar/desactivar cuentas y eliminar registros cuando corresponda.
              </p>
            </div>

            <div className="w-fit rounded-2xl border border-purple-100 bg-purple-50 px-4 py-3 text-sm shadow-sm">
              <p className="font-black text-purple-800">
                {filtered.length} {role === 'teacher' ? 'docente' : 'alumno'}
                {filtered.length === 1 ? '' : 's'}
              </p>
              <p className="text-xs text-purple-500">
                Vista actual: {roleLabel(role)}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Filtros */}
      <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-100 text-2xl">
            🔎
          </div>

          <div>
            <h2 className="text-lg font-black text-neutral-900">
              Buscar y filtrar
            </h2>
            <p className="text-sm text-neutral-500">
              Elegí si querés ver alumnos o docentes y buscá por nombre o email.
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-[220px_1fr_auto]">
          <select
            className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-700 outline-none transition focus:border-purple-400 focus:bg-white focus:ring-4 focus:ring-purple-100"
            value={role}
            onChange={e => {
              const r = e.target.value as Role;
              setRole(r);
              setForm(f => ({ ...f, role: r }));
            }}
          >
            <option value="student">Alumnos</option>
            <option value="teacher">Docentes</option>
          </select>

          <input
            className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-700 outline-none transition placeholder:text-neutral-400 focus:border-purple-400 focus:bg-white focus:ring-4 focus:ring-purple-100"
            placeholder="Buscar por nombre o email..."
            value={q}
            onChange={e => setQ(e.target.value)}
          />

          <button
            onClick={() => { setForm(f => ({ ...f, role })); setShowCreate(true); }}
            className="rounded-2xl bg-gradient-to-r from-purple-600 to-pink-500 px-5 py-3 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-purple-200 transition hover:-translate-y-0.5 hover:shadow-xl"
          >
            Crear {role === 'teacher' ? 'docente' : 'alumno'}
          </button>
        </div>
      </section>

      {/* Lista */}
      <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-black text-neutral-900">
              Listado de {role === 'teacher' ? 'docentes' : 'alumnos'}
            </h2>
            <p className="text-sm text-neutral-500">
              {loading
                ? 'Cargando registros...'
                : filtered.length
                  ? 'Usá las acciones para editar información, activar, resetear clave o eliminar.'
                  : 'No hay resultados para mostrar.'}
            </p>
          </div>

          <span className="w-fit rounded-full border border-purple-100 bg-purple-50 px-4 py-2 text-xs font-black uppercase tracking-wide text-purple-700">
            {filtered.length} resultado{filtered.length === 1 ? '' : 's'}
          </span>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-8 text-center">
            <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-purple-200 border-t-purple-600" />
            <p className="text-sm font-semibold text-neutral-600">Cargando...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 p-10 text-center">
            <div className="mb-3 text-5xl">📭</div>
            <h3 className="text-lg font-black text-neutral-800">
              Sin resultados
            </h3>
            <p className="mt-1 text-sm text-neutral-500">
              Probá cambiar el filtro o crear un nuevo usuario.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filtered.map(u => (
              <article
                key={u._id}
                className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-purple-200 hover:shadow-lg"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-black text-neutral-900">
                        {u.name}
                      </h3>

                      <RoleBadge role={u.role} />
                      <StatusBadge active={u.active} />
                    </div>

                    <div className="mt-2 grid gap-2 text-sm text-neutral-600 md:grid-cols-2">
                      <div>
                        <span className="font-bold text-neutral-700">Email:</span>{' '}
                        {u.email || <span className="text-neutral-400">—</span>}
                      </div>

                      <div>
                        <span className="font-bold text-neutral-700">Sede:</span>{' '}
                        {campusLabel(u.campus)}
                      </div>

                      {u.role === 'student' && (
                        <div className="md:col-span-2">
                          <span className="font-bold text-neutral-700">Curso(s):</span>{' '}
                          {studentCourses[u._id]?.join(', ') ||
                            (loadingStudentCourses ? '...' : 'Sin cursos asignados')}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <button
                      className="rounded-xl border border-purple-100 bg-purple-50 px-3 py-2 text-xs font-black uppercase tracking-wide text-purple-700 transition hover:bg-purple-100"
                      onClick={() => openEdit(u)}
                    >
                      {u.role === 'student'
                        ? 'Editar información del alumno'
                        : 'Editar información del docente'}
                    </button>

                    <button
                      className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs font-black uppercase tracking-wide text-indigo-700 transition hover:bg-indigo-100"
                      onClick={() => handleReset(u)}
                    >
                      Reset clave
                    </button>

                    <button
                      className={
                        u.active
                          ? 'rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-black uppercase tracking-wide text-amber-700 transition hover:bg-amber-100'
                          : 'rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-black uppercase tracking-wide text-emerald-700 transition hover:bg-emerald-100'
                      }
                      onClick={() => handleToggleActive(u)}
                    >
                      {u.active ? 'Desactivar' : 'Activar'}
                    </button>

                    <button
                      className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-black uppercase tracking-wide text-rose-700 transition hover:bg-rose-100"
                      onClick={() => handleDelete(u)}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Modal crear */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={handleCreate}
            className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-neutral-200 p-5">
              <div>
                <h2 className="text-lg font-black text-neutral-900">
                  Crear {role === 'teacher' ? 'docente' : 'alumno'}
                </h2>
                <p className="text-sm text-neutral-500">
                  Completá los datos principales del usuario.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-full border border-neutral-200 px-3 py-1 text-sm font-bold text-neutral-600 hover:bg-neutral-50"
              >
                ✕
              </button>
            </div>

            <div className="grid gap-4 p-5">
              <div>
                <label className="mb-1 block text-sm font-bold text-neutral-700">
                  Nombre
                </label>
                <input
                  className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-700 outline-none transition focus:border-purple-400 focus:bg-white focus:ring-4 focus:ring-purple-100"
                  value={form.name}
                  onChange={e => onChange('name', e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold text-neutral-700">
                  Email (opcional)
                </label>
                <input
                  className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-700 outline-none transition focus:border-purple-400 focus:bg-white focus:ring-4 focus:ring-purple-100"
                  value={form.email || ''}
                  onChange={e => onChange('email', e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold text-neutral-700">
                  Sede
                </label>
                <select
                  className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-700 outline-none transition focus:border-purple-400 focus:bg-white focus:ring-4 focus:ring-purple-100"
                  value={form.campus}
                  onChange={e => onChange('campus', e.target.value as Campus)}
                >
                  <option value="DERQUI">DERQUI</option>
                  <option value="JOSE_C_PAZ">JOSE_C_PAZ</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-neutral-200 p-5">
              <button
                type="button"
                className="rounded-2xl border border-neutral-200 bg-white px-5 py-3 text-sm font-black uppercase tracking-wide text-neutral-700 shadow-sm transition hover:bg-neutral-50"
                onClick={() => setShowCreate(false)}
              >
                Cancelar
              </button>

              <button
                type="submit"
                className="rounded-2xl bg-gradient-to-r from-purple-600 to-pink-500 px-6 py-3 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-purple-200 transition hover:-translate-y-0.5 hover:shadow-xl"
              >
                Crear
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal editar */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={handleEdit}
            className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-neutral-200 p-5">
              <div>
                <h2 className="text-lg font-black text-neutral-900">
                  {editingUser.role === 'student'
                    ? 'Editar información del alumno'
                    : 'Editar información del docente'}
                </h2>
                <p className="text-sm text-neutral-500">
                  Modificá nombre, email o sede sin crear un usuario nuevo.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="rounded-full border border-neutral-200 px-3 py-1 text-sm font-bold text-neutral-600 hover:bg-neutral-50"
              >
                ✕
              </button>
            </div>

            <div className="grid gap-4 p-5">
              <div>
                <label className="mb-1 block text-sm font-bold text-neutral-700">
                  Nombre
                </label>
                <input
                  className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-700 outline-none transition focus:border-purple-400 focus:bg-white focus:ring-4 focus:ring-purple-100"
                  value={editForm.name}
                  onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold text-neutral-700">
                  Email
                </label>
                <input
                  className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-700 outline-none transition focus:border-purple-400 focus:bg-white focus:ring-4 focus:ring-purple-100"
                  value={editForm.email}
                  onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold text-neutral-700">
                  Sede
                </label>
                <select
                  className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-700 outline-none transition focus:border-purple-400 focus:bg-white focus:ring-4 focus:ring-purple-100"
                  value={editForm.campus}
                  onChange={e => setEditForm(p => ({ ...p, campus: e.target.value as Campus }))}
                >
                  <option value="DERQUI">DERQUI</option>
                  <option value="JOSE_C_PAZ">JOSE_C_PAZ</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-neutral-200 p-5">
              <button
                type="button"
                className="rounded-2xl border border-neutral-200 bg-white px-5 py-3 text-sm font-black uppercase tracking-wide text-neutral-700 shadow-sm transition hover:bg-neutral-50 disabled:opacity-60"
                onClick={() => setEditingUser(null)}
                disabled={savingEdit}
              >
                Cancelar
              </button>

              <button
                type="submit"
                className="rounded-2xl bg-gradient-to-r from-purple-600 to-pink-500 px-6 py-3 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-purple-200 transition hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-60"
                disabled={savingEdit}
              >
                {savingEdit ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal credenciales */}
      {justCreated && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="border-b border-neutral-200 p-5">
              <h2 className="text-lg font-black text-neutral-900">
                Credenciales
              </h2>
              <p className="text-sm text-neutral-500">
                Guardá estos datos antes de cerrar.
              </p>
            </div>

            <div className="space-y-3 p-5 text-sm">
              <div className="rounded-2xl bg-neutral-50 p-4">
                <b>Email:</b> {justCreated.email}
              </div>

              <div className="rounded-2xl bg-neutral-50 p-4">
                <b>Contraseña:</b> <code>{justCreated.password}</code>
              </div>

              <button
                className="rounded-2xl border border-neutral-200 bg-white px-5 py-3 text-sm font-black uppercase tracking-wide text-neutral-700 shadow-sm transition hover:bg-neutral-50"
                onClick={() => {
                  const text = `Email: ${justCreated.email}
Contraseña: ${justCreated.password}`;
                  navigator.clipboard.writeText(text);
                }}
              >
                Copiar
              </button>
            </div>

            <div className="border-t border-neutral-200 p-5 text-right">
              <button
                className="rounded-2xl bg-gradient-to-r from-purple-600 to-pink-500 px-6 py-3 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-purple-200"
                onClick={() => setJustCreated(null)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
