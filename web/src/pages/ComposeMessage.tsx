import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, type RosterItem, type CommCategory, type Me } from '../lib/api';

const categories: { value: CommCategory; label: string }[] = [
  { value: 'TASK',      label: 'Tarea' },
  { value: 'BEHAVIOR',  label: 'Conducta' },
  { value: 'ADMIN',     label: 'Administrativa' },
  { value: 'INFO',      label: 'Información' },
];

export default function ComposeMessage() {
  // admite /teacher/message/:courseId/:studentId?  y /course/:id/communications
  const p = useParams<{ courseId?: string; studentId?: string; id?: string }>();
  const courseId = p.courseId || p.id!;
  const presetStudentId = p.studentId || '';
  const nav = useNavigate();

  const [me, setMe] = useState<Me['user']|null>(null);
  const [roster, setRoster] = useState<RosterItem[]>([]);
  const [studentId, setStudentId] = useState<string>(presetStudentId);
  const [category, setCategory] = useState<CommCategory>('TASK');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<string|null>(null);

  useEffect(() => {
    (async () => {
      const u = await api.me(); setMe(u.user);
      const r = await api.courses.roster(courseId);
      setRoster(r.roster);
    })();
  }, [courseId]);

  async function send() {
    setSending(true); setMsg(null);
    try {
      const payload = { courseId, category, title, body, ...(studentId ? { studentId } : {}) };
      await api.communications.send(payload);
      setMsg('Enviado.');
      setTitle(''); setBody('');
      setTimeout(()=>setMsg(null), 1500);
    } finally { setSending(false); }
  }

  return (
    <div style={{ padding:16, maxWidth:800 }}>
      <h1>Cuaderno de comunicaciones</h1>

      <div style={{ display:'grid', gap:10 }}>
        <div>
          <label>Destinatario: </label>
          <select value={studentId} onChange={e=>setStudentId(e.target.value)} style={{ minWidth:240 }}>
            <option value="">Todo el curso</option>
            {roster.map(r => <option key={r.student._id} value={r.student._id}>{r.student.name}</option>)}
          </select>
        </div>

        <div>
          <label>Categoría: </label>
          <select value={category} onChange={e=>setCategory(e.target.value as CommCategory)}>
            {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>

        <input placeholder="Asunto" value={title} onChange={e=>setTitle(e.target.value)} />

        <textarea placeholder="Mensaje" rows={6} value={body} onChange={e=>setBody(e.target.value)} />

        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <button onClick={send} disabled={sending || !title || !body}>
            {sending ? 'Enviando…' : 'Enviar'}
          </button>
          {msg && <span style={{ color:'#16a34a' }}>{msg}</span>}
        </div>
      </div>

      <div style={{ marginTop:14 }}>
        <button onClick={()=>nav(-1)}>Volver</button>
      </div>
    </div>
  );
}
