import { useEffect, useMemo, useState } from 'react';
import { getMe, type Me } from '../lib/api';
import { getMyCourses, type TeacherCourse } from '../lib/teacher';
import { listTopics, createTopic, type Topic } from '../lib/topics';

function todayYMD() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function formatDate(value: string) {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

export default function Topics() {
  const [me, setMe] = useState<Me | null>(null);
  const [loadingMe, setLoadingMe] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [myCourses, setMyCourses] = useState<TeacherCourse[]>([]);
  const [courseId, setCourseId] = useState('');
  const [from, setFrom] = useState(todayYMD());
  const [to, setTo] = useState(todayYMD());
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  const [date, setDate] = useState(todayYMD());
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoadingMe(true);
    getMe()
      .then(setMe)
      .catch((e) => setError(e.message))
      .finally(() => setLoadingMe(false));
  }, []);

  const canCreate = useMemo(
    () => me && (me.role === 'teacher' || me.role === 'coordinator'),
    [me]
  );

  useEffect(() => {
    if (me?.role === 'teacher') {
      getMyCourses()
        .then((cs) => {
          setMyCourses(cs);
          if (cs[0]?._id) setCourseId(cs[0]._id);
        })
        .catch((e) => setError(e.message));
    }
  }, [me]);

  const refresh = async () => {
    if (!courseId) return;
    setLoadingList(true);
    setError(null);

    try {
      const { topics } = await listTopics({ courseId, from, to });
      setTopics(topics);
    } catch (e: any) {
      setError(e.message || 'Error al listar');
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    if (courseId) refresh();
    // eslint-disable-next-line
  }, [courseId]);

  const onCreate = async () => {
    if (!courseId || !content.trim() || !date) return;

    setSaving(true);
    setError(null);

    try {
      await createTopic({ courseId, date, content: content.trim() });
      setContent('');
      await refresh();
      alert('Tema registrado ✅');
    } catch (e: any) {
      setError(e.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (loadingMe) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="rounded-3xl border border-purple-100 bg-white px-8 py-6 shadow-xl text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-purple-200 border-t-purple-600" />
          <p className="text-sm font-semibold text-neutral-700">Cargando libro de temas...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6 shadow-sm">
          <div className="text-3xl mb-2">⚠️</div>
          <h2 className="text-xl font-bold text-red-700">Ocurrió un error</h2>
          <p className="mt-2 text-sm text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!me) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-neutral-800">No logueado</h2>
          <p className="mt-2 text-sm text-neutral-500">
            Iniciá sesión para ver el libro de temas.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">

      {/* HERO */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-600 via-fuchsia-500 to-pink-500 p-[2px] shadow-xl">
        <div className="relative rounded-3xl bg-white/95 p-6 md:p-8">
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-purple-200/40 blur-2xl" />
          <div className="absolute -bottom-12 -left-10 h-36 w-36 rounded-full bg-pink-200/50 blur-2xl" />

          <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-purple-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-purple-700 border border-purple-100">
                📖 Registro pedagógico
              </div>

              <h1 className="font-heading text-3xl md:text-4xl font-black tracking-tight text-neutral-900">
                Libro de temas
              </h1>

              <p className="mt-2 max-w-2xl text-sm md:text-base text-neutral-600">
                Registrá los contenidos trabajados por fecha y consultá el historial del curso.
              </p>
            </div>

            <div className="rounded-2xl border border-purple-100 bg-purple-50 px-4 py-3 text-sm shadow-sm">
              <p className="font-bold text-purple-800">{me.name}</p>
              <p className="text-xs uppercase tracking-wide text-purple-500">
                {me.role}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FILTROS */}
      <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-100 text-xl">
            🔎
          </div>
          <div>
            <h2 className="text-lg font-black text-neutral-900">Buscar temas</h2>
            <p className="text-sm text-neutral-500">
              Seleccioná un curso y un rango de fechas.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-[1.5fr_1fr_1fr_auto] md:items-end">
          {me.role === 'teacher' ? (
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wide text-neutral-500">
                Curso
              </label>
              <select
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-700 outline-none transition focus:border-purple-400 focus:bg-white focus:ring-4 focus:ring-purple-100"
              >
                {myCourses.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wide text-neutral-500">
                Course ID
              </label>
              <input
                placeholder="Pegá el ID del curso"
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-700 outline-none transition focus:border-purple-400 focus:bg-white focus:ring-4 focus:ring-purple-100"
              />
              <p className="text-xs text-neutral-400">
                Coordinador/Admin: luego se puede agregar buscador.
              </p>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wide text-neutral-500">
              Desde
            </label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-700 outline-none transition focus:border-purple-400 focus:bg-white focus:ring-4 focus:ring-purple-100"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wide text-neutral-500">
              Hasta
            </label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-700 outline-none transition focus:border-purple-400 focus:bg-white focus:ring-4 focus:ring-purple-100"
            />
          </div>

          <button
            onClick={refresh}
            disabled={!courseId || loadingList}
            className="rounded-2xl bg-purple-600 px-5 py-3 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-purple-200 transition hover:-translate-y-0.5 hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {loadingList ? 'Buscando...' : 'Refrescar'}
          </button>
        </div>
      </section>

      {/* FORMULARIO */}
      {canCreate && (
        <section className="rounded-3xl border border-purple-100 bg-gradient-to-br from-purple-50 via-white to-pink-50 p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-pink-100 text-xl">
              ✍️
            </div>
            <div>
              <h2 className="text-lg font-black text-neutral-900">
                Registrar contenido del día
              </h2>
              <p className="text-sm text-neutral-500">
                Escribí el tema trabajado en clase.
              </p>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="max-w-xs space-y-1">
              <label className="text-xs font-bold uppercase tracking-wide text-neutral-500">
                Fecha
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-700 outline-none transition focus:border-pink-400 focus:ring-4 focus:ring-pink-100"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wide text-neutral-500">
                Contenido visto
              </label>
              <textarea
                rows={5}
                placeholder="Ej: Simple Past: afirmativas/negativas + listening Unit 3"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full resize-none rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700 outline-none transition placeholder:text-neutral-400 focus:border-pink-400 focus:ring-4 focus:ring-pink-100"
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-neutral-500">
                Mínimo 3 caracteres para guardar.
              </p>

              <button
                onClick={onCreate}
                disabled={!courseId || saving || content.trim().length < 3}
                className="rounded-2xl bg-gradient-to-r from-purple-600 to-pink-500 px-6 py-3 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-pink-200 transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
              >
                {saving ? 'Guardando...' : 'Guardar tema'}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* LISTA */}
      <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-neutral-100 text-xl">
              🗂️
            </div>
            <div>
              <h2 className="text-lg font-black text-neutral-900">
                Temas registrados
              </h2>
              <p className="text-sm text-neutral-500">
                {formatDate(from)} al {formatDate(to)}
              </p>
            </div>
          </div>

          <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-black text-purple-700 border border-purple-100">
            {topics.length} registro{topics.length === 1 ? '' : 's'}
          </span>
        </div>

        {loadingList ? (
          <div className="rounded-2xl border border-dashed border-purple-200 bg-purple-50/50 p-8 text-center">
            <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-purple-200 border-t-purple-600" />
            <p className="text-sm font-semibold text-purple-700">
              Cargando temas...
            </p>
          </div>
        ) : topics.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 p-8 text-center">
            <div className="mb-2 text-4xl">📭</div>
            <h3 className="text-base font-black text-neutral-800">
              No hay temas en este rango
            </h3>
            <p className="mt-1 text-sm text-neutral-500">
              Probá cambiando las fechas o registrá un nuevo contenido.
            </p>
          </div>
        ) : (
          <ul className="grid gap-3">
            {topics.map((t) => (
              <li
                key={t._id}
                className="group rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-purple-200 hover:shadow-md"
              >
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-black text-purple-700">
                      📅 {formatDate(t.date)}
                    </span>
                  </div>

                  <div className="text-[11px] text-neutral-400">
                    course: {t.course} · teacher: {t.teacher}
                  </div>
                </div>

                <div className="whitespace-pre-wrap rounded-2xl bg-neutral-50 p-4 text-sm leading-relaxed text-neutral-700">
                  {t.content}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
