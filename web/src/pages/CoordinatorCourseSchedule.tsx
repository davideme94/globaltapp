import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';

type Day = 'MON'|'TUE'|'WED'|'THU'|'FRI'|'SAT';
const DAY_LABEL: Record<Day,string> = { MON:'Lunes', TUE:'Martes', WED:'Miércoles', THU:'Jueves', FRI:'Viernes', SAT:'Sábado' };
const DAYS: Day[] = ['MON','TUE','WED','THU','FRI','SAT'];
type Row = { day: Day; start: string; end: string };

const th: React.CSSProperties = { borderBottom:'1px solid #e2e8f0', padding:6, textAlign:'left', background:'#f8fafc' };
const td: React.CSSProperties = { borderBottom:'1px solid #eef2f7', padding:6 };

function padTime(v: string) {
  const m = v.trim().match(/^(\d{1,2}):(\d{1,2})$/);
  if (!m) return null;
  let h = Number(m[1]), n = Number(m[2]);
  if (isNaN(h) || isNaN(n) || h<0 || h>23 || n<0 || n>59) return null;
  const hh = String(h).padStart(2,'0');
  const mm = String(n).padStart(2,'0');
  return `${hh}:${mm}`;
}
function timeToMins(t: string) { const [h,m]=t.split(':').map(Number); return h*60+m; }

export default function CoordinatorCourseSchedule() {
  const { id } = useParams<{ id:string }>();
  const [course, setCourse] = useState<{ _id:string; name:string; year:number }|null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [msg, setMsg] = useState<string|null>(null);
  const [err, setErr] = useState<string|null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!id) return;
    try {
      setLoading(true); setErr(null);
      const r = await api.courses.schedule.get(id);
      setCourse(r.course);
      setRows((r.schedule as Row[]) ?? []);
    } catch (e:any) {
      setErr(e?.message || 'No se pudieron cargar los horarios');
    } finally {
      setLoading(false);
    }
  }
  useEffect(()=>{ load(); }, [id]);

  const title = useMemo(()=> course ? `${course.name} (${course.year})` : '', [course]);

  function addRow() {
    // Por UX, si ya hay filas intenta usar mismo día de la última
    const lastDay = rows.at(-1)?.day ?? 'MON';
    setRows(prev => [...prev, { day:lastDay as Day, start:'18:00', end:'19:00' }]);
  }
  function removeRow(i: number) {
    setRows(prev => prev.filter((_,idx)=>idx!==i));
  }

  async function save() {
    if (!id) return;

    // Normalización + validaciones
    const normalized: Row[] = [];
    for (let i=0;i<rows.length;i++){
      const r = rows[i];
      const start = padTime(r.start || '');
      const end   = padTime(r.end || '');
      if (!start || !end) {
        return setErr(`Fila ${i+1}: formato inválido. Usá HH:mm (ej: 18:30).`);
      }
      if (timeToMins(end) <= timeToMins(start)) {
        return setErr(`Fila ${i+1}: la hora de fin debe ser mayor a la de inicio.`);
      }
      normalized.push({ day:r.day, start, end });
    }

    // Ordenar por día + hora
    const dayOrder: Record<Day,number> = { MON:0, TUE:1, WED:2, THU:3, FRI:4, SAT:5 };
    const toSave = normalized.slice().sort((a,b)=>{
      const da = dayOrder[a.day] - dayOrder[b.day];
      if (da !== 0) return da;
      return timeToMins(a.start) - timeToMins(b.start);
    });

    setSaving(true); setErr(null);
    try {
      await api.courses.schedule.set(id, toSave as any);
      setMsg('Horarios guardados'); setTimeout(()=>setMsg(null), 1500);
      await load();
    } catch (e:any) {
      setErr(e?.message || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div style={{ padding:16 }}>Cargando…</div>;

  return (
    <div style={{ padding:16, maxWidth:900, margin:'0 auto', display:'grid', gap:12 }}>
      <h1>Horarios — {title}</h1>

      <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
        <Link to={`/coordinator/courses`}>↩ Volver</Link>
        <Link to={`/coordinator/course/${id}/manage`}>Gestionar</Link>
        <Link to={`/coordinator/course/${id}/attendance`}>Asistencia</Link>
        <Link to={`/coordinator/course/${id}/partials`}>Parciales</Link>
        <Link to={`/coordinator/course/${id}/boletin`}>Boletín</Link>
        <Link to={`/coordinator/course/${id}/practice`}>Práctica</Link>
        {msg && <span style={{ color:'#16a34a' }}>{msg}</span>}
        {err && <span style={{ color:'#dc2626' }}>{err}</span>}
      </div>

      <table style={{ width:'100%', borderCollapse:'collapse' }}>
        <thead>
          <tr>
            <th style={th}>Día</th>
            <th style={th}>Desde (HH:mm)</th>
            <th style={th}>Hasta (HH:mm)</th>
            <th style={th}></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i)=>(
            <tr key={i}>
              <td style={td}>
                <select
                  value={r.day}
                  onChange={e=>setRows(prev=>prev.map((x,idx)=>idx===i?{...x, day:e.target.value as Day}:x))}
                >
                  {DAYS.map(d=><option key={d} value={d}>{DAY_LABEL[d]}</option>)}
                </select>
              </td>
              <td style={td}>
                <input
                  value={r.start}
                  onChange={e=>setRows(prev=>prev.map((x,idx)=>idx===i?{...x, start:e.target.value}:x))}
                  placeholder="18:00"
                />
              </td>
              <td style={td}>
                <input
                  value={r.end}
                  onChange={e=>setRows(prev=>prev.map((x,idx)=>idx===i?{...x, end:e.target.value}:x))}
                  placeholder="19:00"
                />
              </td>
              <td style={td}><button onClick={()=>removeRow(i)}>Quitar</button></td>
            </tr>
          ))}
          {rows.length===0 && <tr><td colSpan={4} style={td}>Sin horarios cargados.</td></tr>}
        </tbody>
      </table>

      <div style={{ display:'flex', gap:8 }}>
        <button onClick={addRow}>+ Agregar fila</button>
        <button onClick={save} disabled={saving}>{saving ? 'Guardando…' : '💾 Guardar'}</button>
      </div>

      {rows.length>0 && (
        <div style={{ marginTop:8, color:'#64748b' }}>
          Vista previa: {rows.map(r=>`${DAY_LABEL[r.day]} ${padTime(r.start) ?? r.start}-${padTime(r.end) ?? r.end}`).join(' · ')}
        </div>
      )}
    </div>
  );
}
