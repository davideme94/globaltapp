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
        setLoading(true); setErr(null);

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
            const m = await getJSON<MaterialsResp>(`/courses/${encodeURIComponent(c._id)}/student-materials`);
            items.push({
              id: c._id,
              title: `${c.name} — ${c.year}`,
              materials: m.materials || null,
            });
          } catch {
            items.push({ id: c._id, title: `${c.name} — ${c.year}`, materials: null });
          }
        }

        if (!alive) return;
        setRows(items);
      } catch (e:any) {
        if (!alive) return;
        setErr(e?.message || 'No se pudieron cargar tus cursos.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <div className="space-y-3">
      <h1 className="font-heading text-xl">Materiales</h1>

      {loading && (
        <div className="card p-4 space-y-2">
          <div className="h-5 w-48 skeleton" />
          <div className="h-24 skeleton" />
        </div>
      )}

      {!loading && err && <div className="card p-4 text-danger">{err}</div>}

      {!loading && !err && (
        rows.length === 0 ? (
          <div className="card p-4 text-neutral-700">No tenés cursos activos en {year}.</div>
        ) : (
          <div className="space-y-3">
            {rows.map(row => {
              const m = row.materials || {};
              const hasAny = !!(m.studentBook || m.workbook || m.reader);
              return (
                <div key={row.id} className="card p-4">
                  <div className="font-heading mb-2">{row.title}</div>

                  {!hasAny ? (
                    <div className="text-neutral-600">Aún no hay materiales cargados.</div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {m.studentBook && (
                        <a className="btn btn-secondary" href={m.studentBook} target="_blank" rel="noopener noreferrer">
                          Student Book
                        </a>
                      )}
                      {m.workbook && (
                        <a className="btn btn-secondary" href={m.workbook} target="_blank" rel="noopener noreferrer">
                          Workbook
                        </a>
                      )}
                      {m.reader && (
                        <a className="btn btn-secondary" href={m.reader} target="_blank" rel="noopener noreferrer">
                          Reader
                        </a>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
