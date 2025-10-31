import { useEffect, useMemo, useState } from 'react';
import { api, type ExamModelRow, type Pass3 } from '../lib/api';
import { useSearchParams } from 'react-router-dom';
import { ExternalLink, Check } from 'lucide-react';

type CourseOpt = { _id: string; name: string; campus?: 'DERQUI'|'JCP'|string };

/** Igual que en TeacherCourses.tsx */
function isMine(c: any, myId: string): boolean {
  const t = c?.teacher;
  if (!t) return false;
  if (typeof t === 'string') return String(t) === String(myId);
  if (typeof t === 'object') {
    if (t?._id) return String(t._id) === String(myId);
  }
  return false;
}

/** Formateo legible de la sede */
function fmtCampus(c?: string) {
  if (!c) return 'Sin sede';
  const v = String(c).toUpperCase();
  if (v === 'DERQUI') return 'Derqui';
  if (v === 'JCP' || v === 'JOSÉ C. PAZ' || v === 'JOSE C. PAZ') return 'José C. Paz';
  return c;
}

export default function ExamModels() {
  const [params, setParams] = useSearchParams();
  const courseId = params.get('course') || '';
  const [me, setMe] = useState<any>(null);
  const [courses, setCourses] = useState<CourseOpt[]>([]);
  const [rows, setRows] = useState<ExamModelRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number>(0); // “Guardado ✓” 3s

  const role: 'student'|'teacher'|'coordinator'|'admin'|undefined = me?.role;
  const isCoordinator = role === 'coordinator';
  const isAdmin = role === 'admin';
  const isTeacher = role === 'teacher';
  const isStaffSimple = isTeacher || isAdmin;           // docentes y admin usan vista simple
  const isStudent = role === 'student';

  // ⚙️ permisos: solo coordinador edita links
  const canEditLinks = isCoordinator;
  const canToggleVisibility = !!role && ['teacher','coordinator','admin'].includes(role);

  useEffect(() => { api.me().then(r => setMe(r.user)).catch(()=>setMe(null)); }, []);

  useEffect(() => {
    if (!me) return;

    const myId = String(me.id || me._id || '');
    const normalizeMine = (r: any): CourseOpt[] => {
      if (Array.isArray(r?.rows) && r.rows.length) {
        return r.rows.map((it: any) => it?.course ? it.course : it) as CourseOpt[];
      }
      if (Array.isArray(r?.courses) && r.courses.length) return r.courses as CourseOpt[];
      if (Array.isArray(r) && r.length) return r as CourseOpt[];
      return [];
    };

    (async () => {
      try {
        // ✅ FIX: admin ahora ve TODOS los cursos (igual que coordinador).
        if (isCoordinator || isAdmin) {
          const r = await api.courses.list();
          setCourses(r.courses || []);
          return;
        }

        if (isTeacher) {
          // 1) Intento principal: cursos asignados (como alumnos)
          let mine: CourseOpt[] = [];
          try {
            const r = await api.courses.mine();
            mine = normalizeMine(r);
          } catch {/* ok */ }

          // 2) Fallback: listar todos y filtrar en cliente
          if (!mine.length) {
            try {
              const all = await api.courses.list();
              const allCourses: CourseOpt[] = all.courses || [];
              mine = allCourses.filter((c: any) => isMine(c, myId));
            } catch {
              mine = [];
            }
          }

          setCourses(mine);
          return;
        }

        // student
        const r = await api.courses.mine();
        setCourses((r.rows || []).map((x: any) => x.course));
      } catch {
        setCourses([]);
      }
    })();
  }, [me, isCoordinator, isAdmin, isTeacher, role]);

  useEffect(() => { if (courseId) reload(); }, [courseId]);
  const reload = () =>
    api.exams.listModels(courseId)
      .then(setRows)
      .catch((e:any)=>{ console.error(e); setRows([]); });

  useEffect(() => {
    if (!courseId && courses.length) setParams({ course: courses[0]._id });
  }, [courses, courseId, setParams]);

  // estados editables (link/visible por tarjeta)
  const [form, setForm] = useState<Record<string,{driveUrl:string;visible:boolean}>>({});
  useEffect(() => {
    const m: Record<string,{driveUrl:string;visible:boolean}> = {};
    rows.forEach(r => m[r._id] = { driveUrl: (r as any).driveUrl || '', visible: !!(r as any).visible });
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
        if (canEditLinks && (f.driveUrl || '') !== ((r as any).driveUrl || '')) patch.driveUrl = f.driveUrl;
        if (canToggleVisibility && !!f.visible !== !!(r as any).visible) patch.visible = f.visible;
        if (Object.keys(patch).length) updates.push(api.exams.updateModel(r._id, patch));
      }
      await Promise.all(updates);
      await reload();
      setSavedAt(Date.now());
    } catch (e:any) {
      window.alert(e?.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const showSaved = savedAt > 0 && (Date.now() - savedAt < 3000);

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
              {courses.map(c => (
                <option key={c._id} value={c._id}>
                  {c.name} — {fmtCampus(c.campus)}
                </option>
              ))}
            </select>
            {courseId && (
              <div className="mt-1 text-xs text-neutral-700">
                Sede:{' '}
                <span className="px-2 py-0.5 rounded-full border bg-neutral-50">
                  {fmtCampus(courses.find(x=>x._id===courseId)?.campus)}
                </span>
              </div>
            )}
          </div>
        )}

        {(isCoordinator || isStaffSimple) && (
          <div className="mt-4 flex items-center gap-3">
            <button className="btn btn-primary" onClick={onSave} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
            {showSaved && (
              <span className="inline-flex items-center gap-1 text-green-700 text-sm">
                <Check size={16}/> Guardado
              </span>
            )}
            <div className="text-xs mt-2 text-neutral-600">
              {isCoordinator
                ? 'Podés editar links, habilitar la vista y cargar notas.'
                : 'Como docente/admin podés habilitar la vista y cargar nota.'}
            </div>
          </div>
        )}
      </div>

      <Section title="Exámenes modelos - Mitad de año">
        {grouped.mid.map(m =>
          <ExamRow
            key={m._id}
            row={m}
            form={form[m._id] || {driveUrl:'',visible:false}}
            setForm={(patch)=>setForm(s=>({ ...s, [m._id]: { ...(s[m._id]||{driveUrl:'',visible:false}), ...patch } }))}
            mode={
              isCoordinator ? 'coord' : isStaffSimple ? 'staffSimple' : 'student'
            }
            canToggleVisibility={!!canToggleVisibility}
          />
        )}
      </Section>

      <Section title="Exámenes modelos - Fin de año">
        {grouped.end.map(m =>
          <ExamRow
            key={m._id}
            row={m}
            form={form[m._id] || {driveUrl:'',visible:false}}
            setForm={(patch)=>setForm(s=>({ ...s, [m._id]: { ...(s[m._id]||{driveUrl:'',visible:false}), ...patch } }))}
            mode={
              isCoordinator ? 'coord' : isStaffSimple ? 'staffSimple' : 'student'
            }
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
  row, form, setForm, mode, canToggleVisibility
}: {
  row: ExamModelRow;
  form: { driveUrl: string; visible: boolean };
  setForm: (patch: Partial<{driveUrl:string;visible:boolean}>) => void;
  mode: 'coord'|'staffSimple'|'student';
  canToggleVisibility: boolean;
}) {
  const title = `${row.category === 'MID_YEAR' ? 'Mitad' : 'Final'} – Modelo ${row.number}`;
  const canOpen =
    mode === 'coord' ? !!form.driveUrl : !!(form.driveUrl); // server ya limpia link p/ alumno si no visible

  return (
    <div className="rounded-2xl border p-3 shadow-sm hover:shadow transition">
      {/* Header pill + botón */}
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="inline-flex items-center gap-2">
          <span className="px-2 py-1 text-xs rounded-full border bg-neutral-50">
            {row.category === 'MID_YEAR' ? 'Mitad de año' : 'Fin de año'}
          </span>
          <span className="font-medium">{title}</span>
        </div>
        <a
          className={
            'inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm ' +
            (canOpen
              ? 'border bg-neutral-50 hover:bg-neutral-100'
              : 'border opacity-50 pointer-events-none')
          }
          href={canOpen ? form.driveUrl : undefined}
          target="_blank" rel="noreferrer"
          title={canOpen ? 'Abrir examen' : 'Sin link disponible'}
        >
          Ver examen <ExternalLink size={16}/>
        </a>
      </div>

      {/* Subtítulo tipo de calificación */}
      <div className="text-xs text-neutral-600 mb-3">
        {row.gradeType === 'PASS3'
          ? 'Evaluación: PASS / BARELY_PASS / FAILED'
          : 'Evaluación: Nota 1–10'}
      </div>

      {/* Vista por rol */}
      {mode === 'coord' && (
        <>
          {/* Link de Drive (solo coordinador) */}
          <label className="block text-sm mb-1">URL del examen (Drive)</label>
          <input
            className="input mb-2"
            placeholder="https://drive.google.com/..."
            value={form.driveUrl}
            onChange={e=>setForm({ driveUrl: e.target.value })}
          />
          {/* Visible */}
          <label className="inline-flex items-center gap-2 mb-3">
            <input type="checkbox" checked={form.visible} onChange={e=>setForm({ visible: e.target.checked })}/>
            <span>Habilitar vista para alumnos</span>
          </label>
          {/* Notas */}
          <div className="rounded-xl border bg-neutral-50 p-3">
            <GradeBox row={row} />
          </div>
        </>
      )}

      {mode === 'staffSimple' && (
        <>
          {/* Sin URL. Solo toggle + notas */}
          {canToggleVisibility && (
            <label className="inline-flex items-center gap-2 mb-3">
              <input type="checkbox" checked={form.visible} onChange={e=>setForm({ visible: e.target.checked })}/>
              <span>Habilitar vista para alumnos</span>
            </label>
          )}
          <div className="rounded-xl border bg-neutral-50 p-3">
            <GradeBox row={row} />
          </div>
        </>
      )}

      {mode === 'student' && (
        <>
          <div className="rounded-xl border bg-neutral-50 p-3">
            {(row as any).myGrade ? (
              <div>
                <div className="text-sm text-neutral-700">Tu resultado</div>
                <div className="mt-1">
                  <span className="badge">
                    {row.gradeType === 'PASS3'
                      ? ((row as any).myGrade.resultPass3 ?? 'Sin registro')
                      : ((row as any).myGrade.resultNumeric ?? 'Sin registro')}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-neutral-500">Aún no tenés resultado cargado.</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function GradeBox({ row }: { row: ExamModelRow }) {
  const [studentId, setStudentId] = useState('');
  const [students, setStudents] = useState<{ _id:string; name:string }[]>([]);
  const [num, setNum] = useState<string>('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

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

  const flashSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const savePass3 = async (v: Pass3) => {
    if (!studentId) return;
    setSaving(true);
    try {
      await api.exams.setGrade(row._id, { studentId, resultPass3: v });
      flashSaved();
    } catch (e:any) {
      window.alert(e?.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const saveNum = async () => {
    const n = Number(num);
    if (!studentId || !(n>=1 && n<=10)) return;
    setSaving(true);
    try {
      await api.exams.setGrade(row._id, { studentId, resultNumeric: n });
      setNum('');
      flashSaved();
    } catch (e:any) {
      window.alert(e?.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-1">
      <div className="flex items-center justify-between">
        <label className="block text-sm mb-1">Alumno</label>
        {saved && (
          <span className="inline-flex items-center gap-1 text-green-700 text-xs">
            <Check size={14}/> Guardado
          </span>
        )}
      </div>

      <select className="input mb-2" value={studentId} onChange={e=>setStudentId(e.target.value)}>
        <option value="">Seleccionar…</option>
        {students.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
      </select>

      {row.gradeType === 'PASS3' ? (
        <div className="flex gap-2 flex-wrap">
          {(['PASS','BARELY_PASS','FAILED'] as Pass3[]).map(v=>(
            <button key={v} className="btn btn-secondary" onClick={()=>savePass3(v)} disabled={saving}>{v}</button>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input className="input w-24" type="number" min={1} max={10}
            value={num} onChange={e=>setNum(e.target.value)} placeholder="1-10" />
          <button className="btn btn-secondary" onClick={saveNum} disabled={saving}>
            Guardar
          </button>
        </div>
      )}
    </div>
  );
}



