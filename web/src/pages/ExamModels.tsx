// web/src/pages/ExamModels.tsx
import { useEffect, useMemo, useState } from 'react';
import { api, getCourseExamModels, saveExamModel, seedExamModels, setExamGrade, type ExamModelRow, type Pass3 } from '../lib/api';
import { Link, useSearchParams } from 'react-router-dom';
import { ToggleLeft, ToggleRight, ExternalLink } from 'lucide-react';
import '../styles/student-practice.css';

type CourseOpt = { _id:string; name:string };

export default function ExamModels() {
  const [params, setParams] = useSearchParams();
  const courseId = params.get('course') || '';
  const [me, setMe] = useState<any>(null);
  const [courses, setCourses] = useState<CourseOpt[]>([]);
  const [rows, setRows] = useState<ExamModelRow[]>([]);
  const isStaff = me && ['teacher','coordinator','admin'].includes(me.role);

  useEffect(() => { api('/me').then(setMe); }, []);
  useEffect(() => {
    if (isStaff) api('/courses/mine?as=staff').then(setCourses);
    else api('/courses/mine').then(setCourses);
  }, [isStaff]);
  useEffect(() => { if (courseId) getCourseExamModels(courseId).then(setRows); }, [courseId]);

  const grouped = useMemo(() => ({
    mid: rows.filter(r=>r.category==='MID_YEAR').sort((a,b)=>a.number-b.number),
    end: rows.filter(r=>r.category==='END_YEAR').sort((a,b)=>a.number-b.number),
  }), [rows]);

  if (!courseId && courses.length) setParams({ course: courses[0]._id });

  return (
    <div className="container mx-auto p-4">
      <h1 className="title">Exámenes modelos</h1>

      {courses.length>0 && (
        <select
          value={courseId}
          onChange={e=>setParams({ course: e.target.value })}
          className="select"
        >
          {courses.map(c=><option key={c._id} value={c._id}>{c.name}</option>)}
        </select>
      )}

      {isStaff && rows.length===0 && (
        <button className="btn" onClick={()=>seedExamModels(courseId).then(()=>getCourseExamModels(courseId).then(setRows))}>
          Crear modelos por defecto (6)
        </button>
      )}

      <Section title="Exámenes modelos - Mitad de año">
        {grouped.mid.map(m => <ExamCard key={m._id} row={m} isStaff={isStaff} courseId={courseId} onChange={()=>getCourseExamModels(courseId).then(setRows)} />)}
      </Section>

      <Section title="Exámenes modelos - Fin de año">
        {grouped.end.map(m => <ExamCard key={m._id} row={m} isStaff={isStaff} courseId={courseId} onChange={()=>getCourseExamModels(courseId).then(setRows)} />)}
      </Section>
    </div>
  );
}

function Section({title, children}:{title:string; children:any}) {
  return (
    <div className="mt-6">
      <h2 className="subtitle">{title}</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{children}</div>
    </div>
  );
}

function ExamCard({ row, isStaff, courseId, onChange }:{
  row: ExamModelRow; isStaff:boolean; courseId:string; onChange:()=>void;
}) {
  const [studentId, setStudentId] = useState<string>('');
  const [students, setStudents] = useState<any[]>([]);

  useEffect(() => {
    if (isStaff) api(`/courses/${courseId}/students`).then(setStudents);
  }, [isStaff, courseId]);

  const title = `${row.category==='MID_YEAR'?'Mitad': 'Final'} - Modelo ${row.number}`;

  return (
    <div className="card">
      <div className="flex justify-between items-center">
        <h3 className="card-title">{title}</h3>
        <a href={row.driveUrl || '#'} target="_blank" className={`link ${row.driveUrl?'':'opacity-40 pointer-events-none'}`} rel="noreferrer">
          Ver en Drive <ExternalLink size={16}/>
        </a>
      </div>

      <p className="muted">Tipo: {row.gradeType==='PASS3' ? 'PASS/Barely/Failed' : '1–10'}</p>

      {!isStaff && row.myGrade && (
        <div className="badge">
          {row.gradeType==='PASS3'
            ? (row.myGrade.resultPass3 ?? 'Sin registro')
            : (row.myGrade.resultNumeric ?? 'Sin registro')}
        </div>
      )}

      {isStaff && (
        <>
          <div className="mt-2 flex gap-2">
            <input className="input flex-1" placeholder="Link de Google Drive"
              value={row.driveUrl || ''} onChange={e=>saveExamModel(row._id,{ driveUrl:e.target.value }).then(onChange)} />
            <button className="btn" onClick={()=>saveExamModel(row._id,{ visible: !row.visible }).then(onChange)}>
              {row.visible ? <ToggleRight/> : <ToggleLeft/>} {row.visible ? 'Visible' : 'Oculto'}
            </button>
          </div>

          <div className="mt-3">
            <select className="select" value={studentId} onChange={e=>setStudentId(e.target.value)}>
              <option value="">Seleccionar alumno…</option>
              {students.map(s=><option key={s._id} value={s._id}>{s.name}</option>)}
            </select>

            {row.gradeType === 'PASS3' ? (
              <div className="mt-2 flex gap-2">
                {(['PASS','BARELY_PASS','FAILED'] as Pass3[]).map(v => (
                  <button key={v} className="btn" onClick={()=>studentId && setExamGrade(row._id,{ studentId, resultPass3:v }).then(onChange)}>{v}</button>
                ))}
              </div>
            ) : (
              <div className="mt-2 flex gap-2">
                <input type="number" min={1} max={10} className="input w-24" placeholder="1-10" id={`n-${row._id}`} />
                <button className="btn" onClick={()=>{
                  const el = document.getElementById(`n-${row._id}`) as HTMLInputElement;
                  const n = Number(el?.value||0);
                  if (!studentId || n<1 || n>10) return;
                  setExamGrade(row._id,{ studentId, resultNumeric:n }).then(onChange);
                }}>Guardar</button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
