import { useEffect, useState } from 'react';
import { api, type FinalCondition, type TermGrades } from '../lib/api';
import { useParams, Link } from 'react-router-dom';

type Row = {
  student: { _id:string; name:string; email:string };
  t1: TermGrades; t2: TermGrades; t3: TermGrades;
  examOral: number|null; examWritten: number|null; finalOral: number|null; finalWritten: number|null;
  condition: FinalCondition; comments: string;
  dirty: boolean; status: 'idle'|'saving'|'saved'|'error'; errorMsg?: string;
};

const CONDITIONS: FinalCondition[] = ['APPROVED','FAILED_ORAL','FAILED_WRITTEN','FAILED_BOTH','PASSED_INTERNAL','REPEATER'];

function Num10({ v, on }: { v:number|null; on:(n:number|null)=>void }) {
  return <input type="number" min={1} max={10} value={v ?? ''} placeholder="—" style={{ width:46 }}
    onChange={e=>{ const s=e.target.value; if(s==='') return on(null); const n=Math.max(1,Math.min(10,Number(s))); on(Number.isNaN(n)?null:n); }} />;
}
function Num100({ v, on }: { v:number|null; on:(n:number|null)=>void }) {
  return <input type="number" min={0} max={100} value={v ?? ''} placeholder="—" style={{ width:64 }}
    onChange={e=>{ const s=e.target.value; if(s==='') return on(null); const n=Math.max(0,Math.min(100,Number(s))); on(Number.isNaN(n)?null:n); }} />;
}

