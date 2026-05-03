import { useEffect, useState } from 'react';

type MineResp = {
  year: number;
  rows: { course: { _id: string; name: string; year: number } }[];
};

type MaterialsResp = {
  course?: { _id: string; name: string; year: number } | null;
  materials?: { studentBook?: string; workbook?: string; reader?: string } | null;
};

const ORIGIN = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const BASE = ORIGIN ? `${ORIGIN}/api` : '/api';

async function getJSON<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}${path}`, { credentials: 'include' });
  const ct = r.headers.get('content-type') || '';
  const payload = ct.includes('application/json') ? await r.json() : await r.text();

  if (!r.ok) throw new Error((payload as any)?.error || `HTTP ${r.status}`);

  return payload as T;
}

type Row = {
  id: string;
  title: string;
  materials: { studentBook?: string; workbook?: string; reader?: string } | null;
};

export default function StudentMaterials() {
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setErr(null);

        // 1) Mis cursos activos del alumno
        const mine = await getJSON<MineResp>('/courses/mine');

        if (!alive) return;

        setYear(mine.year);

        // 2) Para cada curso, traigo materiales de alumnos
        const items: Row[] = [];

        for (const r of mine.rows || []) {
          const c = r.course;

          if (!c?._id) continue;

          try {
            const m = await getJSON<MaterialsResp>(
              `/courses/${encodeURIComponent(c._id)}/student-materials`
            );

            items.push({
              id: c._id,
              title: `${c.name} — ${c.year}`,
              materials: m.materials || null,
            });
          } catch {
            items.push({
              id: c._id,
              title: `${c.name} — ${c.year}`,
              materials: null,
            });
          }
        }

        if (!alive) return;

        setRows(items);
      } catch (e: any) {
        if (!alive) return;

        setErr(e?.message || 'No se pudieron cargar tus cursos.');
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const totalWithMaterials = rows.filter(row => {
    const m = row.materials || {};
    return Boolean(m.studentBook || m.workbook || m.reader);
  }).length;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-3 py-4 sm:px-5 md:px-6 md:py-6">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-500 p-[2px] shadow-xl shadow-violet-100">
        <div className="relative overflow-hidden rounded-[2rem] bg-white p-5 sm:p-7 md:p-8">
          <div className="absolute -right-14 -top-14 h-44 w-44 rounded-full bg-violet-200/60 blur-3xl" />
          <div className="absolute -bottom-16 -left-14 h-44 w-44 rounded-full bg-indigo-200/60 blur-3xl" />

          <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="mb-3 w-fit rounded-full border border-violet-100 bg-violet-50 px-4 py-1.5 text-xs font-black uppercase tracking-wide text-violet-700">
                📚 Materiales del alumno
              </div>

              <h1 className="text-2xl font-black tracking-tight text-neutral-950 sm:text-3xl md:text-4xl">
                Materiales
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-neutral-600 sm:text-base">
                Accedé a los libros y recursos cargados para tus cursos activos.
              </p>
            </div>

            <div className="grid w-full gap-3 sm:grid-cols-2 md:w-auto md:min-w-[360px]">
              <div className="rounded-3xl border border-violet-100 bg-violet-50/80 px-5 py-4 shadow-sm">
                <p className="text-xs font-black uppercase tracking-wide text-violet-500">
                  Año
                </p>
                <p className="mt-1 text-sm font-black text-violet-800">
                  {year}
                </p>
              </div>

              <div className="rounded-3xl border border-indigo-100 bg-indigo-50/80 px-5 py-4 shadow-sm">
                <p className="text-xs font-black uppercase tracking-wide text-indigo-500">
                  Cursos con material
                </p>
                <p className="mt-1 text-sm font-black text-indigo-800">
                  {totalWithMaterials}/{rows.length}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* LOADING */}
      {loading && (
        <section className="overflow-hidden rounded-[2rem] border border-neutral-200 bg-white p-5 shadow-xl shadow-neutral-100 sm:p-7">
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 animate-pulse rounded-2xl bg-neutral-100" />

              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-6 w-56 animate-pulse rounded-full bg-neutral-100" />
                <div className="h-4 w-80 max-w-full animate-pulse rounded-full bg-neutral-100" />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="h-48 animate-pulse rounded-[2rem] bg-neutral-100" />
              <div className="h-48 animate-pulse rounded-[2rem] bg-neutral-100" />
            </div>
          </div>
        </section>
      )}

      {/* ERROR */}
      {!loading && err && (
        <section className="rounded-[2rem] border border-rose-200 bg-rose-50 p-6 text-rose-700 shadow-sm">
          <h2 className="text-xl font-black">
            No se pudieron cargar tus materiales
          </h2>
          <p className="mt-1 text-sm font-bold">
            {err}
          </p>
        </section>
      )}

      {/* EMPTY */}
      {!loading && !err && rows.length === 0 && (
        <section className="rounded-[2rem] border border-dashed border-neutral-200 bg-neutral-50 p-8 text-center">
          <div className="mb-3 text-5xl">
            📭
          </div>

          <h3 className="text-lg font-black text-neutral-800">
            No tenés cursos activos en {year}
          </h3>

          <p className="mt-1 text-sm text-neutral-500">
            Cuando tengas cursos activos, los materiales aparecerán en esta sección.
          </p>
        </section>
      )}

      {/* LISTADO */}
      {!loading && !err && rows.length > 0 && (
        <section className="space-y-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-black text-neutral-950">
                Mis cursos
              </h2>
              <p className="text-sm text-neutral-500">
                Materiales disponibles por curso.
              </p>
            </div>

            <span className="w-fit rounded-full border border-violet-100 bg-violet-50 px-4 py-2 text-xs font-black uppercase tracking-wide text-violet-700">
              {rows.length} curso{rows.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="grid gap-5">
            {rows.map(row => {
              const m = row.materials || {};
              const hasAny = Boolean(m.studentBook || m.workbook || m.reader);
              const count = [m.studentBook, m.workbook, m.reader].filter(Boolean).length;

              return (
                <article
                  key={row.id}
                  className="overflow-hidden rounded-[2rem] border border-neutral-200 bg-white shadow-xl shadow-neutral-100"
                >
                  <div className="relative overflow-hidden bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-500 px-5 py-5 text-white sm:px-6">
                    <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/20 blur-2xl" />
                    <div className="absolute -bottom-12 -left-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />

                    <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-2xl shadow-sm backdrop-blur-sm">
                          📘
                        </div>

                        <div className="min-w-0">
                          <h3 className="break-words text-xl font-black leading-tight sm:text-2xl">
                            {row.title}
                          </h3>

                          <p className="mt-1 text-sm font-semibold text-white/85">
                            Materiales visibles para el alumno
                          </p>
                        </div>
                      </div>

                      <span className="w-fit rounded-full border border-white/20 bg-white/15 px-4 py-2 text-xs font-black uppercase tracking-wide text-white shadow-sm backdrop-blur-sm">
                        {hasAny ? `${count} recurso${count === 1 ? '' : 's'}` : 'Sin materiales'}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 sm:p-5">
                    {!hasAny ? (
                      <div className="rounded-3xl border border-dashed border-neutral-200 bg-neutral-50 p-6 text-center">
                        <div className="mb-2 text-4xl">
                          📭
                        </div>

                        <p className="text-sm font-bold text-neutral-700">
                          Aún no hay materiales cargados
                        </p>

                        <p className="mt-1 text-xs text-neutral-500">
                          Cuando el curso tenga recursos disponibles, los vas a ver acá.
                        </p>
                      </div>
                    ) : (
                      <div className="grid gap-4 md:grid-cols-3">
                        {m.studentBook && (
                          <MaterialCard
                            icon="📘"
                            title="Student Book"
                            description="Libro principal del curso."
                            href={m.studentBook}
                            accent="indigo"
                          />
                        )}

                        {m.workbook && (
                          <MaterialCard
                            icon="📒"
                            title="Workbook"
                            description="Actividades y práctica complementaria."
                            href={m.workbook}
                            accent="violet"
                          />
                        )}

                        {m.reader && (
                          <MaterialCard
                            icon="📖"
                            title="Reader"
                            description="Lectura asignada para el curso."
                            href={m.reader}
                            accent="fuchsia"
                          />
                        )}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function MaterialCard({
  icon,
  title,
  description,
  href,
  accent,
}: {
  icon: string;
  title: string;
  description: string;
  href: string;
  accent: 'indigo' | 'violet' | 'fuchsia';
}) {
  const styles = {
    indigo: {
      card: 'border-indigo-100 bg-gradient-to-br from-indigo-50 to-white hover:border-indigo-200',
      icon: 'bg-indigo-100',
      button: 'bg-indigo-600 shadow-indigo-100 group-hover:bg-indigo-700',
    },
    violet: {
      card: 'border-violet-100 bg-gradient-to-br from-violet-50 to-white hover:border-violet-200',
      icon: 'bg-violet-100',
      button: 'bg-violet-600 shadow-violet-100 group-hover:bg-violet-700',
    },
    fuchsia: {
      card: 'border-fuchsia-100 bg-gradient-to-br from-fuchsia-50 to-white hover:border-fuchsia-200',
      icon: 'bg-fuchsia-100',
      button: 'bg-fuchsia-600 shadow-fuchsia-100 group-hover:bg-fuchsia-700',
    },
  }[accent];

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`group rounded-3xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${styles.card}`}
    >
      <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl text-2xl transition group-hover:scale-105 ${styles.icon}`}>
        {icon}
      </div>

      <h4 className="text-lg font-black text-neutral-950">
        {title}
      </h4>

      <p className="mt-1 min-h-[40px] text-sm leading-relaxed text-neutral-500">
        {description}
      </p>

      <div className={`mt-4 inline-flex items-center rounded-full px-4 py-2 text-sm font-black text-white shadow-lg transition ${styles.button}`}>
        Abrir material →
      </div>
    </a>
  );
}
