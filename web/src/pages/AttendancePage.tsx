// web/src/pages/AttendancePage.tsx
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, type RosterItem } from '../lib/api';

function todayStr() {
  const d = new Date();
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

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

  const [scheduleText, setScheduleText] = useState<string>('');
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');
  const [grid, setGrid] = useState<{ dates: string[], rows: any[] }|null>(null);

  useEffect(() => {
    (async () => {
      if (!id) return;

      const r = await api.courses.roster(id);
      setRoster(r.roster);

      const obj: Record<string, RowEdit> = {};
      r.roster.forEach(it => obj[it.student._id] = { studentId: it.student._id, status: '' });
      setEditRows(obj);

      await refreshGrid();

      try {
        const s = await api.courses.schedule.get(id);
        const rows = s.schedule ?? [];
        setScheduleText(
          rows.length
            ? rows.map((x:any) => `${DAY_LABEL[x.day]} ${x.start}-${x.end}`).join(' · ')
            : 'Sin horarios'
        );
      } catch {
        setScheduleText('Sin horarios');
      }
    })();
  }, [id]);

  async function refreshGrid() {
    if (!id) return;
    const r = await api.attendance.grid(id, { from, to });
    setGrid(r);
  }

  const filtered = useMemo(() => roster, [roster]);

  async function saveAll() {
    if (!id) return;
    setSaving(true);
    for (const st of Object.values(editRows)) {
      if (!st.status) continue;
      await api.attendance.upsert({ courseId: id, date, studentId: st.studentId, status: st.status });
    }
    setMsg('💾 Lista guardada');
    await refreshGrid();
    setSaving(false);
    setTimeout(()=>setMsg(null), 2000);
  }

  function setAll(status: 'P'|'A'|'T'|'J') {
    const obj: Record<string, RowEdit> = {};
    roster.forEach(it => obj[it.student._id] = { studentId: it.student._id, status });
    setEditRows(obj);
  }

  return (
    <div style={{ padding:16, maxWidth:1200 }}>

      {/* HEADER */}
      <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap', marginBottom:10 }}>
        <h1 style={{ margin:0, fontSize:28 }}>📋 Tomar asistencia</h1>

        <span style={{
          fontSize:12,
          background:'#f3e8ff',
          border:'1px solid #d8b4fe',
          color:'#6b21a8',
          padding:'4px 10px',
          borderRadius:999
        }}>
          {scheduleText}
        </span>

        {msg && <span style={{ color:'#16a34a', fontWeight:600 }}>{msg}</span>}
      </div>

      {/* CONTROLES */}
      <div style={card}>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center', padding:12 }}>
          <input type="date" value={date} onChange={e=>setDate(e.target.value)} />

          {['P','A','T','J'].map(s => (
            <button key={s} onClick={()=>setAll(s as any)} style={pillBtn}>
              Todos {s}
            </button>
          ))}

          <button onClick={saveAll} style={saveBtn}>
            💾 GUARDAR LISTA
          </button>
        </div>
      </div>

      {/* TABLA EDITOR */}
      <div style={card}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead style={{ background:'#faf5ff' }}>
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
                <tr key={item.student._id} style={{ borderTop:'1px solid #eee' }}>
                  <td style={tdLeft}>{item.student.name}</td>

                  {(['P','A','T','J'] as const).map(s => (
                    <td key={s} style={tdCenter}>
                      <input
                        type="radio"
                        checked={st === s}
                        onChange={()=>setEditRows(prev=>({
                          ...prev,
                          [item.student._id]: { studentId: item.student._id, status: s }
                        }))}
                        style={{ transform:'scale(1.2)', accentColor:'#7c3aed' }}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* HISTORICO */}
      <h2 style={{ fontSize:20, marginTop:20 }}>📊 Listas</h2>

      <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:10 }}>
        <input type="date" value={from} onChange={e=>setFrom(e.target.value)} />
        <input type="date" value={to} onChange={e=>setTo(e.target.value)} />
        <button onClick={refreshGrid} style={pillBtn}>Aplicar</button>
      </div>

      {/* 🔥 SCROLL HORIZONTAL RESTAURADO */}
      <div style={{ overflowX:'auto' }}>
        {!grid || grid.dates.length===0 ? (
          <p>No hay registros aún.</p>
        ) : (
          <div style={card}>
            <table style={{ borderCollapse:'collapse', minWidth:900 }}>
              <thead>
                <tr>
                  <th style={thLeft}>#</th>
                  <th style={thLeft}>Apellido y nombre</th>
                  {grid.dates.map(d => <th key={d} style={th}>{fmtDate(d)}</th>)}
                  <th style={th}>P</th>
                  <th style={th}>A</th>
                  <th style={th}>J</th>
                  <th style={th}>T</th>
                  <th style={th}>Total</th>
                  <th style={th}>%</th>
                </tr>
              </thead>

              <tbody>
                {grid.rows.map((r, idx) => (
                  <tr key={r.student._id}>
                    <td style={tdCenter}>{idx+1}</td>
                    <td style={tdLeft}>{r.student.name}</td>
                    {grid.dates.map(d => (
                      <td key={d} style={tdCell(getColor(r.statusByDate[d]))}>
                        {r.statusByDate[d] ?? ''}
                      </td>
                    ))}
                    <td style={tdCenter}>{r.resume.P}</td>
                    <td style={tdCenter}>{r.resume.A}</td>
                    <td style={tdCenter}>{r.resume.J}</td>
                    <td style={tdCenter}>{r.resume.T}</td>
                    <td style={tdCenter}>{r.resume.total}</td>
                    <td style={tdCenter}><b>{r.resume.percent}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}

// estilos
const card = {
  borderRadius:16,
  border:'1px solid #e9d5ff',
  boxShadow:'0 4px 12px rgba(0,0,0,0.05)',
  marginBottom:12
};

const pillBtn = {
  padding:'6px 12px',
  borderRadius:999,
  border:'none',
  background:'#f1f5f9',
  fontWeight:600,
  cursor:'pointer'
};

const saveBtn = {
  padding:'8px 16px',
  borderRadius:999,
  border:'none',
  background:'#7c3aed',
  color:'#fff',
  fontWeight:700,
  cursor:'pointer'
};

const th = { padding:8 };
const thLeft = { ...th, textAlign:'left' };
const tdLeft = { padding:8 };
const tdCenter = { textAlign:'center', padding:8 };
const tdCell = (extra:any) => ({ padding:6, textAlign:'center', fontWeight:700, ...extra });

function fmtDate(s: string) {
  const [y,m,d] = s.split('-');
  return `${d}/${m}`;
}

function getColor(st?: string|null) {
  if (st==='P') return { background:'#22c55e' };
  if (st==='A') return { background:'#ef4444', color:'#fff' };
  if (st==='T') return { background:'#fde047' };
  if (st==='J') return { background:'#67e8f9' };
  return {};
}
