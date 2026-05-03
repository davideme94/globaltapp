import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

type Form = {
  studentBook?: string;
  workbook?: string;
  reader?: string;
};

type LoadResp = {
  course?: { _id: string; name: string; year: number } | null;
  materials?: Form;
};

const ORIGIN = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const BASE = ORIGIN ? `${ORIGIN}/api` : '/api';

// helpers locales (no tocan tu api.ts)
async function getJSON<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}${path}`, { credentials: 'include' });
  const ct = r.headers.get('content-type') || '';
  const payload = ct.includes('application/json') ? await r.json() : await r.text();

  if (!r.ok) throw new Error((payload as any)?.error || `HTTP ${r.status}`);

  return payload as T;
}

async function postJSON<T>(path: string, body: any): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const ct = r.headers.get('content-type') || '';
  const payload = ct.includes('application/json') ? await r.json() : await r.text();

  if (!r.ok) throw new Error((payload as any)?.error || `HTTP ${r.status}`);

  return payload as T;
}

/**
 * Página simple para que el coordinador/teacher cargue 3 links visibles para ALUMNOS.
 * Endpoint esperado:
 *  GET  /api/courses/:id/student-materials     -> { course, materials: { studentBook, workbook, reader } }
 *  POST /api/courses/:id/student-materials     -> { ok: true }
 *
 * Si tu server aun no tiene estos endpoints, podés crearlos fácil
 * guardando estos 3 campos colgados del curso (ej. course.studentMaterials).
 */
export default function CourseStudentMaterials() {
  const { id: courseId } = useParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [title, setTitle] = useState<string>('Curso');
  const [form, setForm] = useState<Form>({});

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!courseId) return;

      setLoading(true);
      setErr(null);

      try {
        const r = await getJSON<LoadResp>(
          `/courses/${encodeURIComponent(courseId)}/student-materials`
        );

        if (!alive) return;

        if (r.course) setTitle(`${r.course.name} — ${r.course.year}`);
        setForm(r.materials || {});
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || 'No se pudo cargar los materiales.');
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [courseId]);

  const save = async () => {
    if (!courseId) return;

    setErr(null);
    setMsg(null);
    setSaving(true);

    try {
      await postJSON(`/courses/${encodeURIComponent(courseId)}/student-materials`, {
        materials: form,
      });

      setMsg('Materiales guardados correctamente.');
      setTimeout(() => setMsg(null), 2500);
    } catch (e: any) {
      setErr(e?.message || 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };

  const set = (k: keyof Form, v: string) => {
    setForm(prev => ({
      ...prev,
      [k]: v || undefined,
    }));
  };

  const hasAnyMaterial = Boolean(form.studentBook || form.workbook || form.reader);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-3 py-4 sm:px-5 md:px-6 md:py-6">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-500 p-[2px] shadow-xl shadow-violet-100">
        <div className="relative overflow-hidden rounded-[2rem] bg-white p-5 sm:p-7 md:p-8">
          <div className="absolute -right-14 -top-14 h-44 w-44 rounded-full bg-violet-200/60 blur-3xl" />
          <div className="absolute -bottom-16 -left-14 h-44 w-44 rounded-full bg-indigo-200/60 blur-3xl" />

          <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="mb-3 w-fit rounded-full border border-violet-100 bg-violet-50 px-4 py-1.5 text-xs font-black uppercase tracking-wide text-violet-700">
                📘 Material para alumnos
              </div>

              <h1 className="text-2xl font-black tracking-tight text-neutral-950 sm:text-3xl md:text-4xl">
                Libros y recursos del curso
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-neutral-600 sm:text-base">
                Cargá los enlaces del <b>Student Book</b>, <b>Workbook</b> y <b>Reader</b> para que estén disponibles para los alumnos.
              </p>

              <p className="mt-3 break-words text-sm font-bold text-neutral-800 sm:text-base">
                Curso:{' '}
                <span className="font-black text-violet-700">
                  {title}
                </span>
              </p>
            </div>

            <div className="w-full rounded-3xl border border-violet-100 bg-violet-50/80 px-5 py-4 shadow-sm sm:w-fit">
              <p className="text-xs font-black uppercase tracking-wide text-violet-500">
                Estado
              </p>
              <p className="mt-1 text-sm font-black text-violet-800">
                {hasAnyMaterial ? 'Material cargado' : 'Sin material cargado'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CONTENIDO */}
      {loading ? (
        <section className="overflow-hidden rounded-[2rem] border border-neutral-200 bg-white p-5 shadow-xl shadow-neutral-100 sm:p-7">
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 animate-pulse rounded-2xl bg-neutral-100" />

              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-5 w-52 animate-pulse rounded-full bg-neutral-100" />
                <div className="h-4 w-72 max-w-full animate-pulse rounded-full bg-neutral-100" />
              </div>
            </div>

            <div className="grid gap-4">
              <div className="h-16 animate-pulse rounded-2xl bg-neutral-100" />
              <div className="h-16 animate-pulse rounded-2xl bg-neutral-100" />
              <div className="h-16 animate-pulse rounded-2xl bg-neutral-100" />
            </div>
          </div>
        </section>
      ) : (
        <section className="overflow-hidden rounded-[2rem] border border-neutral-200 bg-white shadow-xl shadow-neutral-100">
          <div className="space-y-6 p-5 sm:p-7">
            {err && (
              <div className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-bold text-rose-700">
                {err}
              </div>
            )}

            {msg && (
              <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-700">
                ✅ {msg}
              </div>
            )}

            {/* Vista rápida */}
            <div>
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-black text-neutral-950">
                    Materiales cargados
                  </h2>
                  <p className="text-sm text-neutral-500">
                    Vista rápida de los enlaces disponibles para los alumnos.
                  </p>
                </div>

                <span className="w-fit rounded-full border border-indigo-100 bg-indigo-50 px-4 py-2 text-xs font-black uppercase tracking-wide text-indigo-700">
                  3 recursos principales
                </span>
              </div>

              {hasAnyMaterial ? (
                <div className="grid gap-4 md:grid-cols-3">
                  {form.studentBook && (
                    <a
                      href={form.studentBook}
                      target="_blank"
                      rel="noreferrer"
                      className="group rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-lg"
                    >
                      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-2xl transition group-hover:scale-105">
                        📘
                      </div>

                      <h3 className="text-lg font-black text-neutral-950">
                        Student Book
                      </h3>

                      <p className="mt-1 text-sm leading-relaxed text-neutral-500">
                        Libro principal del curso.
                      </p>

                      <div className="mt-4 inline-flex items-center rounded-full bg-indigo-600 px-4 py-2 text-sm font-black text-white shadow-lg shadow-indigo-100 transition group-hover:bg-indigo-700">
                        Abrir →
                      </div>
                    </a>
                  )}

                  {form.workbook && (
                    <a
                      href={form.workbook}
                      target="_blank"
                      rel="noreferrer"
                      className="group rounded-3xl border border-violet-100 bg-gradient-to-br from-violet-50 to-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-lg"
                    >
                      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-2xl transition group-hover:scale-105">
                        📒
                      </div>

                      <h3 className="text-lg font-black text-neutral-950">
                        Workbook
                      </h3>

                      <p className="mt-1 text-sm leading-relaxed text-neutral-500">
                        Actividades y práctica complementaria.
                      </p>

                      <div className="mt-4 inline-flex items-center rounded-full bg-violet-600 px-4 py-2 text-sm font-black text-white shadow-lg shadow-violet-100 transition group-hover:bg-violet-700">
                        Abrir →
                      </div>
                    </a>
                  )}

                  {form.reader && (
                    <a
                      href={form.reader}
                      target="_blank"
                      rel="noreferrer"
                      className="group rounded-3xl border border-fuchsia-100 bg-gradient-to-br from-fuchsia-50 to-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-fuchsia-200 hover:shadow-lg"
                    >
                      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-fuchsia-100 text-2xl transition group-hover:scale-105">
                        📖
                      </div>

                      <h3 className="text-lg font-black text-neutral-950">
                        Reader
                      </h3>

                      <p className="mt-1 text-sm leading-relaxed text-neutral-500">
                        Lectura asignada para el curso.
                      </p>

                      <div className="mt-4 inline-flex items-center rounded-full bg-fuchsia-600 px-4 py-2 text-sm font-black text-white shadow-lg shadow-fuchsia-100 transition group-hover:bg-fuchsia-700">
                        Abrir →
                      </div>
                    </a>
                  )}
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed border-neutral-200 bg-neutral-50 p-8 text-center">
                  <div className="mb-3 text-5xl">📭</div>
                  <h3 className="text-lg font-black text-neutral-800">
                    Todavía no hay materiales cargados
                  </h3>
                  <p className="mt-1 text-sm text-neutral-500">
                    Pegá los enlaces abajo y guardá los cambios.
                  </p>
                </div>
              )}
            </div>

            {/* Formulario */}
            <div className="rounded-[2rem] border border-neutral-200 bg-neutral-50 p-4 sm:p-5">
              <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-black text-neutral-950">
                    Editar enlaces para alumnos
                  </h2>
                  <p className="text-sm text-neutral-500">
                    Pegá las URLs correspondientes a cada material.
                  </p>
                </div>

                <span className="w-fit rounded-full border border-violet-100 bg-white px-4 py-2 text-xs font-black uppercase tracking-wide text-violet-700">
                  Links visibles
                </span>
              </div>

              <div className="grid gap-4">
                <label className="grid gap-2">
                  <span className="text-sm font-black text-neutral-700">
                    Student Book (URL)
                  </span>
                  <input
                    className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-700 outline-none transition placeholder:text-neutral-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                    placeholder="https://..."
                    value={form.studentBook || ''}
                    onChange={e => set('studentBook', e.target.value)}
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-black text-neutral-700">
                    Workbook (URL)
                  </span>
                  <input
                    className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-700 outline-none transition placeholder:text-neutral-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                    placeholder="https://..."
                    value={form.workbook || ''}
                    onChange={e => set('workbook', e.target.value)}
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-black text-neutral-700">
                    Reader (URL)
                  </span>
                  <input
                    className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-700 outline-none transition placeholder:text-neutral-400 focus:border-fuchsia-400 focus:ring-4 focus:ring-fuchsia-100"
                    placeholder="https://..."
                    value={form.reader || ''}
                    onChange={e => set('reader', e.target.value)}
                  />
                </label>

                <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center">
                  <button
                    className="w-full rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-500 px-6 py-3 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-violet-200 transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
                    onClick={save}
                    disabled={saving}
                  >
                    {saving ? 'Guardando…' : 'Guardar materiales'}
                  </button>

                  {msg && (
                    <div className="rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700">
                      {msg}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-xs leading-relaxed text-neutral-500">
                  Estos enlaces serán visibles para los alumnos desde su acceso al curso.
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
