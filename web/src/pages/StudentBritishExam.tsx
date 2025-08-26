import { useEffect, useState } from 'react';
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

export default function StudentBritishExam() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<BritishResult[]>([]);
  const [me, setMe] = useState<Me['user'] | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true); setErr(null);
      try {
        const [meR, data] = await Promise.all([api.me(), api.british.mine()]);
        if (!alive) return;
        setMe(meR.user);
        setRows(data.results || []);
      } catch (e:any) {
        if (!alive) return;
        setErr(e?.message || String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <div className="space-y-3">
      <h1 className="font-heading text-xl">Examen británico</h1>

      {loading && <div className="card p-4"><div className="h-20 skeleton"/></div>}
      {!loading && err && <div className="card p-4 text-danger">{err}</div>}
      {!loading && !err && rows.length === 0 && (
        <div className="card p-4">Aún no hay resultados.</div>
      )}

      {!loading && !err && rows.map((r, idx) => {
        const course = typeof r.course === 'string' ? null : r.course;
        return (
          <div key={(r as any)._id || idx} className="card p-0 overflow-hidden">
            {/* Encabezado */}
            <div className="px-4 py-3 text-white" style={{ background: 'var(--grad-primary)' }}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-7 w-7 rounded-xl" style={{ background: 'var(--grad-brand)' }} />
                  <div className="leading-tight">
                    <div className="text-xs opacity-90">Instituto Global-T</div>
                    <div className="font-medium">
                      {course?.name || 'Curso'} <span className="opacity-90">— {course?.year ?? ''}</span>
                    </div>
                    {me && (
                      <div className="text-xs opacity-90">Alumno: <b className="text-white">{me.name}</b></div>
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

            {/* Cuerpo */}
            <div className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-lg border border-neutral-200 bg-white">
                  <div className="text-sm text-neutral-600">Oral</div>
                  <div className="text-3xl font-bold">{r.oral ?? '—'}</div>
                </div>
                <div className="p-3 rounded-lg border border-neutral-200 bg-white">
                  <div className="text-sm text-neutral-600">Escrito</div>
                  <div className="text-3xl font-bold">{r.written ?? '—'}</div>
                </div>
                <div className="p-3 rounded-lg border border-neutral-200 bg-white">
                  <div className="text-sm text-neutral-600">Actualizado</div>
                  <div className="font-medium">
                    {r.updatedAt ? new Date(r.updatedAt).toLocaleDateString('es-AR') : '—'}
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
