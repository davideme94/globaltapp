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
  const [err, setErr] = useState<string | null>(null);
  const [title, setTitle] = useState<string>('Curso');
  const [form, setForm] = useState<Form>({});

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!courseId) return;
      setLoading(true); setErr(null);
      try {
        const r = await getJSON<LoadResp>(`/courses/${encodeURIComponent(courseId)}/student-materials`);
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
    return () => { alive = false; };
  }, [courseId]);

  const save = async () => {
    if (!courseId) return;
    setErr(null);
    try {
      await postJSON(`/courses/${encodeURIComponent(courseId)}/student-materials`, { materials: form });
      alert('Materiales guardados.');
    } catch (e: any) {
      setErr(e?.message || 'No se pudo guardar.');
    }
  };

  const set = (k: keyof Form, v: string) => setForm(prev => ({ ...prev, [k]: v || undefined }));

  return (
    <div className="space-y-3">
      <h1 className="font-heading text-xl">Material (alumnos) — <span className="opacity-80">{title}</span></h1>

      {loading && (
        <div className="card p-4 space-y-2">
          <div className="h-5 w-48 skeleton" />
          <div className="h-24 skeleton" />
        </div>
      )}

      {!loading && (
        <div className="card p-4 space-y-3 max-w-2xl">
          {err && <div className="text-danger">{err}</div>}

          <div className="grid gap-3">
            <label className="grid gap-1">
              <span className="text-sm font-medium">Student Book (URL)</span>
              <input
                className="input"
                placeholder="https://..."
                value={form.studentBook || ''}
                onChange={e => set('studentBook', e.target.value)}
              />
            </label>
            <label className="grid gap-1">
              <span className="text-sm font-medium">Workbook (URL)</span>
              <input
                className="input"
                placeholder="https://..."
                value={form.workbook || ''}
                onChange={e => set('workbook', e.target.value)}
              />
            </label>
            <label className="grid gap-1">
              <span className="text-sm font-medium">Reader (URL)</span>
              <input
                className="input"
                placeholder="https://..."
                value={form.reader || ''}
                onChange={e => set('reader', e.target.value)}
              />
            </label>
          </div>

          <div className="pt-2">
            <button className="btn btn-primary" onClick={save}>Guardar</button>
          </div>
        </div>
      )}
    </div>
  );
}
