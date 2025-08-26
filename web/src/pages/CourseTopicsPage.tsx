import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, type TopicEntry, type Me } from '../lib/api';
import CourseScheduleBadge from '../components/CourseScheduleBadge';

function todayStr() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export default function CourseTopicsPage() {
  const { id } = useParams<{ id: string }>();
  const [me, setMe] = useState<Me['user'] | null>(null);
  const [rows, setRows] = useState<TopicEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  // form
  const [date, setDate] = useState(todayStr());
  const [topic1, setTopic1] = useState('');
  const [topic2, setTopic2] = useState('');
  const [book, setBook] = useState('');
  const [notes, setNotes] = useState('');

  async function load() {
    if (!id) return;
    setLoading(true);
    try {
      const u = await api.me(); setMe(u.user);
      const g = await api.topics.grid(id);
      setRows(g.rows);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [id]);

  async function save() {
    if (!id) return;
    await api.topics.upsert({ courseId: id, date, topic1, topic2, book, notes });
    setTopic1(''); setTopic2(''); setBook(''); setNotes('');
    setMsg('Guardado'); setTimeout(()=>setMsg(null), 1200);
    await load();
  }

  if (loading) return <div style={{ padding: 16 }}>Cargando…</div>;
  if (!me || (me.role !== 'teacher' && me.role !== 'coordinator' && me.role !== 'admin'))
    return <div style={{ padding: 16 }}>No autorizado.</div>;

  return (
    <div style={{ padding: 16, maxWidth: 980 }}>
      <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap', marginBottom:8 }}>
        <h1 style={{ margin:0 }}>Libro de temas</h1>
        {id && <CourseScheduleBadge courseId={id} />}
        {msg && <span style={{ color:'#16a34a' }}>{msg}</span>}
      </div>

      {/* Form */}
      <div style={{ display:'grid', gridTemplateColumns:'160px 1fr 1fr 200px', gap:8, alignItems:'center', marginBottom:12 }}>
        <div>
          <label>Fecha<br/>
            <input type="date" value={date} onChange={e=>setDate(e.target.value)} />
          </label>
        </div>
        <div>
          <label>Tema 1<br/>
            <input value={topic1} onChange={e=>setTopic1(e.target.value)} placeholder="Contenido principal" style={{ width:'100%' }} />
          </label>
        </div>
        <div>
          <label>Tema 2<br/>
            <input value={topic2} onChange={e=>setTopic2(e.target.value)} placeholder="Contenido secundario" style={{ width:'100%' }} />
          </label>
        </div>
        <div>
          <label>Libro / Recursos<br/>
            <input value={book} onChange={e=>setBook(e.target.value)} placeholder="Libro, páginas, audio, etc." style={{ width:'100%' }} />
          </label>
        </div>
        <div style={{ gridColumn:'1 / span 3' }}>
          <label>Notas<br/>
            <input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Observaciones" style={{ width:'100%' }} />
          </label>
        </div>
        <div>
          <button onClick={save}>Guardar</button>
        </div>
      </div>

      {/* Tabla */}
      <table style={{ borderCollapse:'collapse', width:'100%' }}>
        <thead>
          <tr>
            <th style={th}>Fecha</th>
            <th style={th}>Tema 1</th>
            <th style={th}>Tema 2</th>
            <th style={th}>Libro</th>
            <th style={th}>Notas</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={5} style={td}>Sin registros aún.</td></tr>
          ) : rows.map(r => (
            <tr key={r._id}>
              <td style={td}>{fmt(r.date)}</td>
              <td style={td}>{r.topic1 || '—'}</td>
              <td style={td}>{r.topic2 || '—'}</td>
              <td style={td}>{r.book || '—'}</td>
              <td style={td}>{r.notes || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function fmt(s: string) {
  const [y,m,d] = s.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
}
const th: React.CSSProperties = { borderBottom:'1px solid #e2e8f0', textAlign:'left', padding:6, background:'#f8fafc' };
const td: React.CSSProperties = { borderBottom:'1px solid #f1f5f9', textAlign:'left', padding:6 };
