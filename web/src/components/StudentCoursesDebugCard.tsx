import { useEffect, useState } from 'react';

type Row = { course: { _id: string; name: string; year: number; campus: string }, schedule: Array<{ day?: string; start: string; end: string }> };
type Resp = { year: number; rows: Row[] };

export default function StudentCoursesDebugCard() {
  const [data, setData] = useState<Resp | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // mismo cálculo que api.ts
  const ORIGIN = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
  const BASE = ORIGIN ? `${ORIGIN}/api` : '/api';

  useEffect(() => {
    setLoading(true);
    fetch(`${BASE}/courses/mine?ts=${Date.now()}`, { credentials: 'include' })
      .then(async (r) => {
        const ct = r.headers.get('content-type') || '';
        if (!ct.includes('application/json')) throw new Error('Respuesta no JSON (¿pegaste al frontend 5173?)');
        const j = (await r.json()) as Resp;
        setData(j);
      })
      .catch((e) => setErr(String(e?.message || e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="rounded-2xl border bg-white p-4">
      <h3 className="font-heading mb-2">DEBUG /api/courses/mine</h3>
      {loading && <p>Cargando…</p>}
      {err && <p className="text-red-600">Error: {err}</p>}
      {data && (
        <>
          <p className="mb-2 text-sm text-gray-700">year: {data.year} — rows: {data.rows.length}</p>
          <pre className="text-xs overflow-auto max-h-64 bg-gray-50 p-2 rounded">{JSON.stringify(data, null, 2)}</pre>
        </>
      )}
    </div>
  );
}
