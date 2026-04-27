import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, type TopicEntry, type Me } from '../lib/api';
import CourseScheduleBadge from '../components/CourseScheduleBadge';

function todayStr() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export default function CourseTopicsPage() {
  const { id } = useParams<{ id: string }>();

  const [me, setMe] = useState<Me['user'] | null>(null);
  const [rows, setRows] = useState<TopicEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  // form
  const [date, setDate] = useState(todayStr());
  const [topic1, setTopic1] = useState('');
  const [topic2, setTopic2] = useState('');
  const [book, setBook] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!id) return;

    setLoading(true);

    try {
      const u = await api.me();
      setMe(u.user);

      const g = await api.topics.grid(id);
      setRows(g.rows);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function save() {
    if (!id) return;

    setSaving(true);

    try {
      await api.topics.upsert({
        courseId: id,
        date,
        topic1,
        topic2,
        book,
        notes,
      });

      setTopic1('');
      setTopic2('');
      setBook('');
      setNotes('');

      setMsg('Guardado correctamente');
      setTimeout(() => setMsg(null), 1600);

      await load();
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center px-4">
        <div className="rounded-3xl border border-purple-100 bg-white px-8 py-7 text-center shadow-xl">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-purple-200 border-t-purple-600" />
          <p className="text-sm font-bold text-neutral-700">
            Cargando libro de temas...
          </p>
        </div>
      </div>
    );
  }

  if (!me || (me.role !== 'teacher' && me.role !== 'coordinator' && me.role !== 'admin')) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6 shadow-sm">
          <div className="mb-2 text-4xl">🔒</div>
          <h2 className="text-xl font-black text-red-700">No autorizado</h2>
          <p className="mt-1 text-sm text-red-600">
            No tenés permisos para acceder al libro de temas.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">

      {/* HEADER */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-600 via-fuchsia-500 to-pink-500 p-[2px] shadow-xl">
        <div className="relative rounded-3xl bg-white/95 p-6 md:p-8">
          <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-purple-200/50 blur-3xl" />
          <div className="absolute -bottom-12 -left-10 h-36 w-36 rounded-full bg-pink-200/50 blur-3xl" />

          <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-purple-100 bg-purple-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-purple-700">
                📖 Registro pedagógico
              </div>

              <h1 className="font-heading text-3xl font-black tracking-tight text-neutral-900 md:text-4xl">
                Libro de temas
              </h1>

              <p className="mt-2 max-w-2xl text-sm text-neutral-600 md:text-base">
                Registrá los contenidos trabajados en clase, recursos utilizados y observaciones del día.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {id && <CourseScheduleBadge courseId={id} />}

              {msg && (
                <span className="rounded-full border border-green-200 bg-green-50 px-4 py-2 text-xs font-black uppercase tracking-wide text-green-700">
                  ✅ {msg}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* FORMULARIO */}
      <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-100 text-2xl">
            ✍️
          </div>

          <div>
            <h2 className="text-lg font-black text-neutral-900">
              Registrar clase
            </h2>
            <p className="text-sm text-neutral-500">
              Completá los campos y guardá el registro del día.
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[170px_1fr_1fr_1fr]">
          <div className="space-y-1">
            <label className="text-xs font-black uppercase tracking-wide text-neutral-500">
              Fecha
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-700 outline-none transition focus:border-purple-400 focus:bg-white focus:ring-4 focus:ring-purple-100"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-black uppercase tracking-wide text-neutral-500">
              Tema 1
            </label>
            <input
              value={topic1}
              onChange={(e) => setTopic1(e.target.value)}
              placeholder="Contenido principal"
              className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-700 outline-none transition placeholder:text-neutral-400 focus:border-purple-400 focus:bg-white focus:ring-4 focus:ring-purple-100"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-black uppercase tracking-wide text-neutral-500">
              Tema 2
            </label>
            <input
              value={topic2}
              onChange={(e) => setTopic2(e.target.value)}
              placeholder="Contenido secundario"
              className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-700 outline-none transition placeholder:text-neutral-400 focus:border-purple-400 focus:bg-white focus:ring-4 focus:ring-purple-100"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-black uppercase tracking-wide text-neutral-500">
              Libro / Recursos
            </label>
            <input
              value={book}
              onChange={(e) => setBook(e.target.value)}
              placeholder="Libro, páginas, audio, etc."
              className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-700 outline-none transition placeholder:text-neutral-400 focus:border-purple-400 focus:bg-white focus:ring-4 focus:ring-purple-100"
            />
          </div>

          <div className="space-y-1 lg:col-span-3">
            <label className="text-xs font-black uppercase tracking-wide text-neutral-500">
              Notas
            </label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observaciones"
              className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-700 outline-none transition placeholder:text-neutral-400 focus:border-purple-400 focus:bg-white focus:ring-4 focus:ring-purple-100"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={save}
              disabled={saving}
              className="w-full rounded-2xl bg-gradient-to-r from-purple-600 to-pink-500 px-5 py-3 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-purple-200 transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </section>

      {/* TABLA */}
      <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-pink-100 text-2xl">
              🗂️
            </div>

            <div>
              <h2 className="text-lg font-black text-neutral-900">
                Registros cargados
              </h2>
              <p className="text-sm text-neutral-500">
                Historial del libro de temas del curso.
              </p>
            </div>
          </div>

          <span className="w-fit rounded-full border border-purple-100 bg-purple-50 px-4 py-2 text-xs font-black uppercase tracking-wide text-purple-700">
            {rows.length} registro{rows.length === 1 ? '' : 's'}
          </span>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 p-10 text-center">
            <div className="mb-3 text-5xl">📭</div>
            <h3 className="text-lg font-black text-neutral-800">
              Sin registros aún
            </h3>
            <p className="mt-1 text-sm text-neutral-500">
              Cuando guardes una clase, aparecerá en esta sección.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-neutral-200">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] border-collapse bg-white">
                <thead>
                  <tr className="bg-neutral-50">
                    <th className={th}>Fecha</th>
                    <th className={th}>Tema 1</th>
                    <th className={th}>Tema 2</th>
                    <th className={th}>Libro</th>
                    <th className={th}>Notas</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((r) => (
                    <tr key={r._id} className="transition hover:bg-purple-50/40">
                      <td className={td}>
                        <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-black text-purple-700">
                          {fmt(r.date)}
                        </span>
                      </td>

                      <td className={td}>
                        <div className="font-semibold text-neutral-800">
                          {r.topic1 || '—'}
                        </div>
                      </td>

                      <td className={td}>
                        <div className="text-neutral-700">
                          {r.topic2 || '—'}
                        </div>
                      </td>

                      <td className={td}>
                        <div className="text-neutral-700">
                          {r.book || '—'}
                        </div>
                      </td>

                      <td className={td}>
                        <div className="text-neutral-700">
                          {r.notes || '—'}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function fmt(s: string) {
  const [y, m, d] = s.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
}

const th =
  'px-5 py-4 text-left text-xs font-black uppercase tracking-wide text-neutral-500 border-b border-neutral-200';

const td =
  'px-5 py-4 text-left text-sm align-top border-b border-neutral-100';
