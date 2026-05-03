import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, type Me } from '../lib/api';

export default function CourseMaterialsPage() {
  const { id } = useParams<{ id: string }>();

  const [me, setMe] = useState<Me['user'] | null>(null);
  const [courseName, setCourseName] = useState('');

  const [syllabusUrl, setSyllabusUrl] = useState('');
  const [materialsUrl, setMaterialsUrl] = useState('');

  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const canEdit = me?.role === 'coordinator' || me?.role === 'admin';

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setErr(null);

        const m = await api.me();

        if (!alive) return;
        setMe(m.user);

        if (!id) return;

        const r = await api.courses.links.get(id);

        if (!alive) return;

        setCourseName(`${r.course.name} — ${r.course.year}`);
        setSyllabusUrl(r.links?.syllabusUrl || '');
        setMaterialsUrl(r.links?.materialsUrl || '');
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || 'No se pudo cargar el material del curso.');
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [id]);

  async function save() {
    if (!id) return;

    setErr(null);

    try {
      await api.courses.links.set(id, {
        syllabusUrl: syllabusUrl || undefined,
        materialsUrl: materialsUrl || undefined,
      });

      setMsg('Material de curso guardado.');
      setTimeout(() => setMsg(null), 2000);
    } catch (e: any) {
      setErr(e?.message || 'No se pudo guardar.');
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-3 py-4 sm:px-5 md:px-6 md:py-6">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-r from-violet-600 via-fuchsia-500 to-sky-500 p-[2px] shadow-xl shadow-violet-100">
        <div className="relative overflow-hidden rounded-[2rem] bg-white p-5 sm:p-7 md:p-8">
          <div className="absolute -right-14 -top-14 h-44 w-44 rounded-full bg-violet-200/60 blur-3xl" />
          <div className="absolute -bottom-16 -left-14 h-44 w-44 rounded-full bg-sky-200/60 blur-3xl" />

          <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="mb-3 w-fit rounded-full border border-violet-100 bg-violet-50 px-4 py-1.5 text-xs font-black uppercase tracking-wide text-violet-700">
                📚 Material del curso
              </div>

              <h1 className="text-2xl font-black tracking-tight text-neutral-950 sm:text-3xl md:text-4xl">
                Materiales y enlaces
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-neutral-600 sm:text-base">
                Accedé rápidamente al syllabus y a la carpeta de materiales del curso.
              </p>

              <p className="mt-3 break-words text-sm font-bold text-neutral-800 sm:text-base">
                Curso:{' '}
                <span className="font-black text-violet-700">
                  {courseName || 'Curso'}
                </span>
              </p>
            </div>

            <div className="w-full rounded-3xl border border-violet-100 bg-violet-50/80 px-5 py-4 shadow-sm sm:w-fit">
              <p className="text-xs font-black uppercase tracking-wide text-violet-500">
                Permiso
              </p>
              <p className="mt-1 text-sm font-black text-violet-800">
                {canEdit ? 'Edición habilitada' : 'Solo visualización'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CARD PRINCIPAL */}
      <section className="overflow-hidden rounded-[2rem] border border-neutral-200 bg-white shadow-xl shadow-neutral-100">
        {loading ? (
          <div className="space-y-5 p-5 sm:p-7">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 animate-pulse rounded-2xl bg-neutral-100" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-5 w-52 animate-pulse rounded-full bg-neutral-100" />
                <div className="h-4 w-72 max-w-full animate-pulse rounded-full bg-neutral-100" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="h-32 animate-pulse rounded-3xl bg-neutral-100" />
              <div className="h-32 animate-pulse rounded-3xl bg-neutral-100" />
            </div>
          </div>
        ) : (
          <div className="space-y-6 p-5 sm:p-7">
            {err && (
              <div className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-bold text-rose-700">
                {err}
              </div>
            )}

            {/* ACCESOS RÁPIDOS */}
            <div>
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-black text-neutral-950">
                    Accesos rápidos
                  </h2>
                  <p className="text-sm text-neutral-500">
                    Enlaces visibles para docentes y estudiantes habilitados.
                  </p>
                </div>

                {(syllabusUrl || materialsUrl) && (
                  <span className="w-fit rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-xs font-black uppercase tracking-wide text-emerald-700">
                    Material disponible
                  </span>
                )}
              </div>

              {syllabusUrl || materialsUrl ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {materialsUrl && (
                    <a
                      href={materialsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="group rounded-3xl border border-sky-100 bg-gradient-to-br from-sky-50 to-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-lg"
                    >
                      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-2xl transition group-hover:scale-105">
                        📁
                      </div>

                      <h3 className="text-lg font-black text-neutral-950">
                        Abrir carpeta
                      </h3>

                      <p className="mt-1 text-sm leading-relaxed text-neutral-500">
                        Carpeta de Drive con materiales, archivos y recursos del curso.
                      </p>

                      <div className="mt-4 inline-flex items-center rounded-full bg-sky-600 px-4 py-2 text-sm font-black text-white shadow-lg shadow-sky-100 transition group-hover:bg-sky-700">
                        Abrir enlace →
                      </div>
                    </a>
                  )}

                  {syllabusUrl && (
                    <a
                      href={syllabusUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="group rounded-3xl border border-violet-100 bg-gradient-to-br from-violet-50 to-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-lg"
                    >
                      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-2xl transition group-hover:scale-105">
                        📄
                      </div>

                      <h3 className="text-lg font-black text-neutral-950">
                        Syllabus
                      </h3>

                      <p className="mt-1 text-sm leading-relaxed text-neutral-500">
                        Programa, contenidos, criterios y organización general del curso.
                      </p>

                      <div className="mt-4 inline-flex items-center rounded-full bg-violet-600 px-4 py-2 text-sm font-black text-white shadow-lg shadow-violet-100 transition group-hover:bg-violet-700">
                        Abrir syllabus →
                      </div>
                    </a>
                  )}
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed border-neutral-200 bg-neutral-50 p-8 text-center">
                  <div className="mb-3 text-5xl">📭</div>
                  <h3 className="text-lg font-black text-neutral-800">
                    Aún no hay materiales cargados
                  </h3>
                  <p className="mt-1 text-sm text-neutral-500">
                    Cuando se agreguen enlaces, aparecerán en esta sección.
                  </p>
                </div>
              )}
            </div>

            {/* FORMULARIO SOLO COORD/ADMIN */}
            {canEdit && (
              <div className="rounded-[2rem] border border-neutral-200 bg-neutral-50 p-4 sm:p-5">
                <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-black text-neutral-950">
                      Editar enlaces del curso
                    </h2>
                    <p className="text-sm text-neutral-500">
                      Pegá los enlaces de Drive correspondientes al curso.
                    </p>
                  </div>

                  <span className="w-fit rounded-full border border-violet-100 bg-white px-4 py-2 text-xs font-black uppercase tracking-wide text-violet-700">
                    Coord/Admin
                  </span>
                </div>

                <div className="grid gap-4">
                  <label className="grid gap-2">
                    <span className="text-sm font-black text-neutral-700">
                      URL Syllabus (Drive)
                    </span>
                    <input
                      className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-700 outline-none transition placeholder:text-neutral-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                      placeholder="https://drive.google.com/..."
                      value={syllabusUrl}
                      onChange={(e) => setSyllabusUrl(e.target.value)}
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-sm font-black text-neutral-700">
                      URL Carpeta materiales (Drive)
                    </span>
                    <input
                      className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-700 outline-none transition placeholder:text-neutral-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                      placeholder="https://drive.google.com/..."
                      value={materialsUrl}
                      onChange={(e) => setMaterialsUrl(e.target.value)}
                    />
                  </label>

                  <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center">
                    <button
                      className="w-full rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-500 px-6 py-3 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-violet-200 transition hover:-translate-y-0.5 hover:shadow-xl sm:w-auto"
                      onClick={save}
                    >
                      Guardar material
                    </button>

                    {msg && (
                      <div className="rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700">
                        {msg}
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-xs leading-relaxed text-neutral-500">
                    Solo coordinador/administrativo pueden editar. Los docentes pueden visualizar.
                  </div>
                </div>
              </div>
            )}

            {!canEdit && (
              <div className="rounded-3xl border border-neutral-200 bg-neutral-50 px-5 py-4 text-sm leading-relaxed text-neutral-500">
                Estás visualizando los materiales del curso. La edición está reservada para coordinación o administración.
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
