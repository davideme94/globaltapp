import { useEffect, useMemo, useState } from 'react';
import { api, type BritishResult, type Me } from '../lib/api';

function providerLabel(p?: string) {
  switch (p) {
    case 'TRINITY':
      return 'Trinity College';
    case 'CAMBRIDGE':
      return 'Cambridge';
    case 'BRITISH':
      return 'Británico';
    case 'BRITANICO':
      return 'Británico';
    case 'OTHER':
      return 'Otro';
    default:
      return '—';
  }
}

function isFailed(oral: number | null, written: number | null) {
  return (oral != null && oral < 50) || (written != null && written < 50);
}

function isApproved(oral: number | null, written: number | null) {
  const hasAny = oral != null || written != null;

  if (!hasAny) return false;

  return !isFailed(oral, written);
}

function resultBox(oral: number | null, written: number | null) {
  const failed = isFailed(oral, written);
  const approved = isApproved(oral, written);
  const empty = oral === null && written === null;

  if (failed) {
    return {
      title: 'Desaprobado',
      text: 'Hay al menos una instancia por debajo de 50.',
      icon: '⚠️',
      boxClass: 'border-rose-200 bg-rose-50',
      titleClass: 'text-rose-800',
      textClass: 'text-rose-600',
    };
  }

  if (approved) {
    return {
      title: 'Aprobado',
      text: 'El resultado cargado cumple con el mínimo requerido.',
      icon: '✅',
      boxClass: 'border-emerald-200 bg-emerald-50',
      titleClass: 'text-emerald-800',
      textClass: 'text-emerald-600',
    };
  }

  if (empty) {
    return {
      title: 'Sin resultados',
      text: 'Aún no hay resultados cargados para este año.',
      icon: '📭',
      boxClass: 'border-neutral-200 bg-neutral-50',
      titleClass: 'text-neutral-800',
      textClass: 'text-neutral-500',
    };
  }

  return {
    title: 'En revisión',
    text: 'Resultado cargado parcialmente.',
    icon: '🕓',
    boxClass: 'border-amber-200 bg-amber-50',
    titleClass: 'text-amber-800',
    textClass: 'text-amber-600',
  };
}

function ScoreCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string | null | undefined;
  accent: 'violet' | 'sky' | 'emerald';
}) {
  const styles = {
    violet: {
      box: 'border-violet-100 bg-violet-50',
      label: 'text-violet-500',
      value: 'text-violet-900',
    },
    sky: {
      box: 'border-sky-100 bg-sky-50',
      label: 'text-sky-500',
      value: 'text-sky-900',
    },
    emerald: {
      box: 'border-emerald-100 bg-emerald-50',
      label: 'text-emerald-500',
      value: 'text-emerald-900',
    },
  }[accent];

  return (
    <div className={`rounded-3xl border px-5 py-4 shadow-sm ${styles.box}`}>
      <p className={`text-xs font-black uppercase tracking-wide ${styles.label}`}>
        {label}
      </p>

      <p className={`mt-2 text-3xl font-black ${styles.value}`}>
        {value ?? '—'}
      </p>
    </div>
  );
}

