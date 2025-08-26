import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';

export default function CoordinatorCoursePractice() {
  const { id } = useParams<{ id:string }>();
  const [rows, setRows] = useState<{ student:{_id:string; name:string; email:string}, enabled:boolean }[]>([]);
  const [msg, setMsg] = useState<string|null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!id) return;
    const r = await api.practice.accessByCourse(id);
    setRows(r.rows);
    setLoading(false);
  }
  useEffect(()=>{ load(); }, [id]);

  async function setAccess(studentId: string, enabled: boolean) {
    await api.practice.setAccess(studentId, enabled);
    setRows(prev => prev.map(x => x.student._id===studentId ? { ...x, enabled } : x));
    setMsg('Guardado'); setTimeout(()=>setMsg(null), 1200);
  }

  async function seed() {
    await api.practice.seed();
    setMsg('Preguntas base creadas (si no existían).'); setTimeout(()=>setMsg(null), 1500);
  }

  if (loading) return <div style={{ padding:16 }}>Cargando…</div>;

  return (
    <div style={{ padding:16, maxWidth:900 }}>
      <h1>Práctica constante — Habilitar alumnos</h1>
      <div style={{ display:'flex', gap:8, marginBottom:8 }}>
        <button onClick={seed}>Seed de preguntas</button>
        {msg && <span style={{ color:'#16a34a' }}>{msg}</span>}
      </div>
      <table style={{ width:'100%', borderCollapse:'collapse' }}>
        <thead>
          <tr>
            <th style={thLeft}>Alumno</th>
            <th style={th}>Email</th>
            <th style={th}>Habilitado</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.student._id}>
              <td style={tdLeft}>{r.student.name}</td>
              <td style={td}>{r.student.email}</td>
              <td style={td}>
                <label style={{ display:'inline-flex', gap:6, alignItems:'center' }}>
                  <input type="checkbox" checked={r.enabled} onChange={e=>setAccess(r.student._id, e.target.checked)} />
                  {r.enabled ? 'Sí' : 'No'}
                </label>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
const border='1px solid #e5e7eb';
const th: React.CSSProperties={ border, padding:6, background:'#f8fafc' };
const thLeft: React.CSSProperties={ ...th, textAlign:'left' };
const td: React.CSSProperties={ border, padding:6 };
const tdLeft: React.CSSProperties={ ...td, textAlign:'left' };
