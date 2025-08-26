import { useEffect, useState } from 'react';
import { api } from '../lib/api';

type Term = {
  writing?: number | null;
  speaking?: number | null;
  reading?: number | null;
  listening?: number | null;
  comments?: string;
};
type Row = {
  course: { _id: string; name: string; year: number } | string;
  t1?: Term; t2?: Term; t3?: Term;
  updatedAt?: string;
};

function TermBox({ title, t }: { title: string; t?: Term }) {
  return (
    <div className="p-3 rounded-lg border border-neutral-200 bg-white">
      <div className="text-sm font-medium mb-1">{title}</div>
      {t ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <div>Writing: <b>{t.writing ?? '—'}</b></div>
          <div>Speaking: <b>{t.speaking ?? '—'}</b></div>
          <div>Reading: <b>{t.reading ?? '—'}</b></div>
          <div>Listening: <b>{t.listening ?? '—'}</b></div>
          {t.comments ? <div className="col-span-2 text-neutral-700">Comentarios: {t.comments}</div> : null}
        </div>
      ) : (
        <div className="text-neutral-600 text-sm">Sin datos</div>
      )}
    </div>
  );
}

export default function StudentPartialCards() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true); setErr(null);
        const r = await api.partials.mine();
        if (!alive) return;
        setRows(r.rows || []);
      } catch (e:any) {
        if (!alive) return;
        setErr(e?.message || 'No se pudieron cargar los informes parciales.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <h1 className="font-heading text-xl">Informes parciales</h1>
        <p className="text-neutral-700 text-sm">Notas trimestrales por curso.</p>
      </div>

      {loading && <div className="card p-4"><div className="h-20 skeleton"/></div>}
      {!loading && err && <div className="card p-4 text-danger">{err}</div>}
      {!loading && !err && rows.length === 0 && (
        <div className="card p-4">Aún no tenés informes parciales cargados.</div>
      )}

      {!loading && !err && rows.map((r, i) => {
        const course = typeof r.course === 'string' ? null : r.course;
        return (
          <div key={course?._id || i} className="card p-0 overflow-hidden">
            {/* Encabezado */}
            <div className="px-4 py-3 bg-white border-b">
              <div className="flex items-center justify-between">
                <div className="font-medium">
                  {course?.name || 'Curso'} <span className="text-neutral-600">— {course?.year ?? ''}</span>
                </div>
                {r.updatedAt ? (
                  <div className="text-sm text-neutral-600">Actualizado: {new Date(r.updatedAt).toLocaleDateString('es-AR')}</div>
                ) : null}
              </div>
            </div>

            {/* Trimestres */}
            <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              <TermBox title="1º Trimestre" t={r.t1}/>
              <TermBox title="2º Trimestre" t={r.t2}/>
              <TermBox title="3º Trimestre" t={r.t3}/>
            </div>
          </div>
        );
      })}
    </div>
  );
}
