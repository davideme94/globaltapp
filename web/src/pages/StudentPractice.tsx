// web/src/pages/StudentPractice.tsx
import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import '../styles/student-practice.css';


type Q = {
  _id:string;
  prompt:string;
  type:'MC'|'GAP';
  options?: string[]|null;
  imageUrl?: string|null;
  embedUrl?: string|null;
  unit?: number|null;
};
type Progress = { total:number; seen:number; remaining:number };

export default function StudentPractice() {
  // --- NUEVO: sets habilitados (si el backend los expone)
  const [mySets, setMySets] = useState<{ set:{ _id:string; title:string; units?:number }, updatedAt:string }[]>([]);
  const [setId, setSetId] = useState<string>('');
  const [unit, setUnit] = useState<number|''>('');
  const [mode, setMode] = useState<'sets'|'legacy'>('legacy'); // si hay sets -> 'sets'

  // --- juego
  const [qs, setQs] = useState<Q[]>([]);
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState('');
  const [score, setScore] = useState({ ok: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string|null>(null);
  const [completed, setCompleted] = useState(false);
  const [progress, setProgress] = useState<Progress|null>(null);
  const q = qs[idx];

  // estilos simples
  const card: React.CSSProperties = { border:'1px solid #e5e7eb', borderRadius:16, padding:16, background:'#fff', boxShadow:'0 4px 18px rgba(0,0,0,.06)' };
  const btn = (primary=false): React.CSSProperties => ({
    border:'1px solid', borderColor: primary ? '#6d28d9' : '#e5e7eb',
    background: primary ? 'linear-gradient(135deg,#7c3aed,#9333ea)' : '#fff',
    color: primary ? '#fff' : '#111827',
    padding:'10px 12px', borderRadius:12, cursor:'pointer', fontWeight:600
  });

  // monta: intenta modo sets; si no, legacy
  useEffect(() => {
    (async () => {
      try {
        const r = await api.practice.mySets().catch(() => ({ rows: [] as any[] }));
        const rows = r?.rows || [];
        if (rows.length > 0) {
          setMySets(rows);
          setSetId(rows[0].set._id);
          setMode('sets');
          setLoading(false);
          return;
        }
        // legacy
        const legacy = await api.practice.play();
        setQs(legacy.questions);
        setIdx(0);
        setScore({ ok: 0, total: 0 });
        setMode('legacy');
      } catch (e:any) {
        setErr(e.message);
      } finally { setLoading(false); }
    })();
  }, []);

  // carga un batch del set (no repite + trae progreso)
  async function loadBatch(currentSetId: string, currentUnit?: number) {
    setLoading(true); setErr(null);
    try {
      const r = await api.practice.playSet(currentSetId, currentUnit);
      setQs(r.questions || []);
      setIdx(0);
      setAnswer('');
      setProgress(r.progress || null);
      setCompleted(!!r.completed);
    } catch (e:any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function startWithSet() {
    if (!setId) return;
    setScore({ ok: 0, total: 0 });
    setCompleted(false);
    await loadBatch(setId, unit ? Number(unit) : undefined);
  }

  async function submit(a: string) {
    if (!q) return;
    const res = await api.practice.submit(q._id, a);
    setScore(s => ({ ok: s.ok + (res.correct ? 1 : 0), total: s.total + 1 }));
    setAnswer('');

    // próxima pregunta del batch
    if (idx + 1 < qs.length) {
      setIdx(idx + 1);
      return;
    }

    // fin del batch → pedimos más (o felicidades si no hay)
    if (mode === 'sets' && setId) {
      await loadBatch(setId, unit ? Number(unit) : undefined);
    } else {
      // legacy simplemente vuelve a pedir
      const legacy = await api.practice.play();
      setQs(legacy.questions);
      setIdx(0);
    }
  }

  const pct = useMemo(() => {
    if (!progress || progress.total === 0) return 0;
    return Math.round((progress.seen / progress.total) * 100);
  }, [progress]);

  if (loading) return <div style={{ padding:16 }}>Cargando…</div>;
  if (err) return <div style={{ padding:16, color:'red' }}>{err}</div>;

  return (
    <div style={{ padding:16, maxWidth:900, margin:'0 auto' }}>
      {/* header vistoso */}
      <div style={{
        borderRadius:20, padding:'14px 16px', marginBottom:12,
        background:'linear-gradient(135deg,#0ea5e9,#7c3aed)',
        color:'#fff', display:'flex', alignItems:'center', justifyContent:'space-between', gap:10
      }}>
        <div style={{ fontWeight:800, letterSpacing:.2, fontSize:18 }}>Práctica constante</div>
        <div style={{ opacity:.95 }}>
          <span style={{ fontWeight:700 }}>Puntaje:</span> {score.ok}/{score.total}
        </div>
      </div>

      {/* selector de set/unidad */}
      {mode === 'sets' && (
        <div className="controls" style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', margin:'8px 0 14px' }}>
          <select value={setId} onChange={e=>setSetId(e.target.value)} style={{ padding:'8px 10px', borderRadius:12, border:'1px solid #e5e7eb' }}>
            {mySets.map(r => (
              <option key={r.set._id} value={r.set._id}>{r.set.title}</option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            placeholder="Unidad (opcional)"
            value={unit}
            onChange={e=>setUnit(e.target.value ? Number(e.target.value) : '')}
            style={{ width:150, padding:'8px 10px', borderRadius:12, border:'1px solid #e5e7eb' }}
          />
          <button onClick={startWithSet} disabled={!setId} style={btn(true)}>Comenzar</button>

          {/* barra de progreso (solo modo sets) */}
          {progress && (
            <div style={{ flex:1, minWidth:220, display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ flex:1, background:'#e5e7eb', borderRadius:999, height:10, overflow:'hidden' }}>
                <div style={{ width:`${pct}%`, height:'100%', background:'linear-gradient(90deg,#22c55e,#16a34a)', borderRadius:999 }} />
              </div>
              <div style={{ minWidth:110, fontSize:12, color:'#111827' }}>
                <b>{progress.seen}</b> / {progress.total} únicos
              </div>
            </div>
          )}
        </div>
      )}

      {/* FELICIDADES */}
      {mode === 'sets' && completed && (
        <div style={card}>
          <div style={{ fontSize:28, marginBottom:8 }}>🎉 ¡Felicidades!</div>
          <div style={{ opacity:.8, marginBottom:14 }}>
            Completaste todas las preguntas de este set
            {unit ? <> (unidad <b>{unit}</b>)</> : null}.
          </div>
          {progress && (
            <div style={{ marginBottom:14 }}>
              <div style={{ background:'#f1f5f9', borderRadius:12, padding:10 }}>
                Viste <b>{progress.seen}</b> de <b>{progress.total}</b> preguntas únicas.
              </div>
            </div>
          )}
          <div style={{ display:'flex', gap:8 }}>
            <button style={btn()} onClick={() => { setCompleted(false); setQs([]); setProgress(null); }}>
              Elegir otro set
            </button>
            <button style={btn(true)} onClick={() => startWithSet()}>
              Repetir (nuevos intentos)
            </button>
          </div>
        </div>
      )}

      {/* LEGACY: info arriba */}
      {mode === 'legacy' && (
        <div style={{ marginBottom:8 }}>
          Pregunta {qs.length ? (idx+1) : 0} de {qs.length} — Puntaje: {score.ok}/{score.total}
        </div>
      )}

      {/* Si no hay preguntas aún en modo sets y no está completado */}
      {mode === 'sets' && qs.length === 0 && !completed ? (
        <div style={{ opacity:.8 }}>Elegí un set (y unidad, si querés) y presioná <b>“Comenzar”</b>.</div>
      ) : null}

      {/* Tarjeta de pregunta */}
      {qs.length > 0 && !completed && (
        <div style={card}>
          <div style={{ marginBottom:10, fontSize:12, opacity:.65 }}>
            Pregunta {idx+1} de {qs.length} {q?.unit ? `· Unidad ${q.unit}` : ''}
          </div>

          {q?.imageUrl && (
            <div style={{ marginBottom:12 }}>
              <img src={q.imageUrl} alt="" style={{ maxWidth:'100%', borderRadius:12 }} />
            </div>
          )}
          {q?.embedUrl && (
            <div style={{ marginBottom:12 }}>
              <iframe
                src={q.embedUrl}
                title="embed"
                style={{ width:'100%', height:360, border:'1px solid #e5e7eb', borderRadius:12 }}
                sandbox="allow-same-origin allow-scripts allow-popups"
              />
            </div>
          )}

          <div style={{ fontWeight:800, marginBottom:14, fontSize:18 }}>{q?.prompt}</div>

          {q?.type==='MC' ? (
            <div style={{ display:'grid', gap:10 }}>
              {(q.options || []).map(opt => (
                <button key={opt} onClick={()=>submit(opt)} style={btn()}>
                  {opt}
                </button>
              ))}
            </div>
          ) : (
            <div style={{ display:'flex', gap:8 }}>
              <input
                placeholder="Tu respuesta"
                value={answer}
                onChange={e=>setAnswer(e.target.value)}
                style={{ flex:1, padding:'10px 12px', borderRadius:12, border:'1px solid #e5e7eb' }}
              />
              <button onClick={()=>submit(answer)} disabled={!answer.trim()} style={btn(true)}>Responder</button>
            </div>
          )}
        </div>
      )}

      {/* Mensaje cuando no hay preguntas (legacy) */}
      {mode === 'legacy' && qs.length === 0 && (
        <div style={{ paddingTop:8 }}>¡No hay preguntas disponibles!</div>
      )}
    </div>
  );
}
