import { useEffect, useMemo, useState } from 'react';
import { api, type BritishResult, type Me } from '../lib/api';

function providerLabel(p?: string) {
  switch (p) {
    case 'TRINITY': return 'Trinity College';
    case 'CAMBRIDGE': return 'Cambridge';
    case 'BRITISH': return 'Británico';
    case 'OTHER': return 'Otro';
    default: return '—';
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
          api.british.mine()
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

    return () => { alive = false; };

  }, []);

  const years = useMemo(() => {
    const ys = rows
      .map(r => {
        const course = typeof r.course === 'string' ? null : r.course;
        return course?.year;
      })
      .filter(Boolean) as number[];

    return Array.from(new Set(ys)).sort((a, b) => b - a);
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter(r => {
      const course = typeof r.course === 'string' ? null : r.course;
      return course?.year === year;
    });
  }, [rows, year]);

  return (
    <div className="space-y-3">

      <h1 className="font-heading text-xl">Examen británico</h1>

      {/* SELECTOR DE AÑO */}
      <div className="flex items-center gap-4 mb-3">

        <button
          onClick={() => setYear(y => y - 1)}
          className="px-3 py-1 rounded-lg border hover:bg-neutral-100"
        >
          ◀
        </button>

        <div className="text-lg font-semibold">
          {year}
        </div>

        <button
          onClick={() => setYear(y => y + 1)}
          className="px-3 py-1 rounded-lg border hover:bg-neutral-100"
        >
          ▶
        </button>

      </div>

      {loading && (
        <div className="card p-4">
          <div className="h-20 skeleton"/>
        </div>
      )}

      {!loading && err && (
        <div className="card p-4 text-danger">{err}</div>
      )}

      {!loading && !err && filtered.length === 0 && (
        <div className="card p-4">
          No hay resultados para {year}.
        </div>
      )}

      {!loading && !err && filtered.map((r, idx) => {

        const course = typeof r.course === 'string' ? null : r.course;

        const failed = isFailed(r.oral ?? null, r.written ?? null);
        const approved = isApproved(r.oral ?? null, r.written ?? null);

        return (
          <div key={(r as any)._id || idx} className="card p-0 overflow-hidden">

            {/* Header */}
            <div
              className="px-4 py-3 text-white"
              style={{ background: 'var(--grad-primary)' }}
            >

              <div className="flex items-center justify-between gap-3">

                <div className="flex items-center gap-3">

                  <div
                    className="h-7 w-7 rounded-xl"
                    style={{ background: 'var(--grad-brand)' }}
                  />

                  <div className="leading-tight">

                    <div className="text-xs opacity-90">
                      Instituto Global-T
                    </div>

                    <div className="font-medium">
                      {course?.name || 'Curso'} — {course?.year ?? ''}
                    </div>

                    {me && (
                      <div className="text-xs opacity-90">
                        Alumno: <b className="text-white">{me.name}</b>
                      </div>
                    )}

                  </div>

                </div>

                <div className="text-right">
                  <span className="px-3 py-1 rounded-full text-xs font-semibold border border-white/50">
                    {providerLabel(r.provider)}
                  </span>
                </div>

              </div>

            </div>

            {/* Body */}
            <div className="p-4">

              {failed && (
                <div className="mb-3 px-3 py-2 rounded-lg bg-red-100 text-red-700 font-semibold text-center">
                  DESAPROBADO
                </div>
              )}

              {!failed && approved && (
                <div className="mb-3 px-3 py-2 rounded-lg bg-emerald-100 text-emerald-700 font-semibold text-center">
                  APROBADO
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

                <div className="p-3 rounded-lg border border-neutral-200 bg-white">
                  <div className="text-sm text-neutral-600">Oral</div>
                  <div className="text-3xl font-bold">
                    {r.oral ?? '—'}
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-neutral-200 bg-white">
                  <div className="text-sm text-neutral-600">Escrito</div>
                  <div className="text-3xl font-bold">
                    {r.written ?? '—'}
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-neutral-200 bg-white">
                  <div className="text-sm text-neutral-600">Actualizado</div>
                  <div className="font-medium">
                    {r.updatedAt
                      ? new Date(r.updatedAt).toLocaleDateString('es-AR')
                      : '—'}
                  </div>
                </div>

              </div>

            </div>

          </div>
        );
      })}

    </div>
  );
}


