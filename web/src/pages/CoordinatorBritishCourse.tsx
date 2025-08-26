import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';

type Provider = 'TRINITY' | 'CAMBRIDGE' | 'BRITANICO';

type UiRow = {
  studentId: string;
  name: string;
  oral: string;     // string para inputs; se convierte a number|null al guardar
  written: string;
  provider: Provider;
  saving?: boolean;
  justSaved?: boolean; // ← NUEVO: feedback visual post-guardado
};

type Props = {
  /** "edit": coordinador edita / "view": docente solo lectura */
  mode?: 'edit' | 'view';
};

export default function CoordinatorBritishCourse({ mode = 'edit' }: Props) {
  const { id: courseId } = useParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<UiRow[]>([]);
  const [courseTitle, setCourseTitle] = useState<string>('Curso');

  const readOnly = mode !== 'edit';

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!courseId) return;
      setLoading(true); setErr(null);

      try {
        // título de curso
        try {
          const { courses } = await api.courses.list({ year: new Date().getFullYear() });
          const found = (courses || []).find(c => c._id === courseId);
          if (found) setCourseTitle(`${found.name} — ${found.year}`);
        } catch {}

        // roster del curso
        const rosterR = await api.courses.roster(courseId);

        // resultados british existentes
        const brit = await api.british.byCourse(courseId, { year: new Date().getFullYear() })
          .catch(() => ({ rows: [] as any[] }));

        const resultsByStudent = new Map<string, any>();
        (brit.rows || []).forEach((it: any) => {
          const sid = typeof it.student === 'string' ? it.student : it.student?._id;
          if (sid) resultsByStudent.set(sid, it);
        });

        const ui: UiRow[] = (rosterR.roster || []).map((r: any) => {
          const sid = r.student?._id || r.student;
          const name = r.student?.name || 'Alumno';
          const res = resultsByStudent.get(sid);
          return {
            studentId: sid,
            name,
            oral: res?.oral ?? '',
            written: res?.written ?? '',
            provider: (res?.provider as Provider) || 'BRITANICO',
          };
        });

        if (!alive) return;
        setRows(ui);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || String(e));
        setRows([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [courseId]);

  const anySaving = useMemo(() => rows.some(r => r.saving), [rows]);

  const saveOne = async (r: UiRow) => {
    if (!courseId) return;
    const toNum = (v: string): number | null => {
      const s = String(v ?? '').trim();
      if (s === '') return null;
      const n = Number(s);
      return Number.isFinite(n) ? n : null;
    };
    const payload = {
      courseId,
      studentId: r.studentId,
      provider: r.provider,
      oral: toNum(r.oral),
      written: toNum(r.written),
    };

    // estado: guardando
    setRows(prev => prev.map(x =>
      x.studentId === r.studentId ? { ...x, saving: true, justSaved: false } : x
    ));
    try {
      await api.british.upsert(payload);

      // éxito: mostrar “Guardado ✓” ~1.5s
      setRows(prev => prev.map(x =>
        x.studentId === r.studentId ? { ...x, saving: false, justSaved: true } : x
      ));
      setTimeout(() => {
        setRows(prev => prev.map(x =>
          x.studentId === r.studentId ? { ...x, justSaved: false } : x
        ));
      }, 1500);
    } catch (e: any) {
      alert(e?.message || 'No se pudo guardar.');
      setRows(prev => prev.map(x =>
        x.studentId === r.studentId ? { ...x, saving: false } : x
      ));
    }
  };

  return (
    <div className="space-y-3">
      <h1 className="font-heading text-xl">
        Británico {readOnly ? '(solo lectura)' : ''} — <span className="opacity-80">{courseTitle}</span>
      </h1>

      {loading && (
        <div className="card p-4 space-y-2">
          <div className="h-5 w-48 skeleton" />
          <div className="h-24 skeleton" />
        </div>
      )}

      {!loading && err && (
        <div className="card p-4 text-danger">{err}</div>
      )}

      {!loading && !err && rows.length === 0 && (
        <div className="card p-4">Aún no hay alumnos en el curso.</div>
      )}

      {!loading && !err && rows.length > 0 && (
        <div className="card p-0 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-50">
              <tr>
                <th className="text-left px-3 py-2">Alumno</th>
                <th className="text-left px-3 py-2">Proveedor</th>
                <th className="text-left px-3 py-2">Oral</th>
                <th className="text-left px-3 py-2">Escrito</th>
                {!readOnly && <th className="px-3 py-2 text-right">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.studentId} className="border-t">
                  <td className="px-3 py-2">{r.name}</td>
                  <td className="px-3 py-2">
                    <select
                      className="input !h-8"
                      disabled={readOnly || r.saving}
                      value={r.provider}
                      onChange={e => setRows(prev => prev.map(x => x.studentId === r.studentId ? { ...x, provider: e.target.value as Provider } : x))}
                    >
                      <option value="TRINITY">Trinity College</option>
                      <option value="CAMBRIDGE">Cambridge</option>
                      <option value="BRITANICO">Británico</option>
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className="input !h-8 w-24"
                      placeholder="0–100"
                      disabled={readOnly || r.saving}
                      value={r.oral ?? ''}
                      onChange={e => setRows(prev => prev.map(x => x.studentId === r.studentId ? { ...x, oral: e.target.value } : x))}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className="input !h-8 w-24"
                      placeholder="0–100"
                      disabled={readOnly || r.saving}
                      value={r.written ?? ''}
                      onChange={e => setRows(prev => prev.map(x => x.studentId === r.studentId ? { ...x, written: e.target.value } : x))}
                    />
                  </td>
                  {!readOnly && (
                    <td className="px-3 py-2 text-right">
                      <button
                        className={
                          'btn !h-8 !py-0 disabled:opacity-60 ' +
                          (r.justSaved ? '!bg-emerald-600 text-white' : 'btn-primary')
                        }
                        disabled={r.saving || anySaving}
                        onClick={() => saveOne(r)}
                        aria-live="polite"
                      >
                        {r.saving ? 'Guardando…' : (r.justSaved ? 'Guardado ✓' : 'Guardar')}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
