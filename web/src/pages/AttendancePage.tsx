import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, type RosterItem } from '../lib/api';

// Helpers
function todayStr() {
  const d = new Date();
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// Etiquetas para mostrar el horario lindo
const DAY_LABEL: Record<string,string> = {
  MON:'Lun', TUE:'Mar', WED:'Mié', THU:'Jue', FRI:'Vie', SAT:'Sáb'
};

type RowEdit = { studentId: string; status: 'P'|'A'|'T'|'J'|'' };

export default function AttendancePage() {
  const { id } = useParams<{ id:string }>();
  const [date, setDate] = useState(todayStr());
  const [roster, setRoster] = useState<RosterItem[]>([]);
  const [editRows, setEditRows] = useState<Record<string, RowEdit>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string|null>(null);

  // Horario del curso (nuevo)
  const [scheduleText, setScheduleText] = useState<string>('');  // "Lun 18:00-19:00 · Mié 18:00-19:00"

  // Histórica
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');
  const [grid, setGrid] = useState<{ dates: string[], rows: any[] }|null>(null);

  // Load roster + grid
  useEffect(() => {
    (async () => {
      if (!id) return;

      // roster
      const r = await api.courses.roster(id);
      setRoster(r.roster);
      const obj: Record<string, RowEdit> = {};
      r.roster.forEach(it => obj[it.student._id] = { studentId: it.student._id, status: '' });
      setEditRows(obj);

      // grilla
      await refreshGrid();

      // horario (nuevo)
      try {
        const s = await api.courses.schedule.get(id);
        const rows = (s.schedule ?? []) as { day:'MON'|'TUE'|'WED'|'THU'|'FRI'|'SAT'; start:string; end:string }[];
        setScheduleText(
          rows.length
            ? rows.map(x => `${DAY_LABEL[x.day]} ${x.start}-${x.end}`).join(' · ')
            : 'Sin horarios'
        );
      } catch {
        setScheduleText('Sin horarios');
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function refreshGrid() {
    if (!id) return;
    const r = await api.attendance.grid(id, { from, to });
    setGrid(r);
  }

  const filtered = useMemo(() => roster, [roster]);

  async function saveAll() {
    if (!id) return;
    setSaving(true); setMsg(null);
    try {
      for (const st of Object.values(editRows)) {
        if (!st.status) continue; // sin cambios
        await api.attendance.upsert({ courseId: id, date, studentId: st.studentId, status: st.status });
      }
      setMsg('Lista guardada.');
      // Limpiar selección y refrescar grilla
      const obj: Record<string, RowEdit> = {};
      roster.forEach(it => obj[it.student._id] = { studentId: it.student._id, status: '' });
      setEditRows(obj);
      await refreshGrid();
      setTimeout(()=>setMsg(null), 2000);
    } finally {
      setSaving(false);
    }
  }

  function setAll(status: 'P'|'A'|'T'|'J') {
    const obj: Record<string, RowEdit> = {};
    roster.forEach(it => obj[it.student._id] = { studentId: it.student._id, status });
    setEditRows(obj);
  }

  return (
    <div style={{ padding:16, maxWidth:1200 }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap', marginBottom:6 }}>
        <h1 style={{ margin:0 }}>Tomar asistencia</h1>
        {/* Chip con los días/horarios del curso */}
        <span style={{
          fontSize: 12,
          background: '#eef2ff',
          border: '1px solid #c7d2fe',
          color: '#1e293b',
          padding: '2px 6px',
          borderRadius: 9999
        }}>
          {scheduleText || '—'}
        </span>
        {msg && <span style={{ color:'#16a34a' }}>{msg}</span>}
      </div>

      {/* Barra superior: fecha + acciones */}
      <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap', marginBottom:12 }}>
        <label>Fecha: <input type="date" value={date} onChange={e=>setDate(e.target.value)} /></label>
        <button onClick={()=>setAll('P')}>Todos P</button>
        <button onClick={()=>setAll('A')}>Todos A</button>
        <button onClick={()=>setAll('T')}>Todos T</button>
        <button onClick={()=>setAll('J')}>Todos J</button>
        <button onClick={saveAll} disabled={saving}>{saving?'Guardando…':'Guardar lista'}</button>
      </div>

      {/* Editor del día */}
      <table style={{ width:'100%', borderCollapse:'collapse', marginBottom:18 }}>
        <thead>
          <tr>
            <th style={thLeft}>Alumno</th>
            <th style={th}>P</th>
            <th style={th}>A</th>
            <th style={th}>T</th>
            <th style={th}>J</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(item => {
            const st = editRows[item.student._id]?.status || '';
            return (
              <tr key={item.student._id}>
                <td style={tdLeft}>{item.student.name}</td>
                {(['P','A','T','J'] as const).map(s => (
                  <td key={s} style={tdCenter}>
                    <input
                      type="radio"
                      name={`st-${item.student._id}`}
                      checked={st === s}
                      onChange={()=>setEditRows(prev=>({ ...prev, [item.student._id]: { studentId: item.student._id, status: s } }))}
                    />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Grilla histórica */}
      <h2>Listas</h2>
      <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:8, flexWrap:'wrap' }}>
        <label>Desde: <input type="date" value={from} onChange={e=>setFrom(e.target.value)} /></label>
        <label>Hasta: <input type="date" value={to} onChange={e=>setTo(e.target.value)} /></label>
        <button onClick={refreshGrid}>Aplicar</button>
        <small style={{ color:'#64748b' }}>Si no elegís rango, se muestran todas las fechas con registros.</small>
      </div>

      <div style={{ overflowX:'auto' }}>
        {!grid || grid.dates.length===0 ? (
          <p>No hay registros aún.</p>
        ) : (
          <table style={{ borderCollapse:'collapse', minWidth:900 }}>
            <thead>
              <tr>
                <th style={thLeft2}>#</th>
                <th style={thLeft2}>Apellido y nombre</th>
                {grid.dates.map(d => <th key={d} style={th2}>{fmtDate(d)}</th>)}
                <th style={th2}>P</th>
                <th style={th2}>A</th>
                <th style={th2}>J</th>
                <th style={th2}>T</th>
                <th style={th2}>Total clases</th>
                <th style={th2}>% Asistencia</th>
              </tr>
            </thead>
            <tbody>
              {grid.rows.map((r, idx) => (
                <tr key={r.student._id}>
                  <td style={tdIdx}>{idx+1}</td>
                  <td style={tdName}>{r.student.name}</td>
                  {grid.dates.map(d => <td key={d} style={tdCell(getColor(r.statusByDate[d]))}>{r.statusByDate[d] ?? ''}</td>)}
                  <td style={tdSum}>{r.resume.P}</td>
                  <td style={tdSum}>{r.resume.A}</td>
                  <td style={tdSum}>{r.resume.J}</td>
                  <td style={tdSum}>{r.resume.T}</td>
                  <td style={tdSum}>{r.resume.total}</td>
                  <td style={tdSum}><b>{r.resume.percent}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// --- estilos y helpers ---
function fmtDate(s: string) {
  const [y,m,d] = s.split('-');
  return `${d}/${m}`;
}
function getColor(st?: string|null): React.CSSProperties {
  if (st==='P') return { background:'#22c55e', color:'#000' };   // verde
  if (st==='A') return { background:'#ef4444', color:'#fff' };   // rojo
  if (st==='T') return { background:'#fde047', color:'#000' };   // amarillo
  if (st==='J') return { background:'#67e8f9', color:'#000' };   // celeste
  return {};
}

const border = '1px solid #cbd5e1';
const th: React.CSSProperties = { border, padding:6, background:'#f8fafc' };
const thLeft: React.CSSProperties = { ...th, textAlign:'left' };
const tdLeft: React.CSSProperties = { border, padding:6, textAlign:'left' };
const tdCenter: React.CSSProperties = { border, padding:6, textAlign:'center' };

const th2: React.CSSProperties = { border, padding:6, background:'#e2e8f0', textAlign:'center', fontSize:13 };
const thLeft2: React.CSSProperties = { ...th2, textAlign:'left' };
const tdIdx: React.CSSProperties = { border, padding:'4px 6px', textAlign:'center', width:32, fontSize:13 };
const tdName: React.CSSProperties = { border, padding:'4px 6px', textAlign:'left', minWidth:240, fontSize:13, whiteSpace:'nowrap' };
const tdCell = (extra: React.CSSProperties) => ({ border, padding:'4px 8px', textAlign:'center', width:36, fontWeight:700, ...extra });
const tdSum: React.CSSProperties = { border, padding:'4px 6px', textAlign:'center', width:60, fontSize:13 };
