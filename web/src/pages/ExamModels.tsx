import { useEffect, useMemo, useState } from 'react';
import { api, type ExamModelRow, type Pass3 } from '../lib/api';
import { useSearchParams } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';

type CourseOpt = { _id: string; name: string };

export default function ExamModels() {
  const [params, setParams] = useSearchParams();
  const courseId = params.get('course') || '';
  const [me, setMe] = useState<any>(null);
  const [courses, setCourses] = useState<CourseOpt[]>([]);
  const [rows, setRows] = useState<ExamModelRow[]>([]);
  const [saving, setSaving] = useState(false);

  const isStaff = me && ['teacher', 'coordinator', 'admin'].includes(me.role);
  const canEditLinks = me && ['coordinator', 'admin'].includes(me.role);
  const canToggleVisibility = me && ['teacher', 'coordinator', 'admin'].includes(me.role);

  useEffect(() => { api.me().then(r => setMe(r.user)).catch(()=>setMe(null)); }, []);

  useEffect(() => {
    if (!me) return;

    // ⚠️ Regla solicitada:
    // - coordinator/admin → TODOS los cursos
    // - teacher → SOLO sus cursos (igual que alumnos) usando courses.mine()
    // - student → sus cursos (ya existía)
    if (['coordinator','admin'].includes(me.role)) {
      api.courses.list()
        .then(r => setCourses(r.courses || []))
        .catch(()=>setCourses([]));
    } else if (me.role === 'teacher') {
      api.courses.mine()
        .then(r => {
          // Soportamos distintos shapes de respuesta:
          //  - { rows: [{ course }] }
          //  - { courses: [course] }
          //  - [course]
          let list: CourseOpt[] = [];
          if (Array.isArray(r?.rows)) list = r.rows.map((x:any)=>x.course);
          else if (Array.isArray(r?.courses)) list = r.courses;
          else if (Array.isArray(r)) list = r as CourseOpt[];
          setCourses(list || []);
        })
        .catch(()=>setCourses([]));
    } else {
      api.courses.mine()
        .then(r => setCourses((r.rows||[]).map((x:any)=>x.course)))
        .catch(()=>setCourses([]));
    }
  }, [me]);

  useEffect(() => { if (courseId) reload(); }, [courseId]);
  const reload = () =>
    api.exams.listModels(courseId)
      .then(setRows)
      .catch((e:any)=>{ console.error(e); setRows([]); });

  useEffect(() => {
    if (!courseId && courses.length) setParams({ course: courses[0]._id });
  }, [courses, courseId, setParams]);

  // estados editables
  const [form, setForm] = useState<Record<string,{driveUrl:string;visible:boolean}>>({});
  useEffect(() => {
    const m: Record<string,{driveUrl:string;visible:boolean}> = {};
    rows.forEach(r => m[r._id] = { driveUrl: r.driveUrl || '', visible: !!r.visible });
    setForm(m);
  }, [rows]);

  const grouped = useMemo(() => ({
    mid: rows.filter(r => r.category === 'MID_YEAR').sort((a,b)=>a.number-b.number),
    end: rows.filter(r => r.category === 'END_YEAR').sort((a,b)=>a.number-b.number),
  }), [rows]);

  const onSave = async () => {
    if (!courseId) return;
    setSaving(true);
    try {
      const updates: Promise<any>[] = [];
      for (const r of rows) {
        const f = form[r._id];
        if (!f) continue;
        const patch: any = {};
        if (canEditLinks && (f.driveUrl || '') !== (r.driveUrl || '')) patch.driveUrl = f.driveUrl;
        if (canToggleVisibility && !!f.visible !== !!r.visible) patch.visible = f.visible;
        if (Object.keys(patch).length) updates.push(api.exams.updateModel(r._id, patch));
      }
      await Promise.all(updates);
      await reload();
      alert('Guardado.');
    } catch (e:any) {
      alert(e?.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <h1 className="font-heading text-xl">Exámenes modelos</h1>

        {courses.length > 0 && (
          <div className="mt-3">
            <label className="block text-sm mb-1">Curso</label>
            <select
              className="input"
              value={courseId}
              onChange={e=>setParams({ course: e.target.value })}
            >
              {courses.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
        )}

        {isStaff && (
          <div className="mt-4">
            <button className="btn btn-primary" onClick={onSave} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
            <div className="text-xs mt-2 text-neutral-600">
              {canEditLinks
                ? 'Solo coordinador/administrativo pueden editar los links. Docentes pueden habilitar la vista y cargar nota.'
                : 'Como docente podés habilitar la vista y cargar nota; los links los carga coordinación.'}
            </div>
          </div>
        )}
      </div>

      <Section title="Exámenes modelos - Mitad de año">
        {grouped.mid.map(m =>
          <ExamRow key={m._id}
                   row={m}
                   form={form[m._id] || {driveUrl:'',visible:false}}
                   setForm={(patch)=>setForm(s=>({ ...s, [m._id]: { ...(s[m._id]||{driveUrl:'',visible:false}), ...patch } }))}
                   canEditLinks={!!canEditLinks}
                   canToggleVisibility={!!canToggleVisibility}
          />
        )}
      </Section>

      <Section title="Exámenes modelos - Fin de año">
        {grouped.end.map(m =>
          <ExamRow key={m._id}
                   row={m}
                   form={form[m._id] || {driveUrl:'',visible:false}}
                   setForm={(patch)=>setForm(s=>({ ...s, [m._id]: { ...(s[m._id]||{driveUrl:'',visible:false}), ...patch } }))}
                   canEditLinks={!!canEditLinks}
                   canToggleVisibility={!!canToggleVisibility}
          />
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title:string; children:any }) {
  return (
    <div className="card p-4">
      <h2 className="font-heading text-lg mb-3">{title}</h2>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </div>
  );
}

function ExamRow({
  row, form, setForm, canEditLinks, canToggleVisibility
}: {
  row: ExamModelRow;
  form: { driveUrl: string; visible: boolean };
  setForm: (patch: Partial<{driveUrl:string;visible:boolean}>) => void;
  canEditLinks: boolean;
  canToggleVisibility: boolean;
}) {
  const title = `${row.category === 'MID_YEAR' ? 'Mitad' : 'Final'} – Modelo ${row.number}`;
  const canOpen = !!form.driveUrl;

  return (
    <div className="rounded-xl border p-3">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="font-medium">{title}</div>
        <a
          className={`link inline-flex items-center gap-1 ${canOpen ? '' : 'opacity-40 pointer-events-none'}`}
          href={canOpen ? form.driveUrl : undefined}
          target="_blank" rel="noreferrer"
          title={canOpen ? 'Abrir en Google Drive' : 'Sin link de Drive'}
        >
          Ver en Drive <ExternalLink size={16}/>
        </a>
      </div>

      <div className="text-xs text-neutral-600 mb-2">
        Tipo: {row.gradeType === 'PASS3' ? 'PASS / BARELY_PASS / FAILED' : 'Nota 1–10'}
      </div>

      {/* Link de Drive */}
      <label className="block text-sm mb-1">URL del examen (Drive)</label>
      <input
        className="input mb-2"
        placeholder="https://drive.google.com/..."
        value={form.driveUrl}
        onChange={e=>setForm({ driveUrl: e.target.value })}
        disabled={!canEditLinks}
      />

      {/* Visible */}
      {canToggleVisibility && (
        <label className="inline-flex items-center gap-2 mb-2">
          <input type="checkbox" checked={form.visible} onChange={e=>setForm({ visible: e.target.checked })}/>
          <span>Habilitar vista para alumnos</span>
        </label>
      )}

      {/* Nota (staff) */}
      {canToggleVisibility && (
        <GradeBox row={row} />
      )}

      {/* Alumno: muestra su resultado si viene en myGrade */}
      {!canToggleVisibility && (row as any).myGrade && (
        <div className="mt-2">
          <span className="badge">
            {row.gradeType === 'PASS3'
              ? ((row as any).myGrade.resultPass3 ?? 'Sin registro')
              : ((row as any).myGrade.resultNumeric ?? 'Sin registro')}
          </span>
        </div>
      )}
    </div>
  );
}

function GradeBox({ row }: { row: ExamModelRow }) {
  const [studentId, setStudentId] = useState('');
  const [students, setStudents] = useState<{ _id:string; name:string }[]>([]);
  const [num, setNum] = useState<string>('');

  useEffect(() => {
    // roster del curso del modelo (para validar permisos)
    api.courses.teacher(String((row as any).course?._id || (row as any).course))
      .catch(()=>({ teacher:null }));
    const courseId = String((row as any).course?._id || (row as any).course);
    if (!courseId) return;
    api.courses.roster(courseId)
      .then(r => setStudents((r.roster||[]).map((it:any)=>({ _id: it.student?._id, name: it.student?.name }))))
      .catch(()=>setStudents([]));
  }, [row]);

  const savePass3 = async (v: Pass3) => {
    if (!studentId) return;
    await api.exams.setGrade(row._id, { studentId, resultPass3: v });
    alert('Guardado.');
  };

  const saveNum = async () => {
    const n = Number(num);
    if (!studentId || !(n>=1 && n<=10)) return;
    await api.exams.setGrade(row._id, { studentId, resultNumeric: n });
    alert('Guardado.');
    setNum('');
  };

  return (
    <div className="mt-3 rounded-lg bg-neutral-50 p-2">
      <label className="block text-sm mb-1">Alumno</label>
      <select className="input mb-2" value={studentId} onChange={e=>setStudentId(e.target.value)}>
        <option value="">Seleccionar…</option>
        {students.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
      </select>

      {row.gradeType === 'PASS3' ? (
        <div className="flex gap-2 flex-wrap">
          {(['PASS','BARELY_PASS','FAILED'] as Pass3[]).map(v=>(
            <button key={v} className="btn btn-secondary" onClick={()=>savePass3(v)}>{v}</button>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input className="input w-24" type="number" min={1} max={10}
            value={num} onChange={e=>setNum(e.target.value)} placeholder="1-10"/>
          <button className="btn btn-secondary" onClick={saveNum}>Guardar</button>
        </div>
      )}
    </div>
  );
}
