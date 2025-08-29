// web/src/pages/StaffCases.tsx
import { useEffect, useMemo, useState } from 'react';
import { api, type StaffCase, type CaseStatus, type CaseCategory, type CaseSeverity } from '../lib/api';

const CATS: Record<CaseCategory, string> = {
  ACADEMIC_DIFFICULTY: 'Académico',
  ATTENDANCE: 'Asistencia',
  BEHAVIOR: 'Conducta',
  ADMIN: 'Admin',
  OTHER: 'Otro',
};

export default function StaffCases() {
  const [rows, setRows] = useState<StaffCase[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [status, setStatus] = useState<CaseStatus>('OPEN');
  const [cat, setCat] = useState<CaseCategory | ''>('');
  const [sev, setSev] = useState<CaseSeverity | ''>('');
  const [q, setQ] = useState('');

  const [replyTxt, setReplyTxt] = useState<Record<string,string>>({});
  const [courseAlertsId, setCourseAlertsId] = useState<string>('');

  async function load() {
    setLoading(true); setErr(null);
    try {
      const { rows } = await api.cases.list({
        status,
        category: cat || undefined,
        severity: sev || undefined,
      });
      setRows(rows);
    } catch (e:any) {
      setErr(e.message || 'Error al listar');
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [status, cat, sev]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return rows;
    return rows.filter(r => {
      const student = typeof r.student === 'string' ? '' : r.student?.name || '';
      const course  = typeof r.course === 'string' ? '' : (r.course?.name || '');
      return (`${student} ${course} ${r.title} ${r.description||''}`).toLowerCase().includes(qq);
    });
  }, [rows, q]);

  async function updateStatus(id: string, next: CaseStatus) {
    await api.cases.update(id, { status: next });
    await load();
  }

  async function sendReply(id: string) {
    const txt = (replyTxt[id] || '').trim();
    if (!txt) return;
    await api.cases.reply(id, txt);
    setReplyTxt(prev => ({ ...prev, [id]: '' }));
    await load();
  }

  async function runAlerts() {
    await api.alerts.run({ courseId: courseAlertsId || undefined, reminders: true });
    alert('Alertas ejecutadas ✅');
    await load();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-heading text-xl">Casos (seguimiento)</h1>
        <div className="flex gap-2">
          <input className="input w-48" placeholder="Course ID (opcional)" value={courseAlertsId} onChange={e=>setCourseAlertsId(e.target.value)} />
          <button className="btn btn-secondary" onClick={runAlerts}>Ejecutar alertas</button>
        </div>
      </div>

      <div className="card p-3 grid gap-2 md:grid-cols-4">
        <select className="input" value={status} onChange={e=>setStatus(e.target.value as CaseStatus)}>
          <option value="OPEN">Abiertos</option>
          <option value="IN_PROGRESS">En progreso</option>
          <option value="RESOLVED">Resueltos</option>
          <option value="ARCHIVED">Archivados</option>
        </select>
        <select className="input" value={cat} onChange={e=>setCat(e.target.value as CaseCategory| '')}>
          <option value="">Todas las categorías</option>
          <option value="ACADEMIC_DIFFICULTY">Académico</option>
          <option value="ATTENDANCE">Asistencia</option>
          <option value="BEHAVIOR">Conducta</option>
          <option value="ADMIN">Admin</option>
          <option value="OTHER">Otro</option>
        </select>
        <select className="input" value={sev} onChange={e=>setSev(e.target.value as CaseSeverity| '')}>
          <option value="">Todas las severidades</option>
          <option value="LOW">Baja</option>
          <option value="MEDIUM">Media</option>
          <option value="HIGH">Alta</option>
        </select>
        <input className="input" placeholder="Buscar…" value={q} onChange={e=>setQ(e.target.value)} />
      </div>

      <div className="card">
        {loading && <div className="p-3">Cargando…</div>}
        {err && <div className="p-3 text-danger">{err}</div>}
        {!loading && !err && filtered.length === 0 && <div className="p-3">Sin resultados.</div>}

        <ul className="divide-y">
          {filtered.map(c => {
            const student = typeof c.student === 'string' ? '' : c.student?.name || '';
            const course  = typeof c.course === 'string' || !c.course ? '' : `${c.course.name} (${c.course.year})`;
            return (
              <li key={c._id} className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white px-2 py-0.5 rounded-full" style={{ background: '#0ea5e9' }}>
                      {CATS[c.category]}
                    </span>
                    <b>{c.title}</b>
                  </div>
                  <small className="text-neutral-600">{new Date(c.createdAt).toLocaleString()}</small>
                </div>

                <div className="text-neutral-700 mt-1">{c.description || ''}</div>
                <div className="text-xs text-neutral-500 mt-1">
                  {student ? <>Alumno: {student} · </> : null}
                  {course ? <>Curso: {course} · </> : null}
                  Severidad: {c.severity} · Estado: {c.status} · Origen: {c.source}
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  {c.status !== 'IN_PROGRESS' && c.status !== 'RESOLVED' && (
                    <button className="btn btn-secondary !py-1" onClick={()=>updateStatus(c._id, 'IN_PROGRESS')}>Mover a “En progreso”</button>
                  )}
                  {c.status !== 'RESOLVED' && (
                    <button className="btn btn-secondary !py-1" onClick={()=>updateStatus(c._id, 'RESOLVED')}>Marcar “Resuelto”</button>
                  )}
                  {c.status !== 'ARCHIVED' && (
                    <button className="btn btn-secondary !py-1" onClick={()=>updateStatus(c._id, 'ARCHIVED')}>Archivar</button>
                  )}
                </div>

                <div className="mt-2 grid gap-2">
                  <textarea
                    className="input h-20"
                    placeholder="Escribí una nota/respuesta…"
                    value={replyTxt[c._id] || ''}
                    onChange={e=>setReplyTxt(prev => ({ ...prev, [c._id]: e.target.value }))}
                  />
                  <div>
                    <button className="btn btn-primary !py-1" onClick={()=>sendReply(c._id)}>Responder</button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
