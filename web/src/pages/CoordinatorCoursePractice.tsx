import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';

type SetRow = { _id:string; title:string; units?:number };

type Row = {
  student: { _id:string; name:string; email:string };
  enabled: boolean;
  // progreso (opc)
  attempts?: number;
  correct?: number;
  distinct?: number;
  percent?: number;
  lastAt?: string | null;
  completed?: boolean;
};

export default function CoordinatorCoursePractice() {
  const { id } = useParams<{ id:string }>();

  const [sets, setSets] = useState<SetRow[]>([]);
  const [setId, setSetId] = useState<string>('');
  const [goal, setGoal] = useState<number>(10); // meta de preguntas únicas

  const [rows, setRows] = useState<Row[]>([]);
  const [msg, setMsg] = useState<string|null>(null);
  const [loading, setLoading] = useState(true);

  // ===== modal "Asignar sets" =====
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignFor, setAssignFor] = useState<{_id:string; name:string} | null>(null);
  const [assignMap, setAssignMap] = useState<Record<string, boolean>>({});
  const [assignLoading, setAssignLoading] = useState(false);

  // carga sets + selecciona el primero
  useEffect(() => {
    (async () => {
      const r = await api.practice.listSets();
      setSets(r.rows || []);
      if (!setId && r.rows?.[0]) setSetId(r.rows[0]._id);
    })();
  }, []);

  async function load() {
    if (!id || !setId) return;
    setLoading(true);
    try {
      const [acc, prog] = await Promise.all([
        api.practice.accessByCourseForSet(id, setId),
        api.practice.progressByCourseSet(id, setId, goal).catch(()=>({ rows: [] as any[] }))
      ]);

      // merge acceso + progreso
      const progById = new Map(
        (prog.rows || []).map((p:any) => [String(p.student._id), p])
      );
      const merged: Row[] = acc.rows.map(r => {
        const p = progById.get(r.student._id);
        return {
          ...r,
          attempts: p?.attempts || 0,
          correct: p?.correct || 0,
          distinct: p?.distinct || 0,
          percent: p?.percent || 0,
          lastAt: p?.lastAt || null,
          completed: !!p?.completed,
        };
      });
      setRows(merged);
    } finally {
      setLoading(false);
    }
  }

  useEffect(()=>{ load(); /* eslint-disable-next-line */ }, [id, setId, goal]);

  async function setAccess(studentId: string, enabled: boolean) {
    await api.practice.setAccessForSet(studentId, setId, enabled, id);
    setRows(prev => prev.map(x => x.student._id===studentId ? { ...x, enabled } : x));
    setMsg('Guardado'); setTimeout(()=>setMsg(null), 1200);
  }

  async function seed() {
    await api.practice.seed();
    setMsg('Preguntas base creadas (si no existían).'); setTimeout(()=>setMsg(null), 1500);
  }

  const currentSet = useMemo(()=> sets.find(s=>s._id===setId) || null, [sets, setId]);

  // ===== helpers modal =====
  async function openAssign(student: { _id:string; name:string }) {
    if (!id) return;
    setAssignFor(student);
    setAssignOpen(true);
    setAssignLoading(true);
    try {
      // Carga estado set×alumno consultando set por set
      const pairs = await Promise.all(
        sets.map(async (s) => {
          const r = await api.practice.accessByCourseForSet(id, s._id);
          const me = r.rows.find(x => x.student._id === student._id);
          return [s._id, !!me?.enabled] as const;
        })
      );
      const map: Record<string, boolean> = {};
      pairs.forEach(([sid, en]) => { map[sid] = en; });
      setAssignMap(map);
    } finally {
      setAssignLoading(false);
    }
  }

  async function toggleAssign(setIdToggle: string, enabled: boolean) {
    if (!assignFor || !id) return;
    await api.practice.setAccessForSet(assignFor._id, setIdToggle, enabled, id);
    setAssignMap(m => ({ ...m, [setIdToggle]: enabled }));
    // Si el set que se está viendo en la tabla es el que se toggleó, reflejamos el cambio en la fila
    if (setIdToggle === setId) {
      setRows(prev => prev.map(r => r.student._id === assignFor._id ? { ...r, enabled } : r));
    }
  }

  async function closeAssign() {
    setAssignOpen(false);
    setAssignFor(null);
    setAssignMap({});
    await load(); // refresca progreso/habilitado del set seleccionado
  }

  if (!id) return null;
  if (loading) return <div style={{ padding:16 }}>Cargando…</div>;

  return (
    <div style={{ padding:16, maxWidth:1000 }}>
      <h1>Práctica constante — Habilitar alumnos</h1>

      <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:12, flexWrap:'wrap' }}>
        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
          <b>Set:</b>
          <select value={setId} onChange={e=>setSetId(e.target.value)}>
            {sets.map(s => <option key={s._id} value={s._id}>{s.title}{s.units?` — ${s.units}u`:''}</option>)}
          </select>
        </div>

        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
          <b>Meta (únicos):</b>
          <input type="number" min={1} style={{ width:76 }} value={goal}
                 onChange={e=>setGoal(e.target.value ? Number(e.target.value) : 10)} />
        </div>

        <button onClick={seed}>Seed de preguntas</button>
        <button onClick={load}>Refrescar</button>
        {msg && <span style={{ color:'#16a34a' }}>{msg}</span>}
      </div>

      {currentSet && (
        <div style={{ marginBottom:8, opacity:.8 }}>
          <small>Seleccionado: <b>{currentSet.title}</b></small>
        </div>
      )}

      <table style={{ width:'100%', borderCollapse:'collapse' }}>
        <thead>
          <tr>
            <th style={thLeft}>Alumno</th>
            <th style={th}>Email</th>
            <th style={th}>Habilitado</th>
            <th style={th}>Progreso</th>
            <th style={th}>Última vez</th>
            <th style={th}>Sets</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.student._id}>
              <td style={tdLeft}>{r.student.name}</td>
              <td style={td}>{r.student.email}</td>
              <td style={td}>
                <label style={{ display:'inline-flex', gap:6, alignItems:'center' }}>
                  <input
                    type="checkbox"
                    checked={r.enabled}
                    onChange={e=>setAccess(r.student._id, e.target.checked)}
                  />
                  {r.enabled ? 'Sí' : 'No'}
                </label>
              </td>
              <td style={td}>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <span>{r.distinct || 0} únicos · {r.percent || 0}%</span>
                  {r.completed && (
                    <span style={{ color:'#16a34a', fontWeight:600 }}>✓ Completado</span>
                  )}
                </div>
              </td>
              <td style={td}>{r.lastAt ? new Date(r.lastAt).toLocaleString() : '-'}</td>
              <td style={td}>
                <button onClick={()=>openAssign(r.student)}>Asignar sets</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ===== Modal Asignar sets ===== */}
      {assignOpen && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,.35)',
          display:'grid', placeItems:'center', zIndex:50
        }}>
          <div style={{ background:'#fff', borderRadius:12, padding:16, width:420, maxWidth:'90%' }}>
            <div style={{ fontWeight:700, marginBottom:8 }}>
              Asignar sets — {assignFor?.name}
            </div>

            {assignLoading ? (
              <div>Cargando sets…</div>
            ) : (
              <div style={{ display:'grid', gap:8, maxHeight:360, overflow:'auto' }}>
                {sets.map(s => (
                  <label key={s._id} style={{
                    display:'flex', justifyContent:'space-between', alignItems:'center',
                    padding:'8px 10px', border:'1px solid #e5e7eb', borderRadius:10
                  }}>
                    <span>{s.title}{s.units ? ` — ${s.units}u` : ''}</span>
                    <input
                      type="checkbox"
                      checked={!!assignMap[s._id]}
                      onChange={e=>toggleAssign(s._id, e.target.checked)}
                    />
                  </label>
                ))}
              </div>
            )}

            <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:12 }}>
              <button onClick={closeAssign}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const border='1px solid #e5e7eb';
const th: React.CSSProperties={ border, padding:6, background:'#f8fafc' };
const thLeft: React.CSSProperties={ ...th, textAlign:'left' };
const td: React.CSSProperties={ border, padding:6 };
const tdLeft: React.CSSProperties={ ...td, textAlign:'left' };
