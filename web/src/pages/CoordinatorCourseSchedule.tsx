import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, type CourseScheduleItem } from '../lib/api';

// Códigos y labels
const DAYS: { code: 'MON'|'TUE'|'WED'|'THU'|'FRI'|'SAT'; label: string }[] = [
  { code: 'MON', label: 'Lunes' },
  { code: 'TUE', label: 'Martes' },
  { code: 'WED', label: 'Miércoles' },
  { code: 'THU', label: 'Jueves' },
  { code: 'FRI', label: 'Viernes' },
  { code: 'SAT', label: 'Sábado' },
];

const DAY_LABEL: Record<string,string> = Object.fromEntries(DAYS.map(d => [d.code, d.label]));

type Row = { day: 'MON'|'TUE'|'WED'|'THU'|'FRI'|'SAT'; start: string; end: string };

function toRow(items: CourseScheduleItem[]): Row[] {
  return (items || []).map(it => ({
    day: (it.day as any) || 'MON',
    start: it.start || '',
    end: it.end || '',
  }));
}

function fromRows(rows: Row[]): CourseScheduleItem[] {
  return rows
    .filter(r => r.start && r.end)
    .map(r => ({ day: r.day, start: r.start, end: r.end }));
}

function formatPreview(rows: Row[]) {
  return rows
    .filter(r => r.start && r.end)
    .map(r => `${DAY_LABEL[r.day]} ${r.start}–${r.end}`)
    .join(' · ');
}

export default function CoordinatorCourseSchedule() {
  const { id: courseId } = useParams();
  const [course, setCourse] = useState<{ _id:string; name:string; year:number } | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string|null>(null);
  const [msg, setMsg] = useState<string|null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true); setErr(null);
      try {
        if (!courseId) throw new Error('Falta courseId');
        const { course, schedule } = await api.courses.schedule.get(courseId);
        if (!alive) return;
        setCourse(course);
        // ⚠️ Si vienen items viejos sin "day", default a 'MON'
        setRows(toRow((schedule as any[]) || []).map(r => ({
          day: (r as any).day || 'MON',
          start: (r as any).start || '',
          end: (r as any).end || '',
        })));
      } catch (e:any) {
        if (!alive) return;
        setErr(e.message || 'Error al cargar horarios');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [courseId]);

  const addRow = () => setRows(prev => [...prev, { day: 'MON', start: '', end: '' }]);
  const removeRow = (i: number) => setRows(prev => prev.filter((_, idx) => idx !== i));

  const setRow = (i: number, patch: Partial<Row>) =>
    setRows(prev => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const preview = useMemo(() => formatPreview(rows), [rows]);

  const save = async () => {
    if (!courseId) return;
    try {
      setSaving(true); setErr(null); setMsg(null);
      const items = fromRows(rows);
      await api.courses.schedule.set(courseId, items);
      setMsg('Horarios guardados');
    } catch (e:any) {
      setErr(e.message || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="card p-4"><div className="h-6 w-40 skeleton mb-3"/><div className="h-20 skeleton"/></div>;
  if (err) return <div className="card p-4 text-danger">{err}</div>;
  if (!course) return null;

  return (
    <div className="space-y-3">
      <h1 className="font-heading text-xl">
        Horarios — {course.name} ({course.year})
      </h1>

      <div className="flex flex-wrap gap-3 text-brand-primary">
        <Link to={`/coordinator/course/${course._id}/manage`} className="underline">↪ Volver</Link>
        <Link to={`/coordinator/course/${course._id}/attendance`} className="underline">Asistencia</Link>
        <Link to={`/coordinator/course/${course._id}/partials`} className="underline">Parciales</Link>
        <Link to={`/coordinator/course/${course._id}/boletin`} className="underline">Boletín</Link>
        <Link to={`/coordinator/course/${course._id}/practice`} className="underline">Práctica</Link>
      </div>

      <div className="card p-4">
        <table className="min-w-full">
          <thead>
            <tr className="text-left text-sm text-neutral-700">
              <th className="px-3 py-2 border-b">Día</th>
              <th className="px-3 py-2 border-b">Desde (HH:mm)</th>
              <th className="px-3 py-2 border-b">Hasta (HH:mm)</th>
              <th className="px-3 py-2 border-b"></th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="px-3 py-2">
                  <select
                    className="input"
                    value={r.day}
                    onChange={e => setRow(i, { day: e.target.value as Row['day'] })}
                  >
                    {DAYS.map(d => <option key={d.code} value={d.code}>{d.label}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <input
                    className="input"
                    type="time"
                    value={r.start}
                    onChange={e => setRow(i, { start: e.target.value })}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    className="input"
                    type="time"
                    value={r.end}
                    onChange={e => setRow(i, { end: e.target.value })}
                  />
                </td>
                <td className="px-3 py-2">
                  <button className="text-danger underline" onClick={() => removeRow(i)}>Quitar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-3 flex items-center gap-3">
          <button className="text-brand-primary underline" onClick={addRow}>+ Agregar fila</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
          {msg && <span className="text-success text-sm">{msg}</span>}
          {err && <span className="text-danger text-sm">{err}</span>}
        </div>

        <div className="mt-4 text-neutral-600">
          <b>Vista previa:</b> {preview || '—'}
        </div>
      </div>
    </div>
  );
}
