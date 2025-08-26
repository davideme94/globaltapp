import { useEffect, useState } from 'react';
import { api, type FinalCondition } from '../lib/api';
import { useParams, Link } from 'react-router-dom';

type Row = {
  student: { _id:string; name:string; email:string };
  card: {
    examOral: number|null;
    examWritten: number|null;
    finalOral: number|null;
    finalWritten: number|null;
    condition: FinalCondition;
    comments: string;
  };
  dirty: boolean;
  status: 'idle'|'saving'|'saved'|'error';
  errorMsg?: string;
};

const CONDITIONS: FinalCondition[] = ['APPROVED','FAILED_ORAL','FAILED_WRITTEN','FAILED_BOTH','PASSED_INTERNAL','REPEATER'];

function numInput(v: number|null, onChange: (n: number|null)=>void) {
  return (
    <input type="number" min={0} max={100} value={v ?? ''} onChange={(e)=> {
      const val = e.target.value === '' ? null : Math.max(0, Math.min(100, Number(e.target.value)));
      onChange(Number.isNaN(val as any) ? null : val);
    }} style={{ width: 72 }} placeholder="—" />
  );
}

export default function TeacherCourseFinals() {
  const { id } = useParams<{ id: string }>();
  const [meta, setMeta] = useState<{ name:string; year:number } | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState<string|null>(null);

  async function load() {
    if (!id) return;
    setErr(null);
    const r = await api.reportcards.listCourse(id);
    setMeta({ name: r.course.name, year: r.course.year });
    setRows(r.rows.map(row => ({
      student: row.student,
      card: row.card ? {
        examOral: row.card.examOral ?? null,
        examWritten: row.card.examWritten ?? null,
        finalOral: row.card.finalOral ?? null,
        finalWritten: row.card.finalWritten ?? null,
        condition: row.card.condition,
        comments: row.card.comments || ''
      } : {
        examOral: null, examWritten: null, finalOral: null, finalWritten: null, condition: 'APPROVED', comments: ''
      },
      dirty: false,
      status: 'idle'
    })));
  }

  useEffect(() => { load(); /* eslint-disable-line */ }, [id]);

  function updateRow(idx: number, mut: (r: Row) => Row) {
    setRows(prev => prev.map((r, i) => (i === idx ? mut(r) : r)));
  }

  if (!id) return <div style={{ padding:16 }}>Curso inválido</div>;

  return (
    <div style={{ padding: 16 }}>
      <h1>Boletín final</h1>
      <div style={{ marginBottom: 12 }}><b>Curso:</b> {meta?.name} ({meta?.year})</div>

      <table style={{ borderCollapse:'collapse', minWidth: 1080 }}>
        <thead>
          <tr>
            <th style={{ borderBottom:'1px solid #ddd', textAlign:'left', padding:6 }}>Alumno</th>
            <th style={{ borderBottom:'1px solid #ddd', textAlign:'left', padding:6 }}>Examen Oral</th>
            <th style={{ borderBottom:'1px solid #ddd', textAlign:'left', padding:6 }}>Examen Escrito</th>
            <th style={{ borderBottom:'1px solid #ddd', textAlign:'left', padding:6 }}>Final Oral</th>
            <th style={{ borderBottom:'1px solid #ddd', textAlign:'left', padding:6 }}>Final Escrito</th>
            <th style={{ borderBottom:'1px solid #ddd', textAlign:'left', padding:6 }}>Condición</th>
            <th style={{ borderBottom:'1px solid #ddd', textAlign:'left', padding:6, width:280 }}>Comentarios</th>
            <th style={{ borderBottom:'1px solid #ddd', textAlign:'left', padding:6 }}>Acción</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={r.student._id}>
              <td style={{ borderBottom:'1px solid #eee', padding:6 }}>{r.student.name}</td>
              <td style={{ borderBottom:'1px solid #eee', padding:6 }}>{numInput(r.card.examOral, val => updateRow(idx, cur => ({ ...cur, card: { ...cur.card, examOral: val }, dirty: true, status: cur.status==='saved'?'idle':cur.status })))}</td>
              <td style={{ borderBottom:'1px solid #eee', padding:6 }}>{numInput(r.card.examWritten, val => updateRow(idx, cur => ({ ...cur, card: { ...cur.card, examWritten: val }, dirty: true, status: cur.status==='saved'?'idle':cur.status })))}</td>
              <td style={{ borderBottom:'1px solid #eee', padding:6 }}>{numInput(r.card.finalOral, val => updateRow(idx, cur => ({ ...cur, card: { ...cur.card, finalOral: val }, dirty: true, status: cur.status==='saved'?'idle':cur.status })))}</td>
              <td style={{ borderBottom:'1px solid #eee', padding:6 }}>{numInput(r.card.finalWritten, val => updateRow(idx, cur => ({ ...cur, card: { ...cur.card, finalWritten: val }, dirty: true, status: cur.status==='saved'?'idle':cur.status })))}</td>
              <td style={{ borderBottom:'1px solid #eee', padding:6 }}>
                <select value={r.card.condition} onChange={e=>updateRow(idx, cur=>({ ...cur, card: { ...cur.card, condition: e.target.value as FinalCondition }, dirty:true, status: cur.status==='saved'?'idle':cur.status }))}>
                  {CONDITIONS.map(c => <option key={c} value={c}>{({
                    APPROVED: 'Aprobado',
                    FAILED_ORAL: 'Desaprobado (oral)',
                    FAILED_WRITTEN: 'Desaprobado (escrito)',
                    FAILED_BOTH: 'Desaprobado (ambos)',
                    PASSED_INTERNAL: 'Pasó con examen interno',
                    REPEATER: 'Repitente'
                  } as any)[c]}</option>)}
                </select>
              </td>
              <td style={{ borderBottom:'1px solid #eee', padding:6 }}>
                <textarea value={r.card.comments} onChange={e=>updateRow(idx, cur=>({ ...cur, card: { ...cur.card, comments: e.target.value }, dirty:true, status: cur.status==='saved'?'idle':cur.status }))} rows={2} style={{ width: '100%', resize: 'vertical' }}/>
              </td>
              <td style={{ borderBottom:'1px solid #eee', padding:6, whiteSpace:'nowrap' }}>
                <button
                  disabled={r.status==='saving' || !r.dirty}
                  onClick={async ()=>{
                    updateRow(idx, cur=>({ ...cur, status:'saving', errorMsg: undefined }));
                    try{
                      await api.reportcards.upsert({
                        courseId: id!,
                        studentId: r.student._id,
                        examOral: r.card.examOral,
                        examWritten: r.card.examWritten,
                        finalOral: r.card.finalOral,
                        finalWritten: r.card.finalWritten,
                        condition: r.card.condition,
                        comments: r.card.comments
                      });
                      updateRow(idx, cur=>({ ...cur, status:'saved', dirty:false }));
                      setTimeout(()=> updateRow(idx, cur=> cur.status==='saved' ? ({ ...cur, status:'idle' }) : cur), 2000);
                    }catch(e:any){
                      updateRow(idx, cur=>({ ...cur, status:'error', errorMsg: e.message }));
                    }
                  }}
                >
                  {r.status==='saving' ? 'Guardando…' : (r.dirty ? 'Guardar' : 'Guardado')}
                </button>
                {' '}· <Link to={`/print/final/${id}/${r.student._id}`}>Imprimir</Link>
                {r.status==='saved' && <span style={{ marginLeft:8, color:'#16a34a' }}>✔️</span>}
                {r.status==='error' && <span style={{ marginLeft:8, color:'#dc2626' }}>Error: {r.errorMsg}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {err && <div style={{ color:'red', marginTop: 8 }}>{err}</div>}
    </div>
  );
}