export default function TeacherCourseReport() {
  const { id } = useParams<{ id:string }>();
  const [meta, setMeta] = useState<{name:string;year:number}|null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState<string|null>(null);

  async function load() {
    if (!id) return;
    setErr(null);
    const r = await api.reportcards.listCourse(id);
    setMeta({ name: r.course.name, year: r.course.year });
    setRows(r.rows.map(row => ({
      student: row.student,
      t1: row.card?.t1 ?? { writing:null, speaking:null, reading:null, listening:null, comments:'' },
      t2: row.card?.t2 ?? { writing:null, speaking:null, reading:null, listening:null, comments:'' },
      t3: row.card?.t3 ?? { writing:null, speaking:null, reading:null, listening:null, comments:'' },
      examOral: row.card?.examOral ?? null,
      examWritten: row.card?.examWritten ?? null,
      finalOral: row.card?.finalOral ?? null,
      finalWritten: row.card?.finalWritten ?? null,
      condition: row.card?.condition ?? 'APPROVED',
      comments: row.card?.comments ?? '',
      dirty: false, status: 'idle'
    })));
  }
  useEffect(()=>{ load(); /* eslint-disable-line */ },[id]);

  function upd(idx:number, mut:(r:Row)=>Row){ setRows(p=>p.map((r,i)=>i===idx?mut(r):r)); }

  if (!id) return <div style={{ padding:16 }}>Curso inválido</div>;

  return (
    <div style={{ padding: 16 }}>
      <h1>Boletín (3 trimestres)</h1>
      <div style={{ marginBottom: 12 }}><b>Curso:</b> {meta?.name} ({meta?.year})</div>

      {/* ⬇️ Wrapper con scroll horizontal (y vertical opcional) */}
      <div style={{ maxWidth:'100%', overflowX:'auto', maxHeight:'70vh', overflowY:'auto', WebkitOverflowScrolling:'touch' }}>
        <table style={{ borderCollapse:'collapse', minWidth: 1400 }}>
          <thead>
            <tr>
              <th style={{ borderBottom:'1px solid #ddd', padding:6, textAlign:'left' }}>Alumno</th>
              <th colSpan={4} style={{ borderBottom:'1px solid #ddd', textAlign:'center' }}>1° Trim</th>
              <th colSpan={4} style={{ borderBottom:'1px solid #ddd', textAlign:'center' }}>2° Trim</th>
              <th colSpan={4} style={{ borderBottom:'1px solid #ddd', textAlign:'center' }}>3° Trim</th>
              <th colSpan={4} style={{ borderBottom:'1px solid #ddd', textAlign:'center' }}>Exámenes / Finales</th>
              <th style={{ borderBottom:'1px solid #ddd' }}>Condición</th>
              <th style={{ borderBottom:'1px solid #ddd', width:260, textAlign:'left' }}>Comentarios</th>
              <th style={{ borderBottom:'1px solid #ddd' }}>Acción</th>
            </tr>
            <tr>
              <th></th>
              {Array.from({length:12},(_,i)=>['W','S','R','L'][i%4]).map((h,i)=>(<th key={i} style={{ borderBottom:'1px solid #ddd' }}>{h}</th>))}
              <th>Ex.Oral</th><th>Ex.Escr.</th><th>Final Oral</th><th>Final Escr.</th>
              <th></th><th></th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={r.student._id}>
                <td style={{ borderBottom:'1px solid #eee', padding:6 }}>{r.student.name}</td>

                {/* T1 */}
                <td><Num10 v={r.t1.writing}   on={(v)=>upd(idx,cur=>({...cur,t1:{...cur.t1,writing:v}, dirty:true, status:cur.status==='saved'?'idle':cur.status}))}/></td>
                <td><Num10 v={r.t1.speaking}  on={(v)=>upd(idx,cur=>({...cur,t1:{...cur.t1,speaking:v},dirty:true, status:cur.status==='saved'?'idle':cur.status}))}/></td>
                <td><Num10 v={r.t1.reading}   on={(v)=>upd(idx,cur=>({...cur,t1:{...cur.t1,reading:v}, dirty:true, status:cur.status==='saved'?'idle':cur.status}))}/></td>
                <td><Num10 v={r.t1.listening} on={(v)=>upd(idx,cur=>({...cur,t1:{...cur.t1,listening:v},dirty:true, status:cur.status==='saved'?'idle':cur.status}))}/></td>

                {/* T2 */}
                <td><Num10 v={r.t2.writing}   on={(v)=>upd(idx,cur=>({...cur,t2:{...cur.t2,writing:v}, dirty:true, status:cur.status==='saved'?'idle':cur.status}))}/></td>
                <td><Num10 v={r.t2.speaking}  on={(v)=>upd(idx,cur=>({...cur,t2:{...cur.t2,speaking:v},dirty:true, status:cur.status==='saved'?'idle':cur.status}))}/></td>
                <td><Num10 v={r.t2.reading}   on={(v)=>upd(idx,cur=>({...cur,t2:{...cur.t2,reading:v}, dirty:true, status:cur.status==='saved'?'idle':cur.status}))}/></td>
                <td><Num10 v={r.t2.listening} on={(v)=>upd(idx,cur=>({...cur,t2:{...cur.t2,listening:v},dirty:true, status:cur.status==='saved'?'idle':cur.status}))}/></td>

                {/* T3 */}
                <td><Num10 v={r.t3.writing}   on={(v)=>upd(idx,cur=>({...cur,t3:{...cur.t3,writing:v}, dirty:true, status:cur.status==='saved'?'idle':cur.status}))}/></td>
                <td><Num10 v={r.t3.speaking}  on={(v)=>upd(idx,cur=>({...cur,t3:{...cur.t3,speaking:v},dirty:true, status:cur.status==='saved'?'idle':cur.status}))}/></td>
                <td><Num10 v={r.t3.reading}   on={(v)=>upd(idx,cur=>({...cur,t3:{...cur.t3,reading:v}, dirty:true, status:cur.status==='saved'?'idle':cur.status}))}/></td>
                <td><Num10 v={r.t3.listening} on={(v)=>upd(idx,cur=>({...cur,t3:{...cur.t3,listening:v},dirty:true, status:cur.status==='saved'?'idle':cur.status}))}/></td>

                {/* Exámenes / finales */}
                <td><Num100 v={r.examOral}     on={(v)=>upd(idx,cur=>({...cur,examOral:v,    dirty:true, status:cur.status==='saved'?'idle':cur.status}))}/></td>
                <td><Num100 v={r.examWritten}  on={(v)=>upd(idx,cur=>({...cur,examWritten:v, dirty:true, status:cur.status==='saved'?'idle':cur.status}))}/></td>
                <td><Num100 v={r.finalOral}    on={(v)=>upd(idx,cur=>({...cur,finalOral:v,   dirty:true, status:cur.status==='saved'?'idle':cur.status}))}/></td>
                <td><Num100 v={r.finalWritten} on={(v)=>upd(idx,cur=>({...cur,finalWritten:v,dirty:true, status:cur.status==='saved'?'idle':cur.status}))}/></td>

                {/* Condición + Comentarios */}
                <td>
                  <select value={r.condition} onChange={e=>upd(idx,cur=>({...cur,condition:e.target.value as FinalCondition, dirty:true, status:cur.status==='saved'?'idle':cur.status}))}>
                    {CONDITIONS.map(c => <option key={c} value={c}>{({
                      APPROVED:'Aprobado', FAILED_ORAL:'Desap. (oral)', FAILED_WRITTEN:'Desap. (escrito)', FAILED_BOTH:'Desap. (ambos)', PASSED_INTERNAL:'Pasó con examen interno', REPEATER:'Repitente'
                    } as any)[c]}</option>)}
                  </select>
                </td>
                <td><textarea rows={2} style={{ width:'100%', resize:'vertical' }} value={r.comments} onChange={e=>upd(idx,cur=>({...cur,comments:e.target.value, dirty:true, status:cur.status==='saved'?'idle':cur.status}))}/></td>

                <td style={{ whiteSpace:'nowrap' }}>
                  <button disabled={r.status==='saving'||!r.dirty} onClick={async()=>{
                    upd(idx,cur=>({...cur,status:'saving',errorMsg:undefined}));
                    try{
                      await api.reportcards.upsert({
                        courseId:id!, studentId:r.student._id,
                        t1:r.t1, t2:r.t2, t3:r.t3,
                        examOral:r.examOral, examWritten:r.examWritten, finalOral:r.finalOral, finalWritten:r.finalWritten,
                        condition:r.condition, comments:r.comments
                      });
                      upd(idx,cur=>({...cur,status:'saved',dirty:false}));
                      setTimeout(()=>upd(idx,cur=>cur.status==='saved'?{...cur,status:'idle'}:cur),2000);
                    }catch(e:any){ upd(idx,cur=>({...cur,status:'error',errorMsg:e.message})); }
                  }}>{r.status==='saving'?'Guardando…':(r.dirty?'Guardar':'Guardado')}</button>
                  {' '}· <Link to={`/print/final/${id}/${r.student._id}`}>Imprimir</Link>
                  {r.status==='saved' && <span style={{ marginLeft:8, color:'#16a34a' }}>✔️</span>}
                  {r.status==='error' && <span style={{ marginLeft:8, color:'#dc2626' }}>Error: {r.errorMsg}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {err && <div style={{ color:'red', marginTop:8 }}>{err}</div>}
    </div>
  );
}