export default function StudentBritishExam() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<BritishResult[]>([]);
  const [me, setMe] = useState<Me['user'] | null>(null);

  const [year, setYear] = useState<number>(new Date().getFullYear());

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setErr(null);

      try {
        const [meR, data] = await Promise.all([
          api.me(),
          api.british.mine(),
        ]);

        if (!alive) return;

        setMe(meR.user);
        setRows(data.results || []);
      } catch (e: any) {
        if (!alive) return;

        setErr(e?.message || String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const years = useMemo(() => {
    const ys = rows.map(r => r.year).filter(Boolean) as number[];

    return Array.from(new Set(ys)).sort((a, b) => b - a);
  }, [rows]);

  const filtered = useMemo(() => {
    const data = rows.filter(r => r.year === year);

    if (data.length === 0) {
      return [{
        _id: 'virtual',
        year,
        oral: null,
        written: null,
        provider: 'BRITANICO',
        updatedAt: null,
        course: rows[0]?.course || null,
      }] as any;
    }

    return data;
  }, [rows, year]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6 px-3 py-4 sm:px-5 md:px-6 md:py-6">
        <section className="overflow-hidden rounded-[2rem] border border-neutral-200 bg-white p-5 shadow-xl shadow-neutral-100 sm:p-7">
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 animate-pulse rounded-2xl bg-neutral-100" />

              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-6 w-56 animate-pulse rounded-full bg-neutral-100" />
                <div className="h-4 w-80 max-w-full animate-pulse rounded-full bg-neutral-100" />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="h-40 animate-pulse rounded-[2rem] bg-neutral-100" />
              <div className="h-40 animate-pulse rounded-[2rem] bg-neutral-100" />
              <div className="h-40 animate-pulse rounded-[2rem] bg-neutral-100" />
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-3 py-4 sm:px-5 md:px-6 md:py-6">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-r from-violet-600 via-fuchsia-500 to-sky-500 p-[2px] shadow-xl shadow-violet-100">
        <div className="relative overflow-hidden rounded-[2rem] bg-white p-5 sm:p-7 md:p-8">
          <div className="absolute -right-14 -top-14 h-44 w-44 rounded-full bg-violet-200/60 blur-3xl" />
          <div className="absolute -bottom-16 -left-14 h-44 w-44 rounded-full bg-sky-200/60 blur-3xl" />

          <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="mb-3 w-fit rounded-full border border-violet-100 bg-violet-50 px-4 py-1.5 text-xs font-black uppercase tracking-wide text-violet-700">
                🇬🇧 Examen británico
              </div>

              <h1 className="text-2xl font-black tracking-tight text-neutral-950 sm:text-3xl md:text-4xl">
                Resultado de examen británico
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-neutral-600 sm:text-base">
                Consultá tus resultados de instancia oral y escrita, proveedor y estado general del examen.
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

              <div className="rounded-3xl border border-sky-100 bg-sky-50/80 px-5 py-4 shadow-sm">
                <p className="text-xs font-black uppercase tracking-wide text-sky-500">
                  Alumno
                </p>
                <p className="mt-1 break-words text-sm font-black text-sky-800">
                  {me?.name || '—'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {err && (
        <section className="rounded-[2rem] border border-rose-200 bg-rose-50 p-6 text-rose-700 shadow-sm">
          <h2 className="text-xl font-black">
            No se pudo cargar el examen británico
          </h2>
          <p className="mt-1 text-sm font-bold">
            {err}
          </p>
        </section>
      )}

      {/* SELECTOR DE AÑO */}
      <section className="rounded-[2rem] border border-neutral-200 bg-white p-4 shadow-xl shadow-neutral-100 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-black text-neutral-950">
              Seleccionar año
            </h2>
            <p className="text-sm text-neutral-500">
              Cambiá el ciclo lectivo para consultar otros resultados.
            </p>
          </div>

          <div className="flex w-full items-center justify-between gap-3 rounded-3xl border border-neutral-200 bg-neutral-50 p-2 sm:w-auto">
            <button
              onClick={() => setYear(y => y - 1)}
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-neutral-200 bg-white text-lg font-black text-neutral-700 shadow-sm transition hover:bg-neutral-100"
            >
              ◀
            </button>

            <div className="min-w-[96px] text-center text-2xl font-black text-neutral-950">
              {year}
            </div>

            <button
              onClick={() => setYear(y => y + 1)}
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-neutral-200 bg-white text-lg font-black text-neutral-700 shadow-sm transition hover:bg-neutral-100"
            >
              ▶
            </button>
          </div>
        </div>

        {years.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {years.map(y => (
              <button
                key={y}
                onClick={() => setYear(y)}
                className={`rounded-full border px-4 py-2 text-xs font-black uppercase tracking-wide transition ${
                  y === year
                    ? 'border-violet-200 bg-violet-600 text-white shadow-lg shadow-violet-100'
                    : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                {y}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* RESULTADOS */}
      <section className="grid gap-5">
        {!err && filtered.map((r, idx) => {
          const course = typeof r.course === 'string' ? null : r.course;

          const oral = r.oral ?? null;
          const written = r.written ?? null;
          const status = resultBox(oral, written);

          return (
            <article
              key={(r as any)._id || idx}
              className="overflow-hidden rounded-[2rem] border border-neutral-200 bg-white shadow-xl shadow-neutral-100"
            >
              {/* Header */}
              <div className="relative overflow-hidden bg-gradient-to-r from-violet-600 via-fuchsia-500 to-sky-500 px-5 py-5 text-white sm:px-6">
                <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/20 blur-2xl" />
                <div className="absolute -bottom-12 -left-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />

                <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-2xl shadow-sm backdrop-blur-sm">
                      🇬🇧
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs font-black uppercase tracking-wide text-white/80">
                        Instituto Global-T
                      </p>

                      <h2 className="mt-1 break-words text-xl font-black leading-tight sm:text-2xl">
                        {course?.name || 'Curso'} — {year}
                      </h2>

                      {me && (
                        <p className="mt-1 text-sm font-semibold text-white/85">
                          Alumno: <b className="text-white">{me.name}</b>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="w-fit rounded-full border border-white/20 bg-white/15 px-4 py-2 text-xs font-black uppercase tracking-wide text-white shadow-sm backdrop-blur-sm">
                    {providerLabel(r.provider)}
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="space-y-5 p-4 sm:p-5">
                <div className={`rounded-3xl border px-5 py-4 ${status.boxClass}`}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="text-3xl">
                        {status.icon}
                      </div>

                      <div>
                        <h3 className={`text-lg font-black uppercase tracking-wide ${status.titleClass}`}>
                          {status.title}
                        </h3>

                        <p className={`mt-1 text-sm font-semibold ${status.textClass}`}>
                          {status.text}
                        </p>
                      </div>
                    </div>

                    <span className="w-fit rounded-full border border-white/70 bg-white/70 px-4 py-2 text-xs font-black uppercase tracking-wide text-neutral-700 shadow-sm">
                      {providerLabel(r.provider)}
                    </span>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <ScoreCard
                    label="Oral"
                    value={oral}
                    accent="violet"
                  />

                  <ScoreCard
                    label="Escrito"
                    value={written}
                    accent="sky"
                  />

                  <div className="rounded-3xl border border-neutral-200 bg-neutral-50 px-5 py-4 shadow-sm sm:col-span-2 lg:col-span-1">
                    <p className="text-xs font-black uppercase tracking-wide text-neutral-500">
                      Actualizado
                    </p>

                    <p className="mt-2 text-xl font-black text-neutral-900">
                      {r.updatedAt
                        ? new Date(r.updatedAt).toLocaleDateString('es-AR')
                        : '—'}
                    </p>
                  </div>
                </div>

                {oral === null && written === null && (
                  <div className="rounded-3xl border border-dashed border-neutral-200 bg-neutral-50 p-6 text-center">
                    <div className="mb-2 text-4xl">
                      📭
                    </div>

                    <p className="text-sm font-bold text-neutral-700">
                      Todavía no hay resultados cargados para este año
                    </p>

                    <p className="mt-1 text-xs text-neutral-500">
                      Cuando se cargue el resultado, aparecerá en esta pantalla.
                    </p>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}


