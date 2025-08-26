import { useEffect, useState } from 'react';
import { api } from '../lib/api';

type Q = { _id:string; prompt:string; type:'MC'|'GAP'; options?: string[]|null };

export default function StudentPractice() {
  const [qs, setQs] = useState<Q[]>([]);
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState('');
  const [score, setScore] = useState({ ok: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string|null>(null);
  const q = qs[idx];

  useEffect(() => {
    (async () => {
      try {
        const r = await api.practice.play();
        setQs(r.questions);
        setIdx(0);
        setScore({ ok: 0, total: 0 });
      } catch (e:any) {
        setErr(e.message);
      } finally { setLoading(false); }
    })();
  }, []);

  async function submit(a: string) {
    if (!q) return;
    const res = await api.practice.submit(q._id, a);
    setScore(s => ({ ok: s.ok + (res.correct ? 1 : 0), total: s.total + 1 }));
    setAnswer('');
    if (idx + 1 < qs.length) setIdx(idx + 1);
  }

  if (loading) return <div style={{ padding:16 }}>Cargando…</div>;
  if (err) return <div style={{ padding:16, color:'red' }}>{err}</div>;
  if (!q) return <div style={{ padding:16 }}>¡No hay preguntas disponibles!</div>;

  return (
    <div style={{ padding:16, maxWidth:800 }}>
      <h1>Práctica constante</h1>
      <div style={{ marginBottom:8 }}>Pregunta {idx+1} de {qs.length} — Puntaje: {score.ok}/{score.total}</div>
      <div style={{ border:'1px solid #e5e7eb', borderRadius:12, padding:12, background:'#fff' }}>
        <div style={{ fontWeight:700, marginBottom:10 }}>{q.prompt}</div>
        {q.type==='MC' ? (
          <div style={{ display:'grid', gap:8 }}>
            {(q.options || []).map(opt => (
              <button key={opt} onClick={()=>submit(opt)}>{opt}</button>
            ))}
          </div>
        ) : (
          <div style={{ display:'flex', gap:8 }}>
            <input placeholder="Tu respuesta" value={answer} onChange={e=>setAnswer(e.target.value)} />
            <button onClick={()=>submit(answer)} disabled={!answer.trim()}>Responder</button>
          </div>
        )}
      </div>
    </div>
  );
}
