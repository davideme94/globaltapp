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

  // ⚙️ permisos
  const canEditLinks = isCoordinator; // Solo coordinador edita links
  const canToggleVisibility = !!role && ['teacher','coordinator','admin'].includes(role);
  const allowGrade = isCoordinator || isTeacher;        // ✅ Solo docente + coordinador cargan notas (admin NO)

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
        // Admin ve TODOS los cursos (igual que coordinador), pero sin poder cargar notas
        if (isCoordinator || isAdmin) {
          const r = await api.courses.list();
          setCourses(r.courses || []);
          return;
        }

        if (isTeacher) {
          // 1) Intento principal: cursos asignados
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
                : (isTeacher
                    ? 'Como docente podés habilitar la vista y cargar nota.'
                    : 'Como admin podés habilitar la vista.')}
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
            mode={ isCoordinator ? 'coord' : isStaffSimple ? 'staffSimple' : 'student' }
            canToggleVisibility={!!canToggleVisibility}
            allowGrade={allowGrade}
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
            mode={ isCoordinator ? 'coord' : isStaffSimple ? 'staffSimple' : 'student' }
            canToggleVisibility={!!canToggleVisibility}
            allowGrade={allowGrade}
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

/* =========================
   Mini-helpers visuales
   ========================= */
function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xl text-[11px]
                 bg-[var(--chip-bg)] text-[var(--chip-text)]
                 ring-1 ring-[var(--border)] shadow-[0_1px_0_rgba(0,0,0,.03)]"
    >
      {children}
    </span>
  );
}

function SoftDivider() {
  return <div className="h-px my-3 bg-[var(--border)]/80" />;
}

function BookSticker() {
  return (
    <svg viewBox="0 0 64 64" width="64" height="64" className="drop-shadow-sm">
      <defs>
        <linearGradient id="g" x1="0" x2="1">
          <stop offset="0" stopColor="#a21caf"/><stop offset="1" stopColor="#7c3aed"/>
        </linearGradient>
      </defs>
      <rect x="6" y="10" rx="12" ry="12" width="52" height="44" fill="url(#g)"/>
      <rect x="10" y="14" rx="9" ry="9" width="44" height="36" fill="#ffffff" opacity="0.95" />
      <circle cx="26" cy="30" r="3.2" fill="#0ea5e9"/>
      <circle cx="38" cy="30" r="3.2" fill="#10b981"/>
      <path d="M20 40c6 4 18 4 24 0" stroke="#a78bfa" strokeWidth="3" fill="none" strokeLinecap="round"/>
    </svg>
  );
}

/* =========================
   Tarjeta “cute” de examen
   ========================= */
function ExamRow({
  row, form, setForm, mode, canToggleVisibility, allowGrade
}: {
  row: ExamModelRow;
  form: { driveUrl: string; visible: boolean };
  setForm: (patch: Partial<{driveUrl:string;visible:boolean}>) => void;
  mode: 'coord'|'staffSimple'|'student';
  canToggleVisibility: boolean;
  allowGrade: boolean; // ✅ solo docente+coordinador
}) {
  const title = `${row.category === 'MID_YEAR' ? 'Mitad' : 'Final'} – Modelo ${row.number}`;
  const canOpen =
    mode === 'coord' ? !!form.driveUrl : !!(form.driveUrl); // server ya limpia link p/ alumno si no visible

  const catLabel = row.category === 'MID_YEAR' ? 'MITAD DE AÑO' : 'FIN DE AÑO';
  const gradeLabel = row.gradeType === 'PASS3'
    ? 'PASS / BARELY_PASS / FAILED'
    : 'Nota 1–10';

  return (
    <div
      className="rounded-3xl border overflow-hidden shadow-sm transition group
                 ring-1 ring-[var(--border)] bg-[var(--card)]"
      style={{
        backgroundImage:
          'linear-gradient(120deg, rgba(162,28,175,.14), rgba(124,58,237,.12))'
      }}
    >
      {/* Banda superior con degradado y sticker */}
      <div
        className="relative flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-4 py-3"
        style={{
          background:
            'linear-gradient(90deg, rgba(162,28,175,.25), rgba(124,58,237,.18))'
        }}
      >
        <div className="shrink-0 rounded-2xl bg-[var(--soft)] p-2 ring-1 ring-[var(--border)]">
          <BookSticker/>
        </div>

        <div className="min-w-0 grow">
          <div className="flex flex-wrap items-center gap-2">
            <Chip>{catLabel}</Chip>
            <Chip>🧮 {gradeLabel}</Chip>
          </div>

          {/* 🔧 título sin truncar en móvil */}
          <h3
            className="mt-1 font-semibold text-[17px] leading-6 pr-1 w-full"
            style={{
              whiteSpace: 'normal',
              wordBreak: 'break-word',
              overflow: 'visible',
              textOverflow: 'clip'
            }}
          >
            {title}
          </h3>
        </div>

        <a
          className={
            'sm:ml-auto w-full sm:w-auto text-center inline-flex items-center justify-center gap-2 rounded-xl px-3 py-1.5 text-sm transition ' +
            (canOpen
              ? 'border bg-[var(--soft)] hover:brightness-110 ring-1 ring-[var(--border)]'
              : 'border opacity-50 pointer-events-none ring-1 ring-[var(--border)]')
          }
          href={canOpen ? form.driveUrl : undefined}
          target="_blank" rel="noreferrer"
          title={canOpen ? 'Abrir examen' : 'Sin link disponible'}
        >
          Ver examen <ExternalLink size={16}/>
        </a>
      </div>

      <div className="p-4">
        <SoftDivider/>

        {/* Vista por rol (misma lógica) */}
        {mode === 'coord' && (
          <div className="grid gap-3">
            <div>
              <label className="block text-sm mb-1">URL del examen (Drive)</label>
              <input
                className="input"
                placeholder="https://drive.google.com/..."
                value={form.driveUrl}
                onChange={e=>setForm({ driveUrl: e.target.value })}
              />
            </div>

            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={form.visible} onChange={e=>setForm({ visible: e.target.checked })}/>
              <span>Habilitar vista para alumnos</span>
            </label>

            <div className="rounded-2xl border bg-[var(--soft)] p-3 ring-1 ring-[var(--border)]">
              <GradeBox row={row} />
            </div>
          </div>
        )}

        {mode === 'staffSimple' && (
          <div className="grid gap-3">
            {canToggleVisibility && (
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.visible}
                  onChange={e=>setForm({ visible: e.target.checked })}
                />
                <span>Habilitar vista para alumnos</span>
              </label>
            )}

            {allowGrade ? (
              <div className="rounded-2xl border bg-[var(--soft)] p-3 ring-1 ring-[var(--border)]">
                <GradeBox row={row} />
              </div>
            ) : (
              <div className="text-xs text-[var(--muted)]">
                Solo docentes pueden cargar notas.
              </div>
            )}
          </div>
        )}

        {mode === 'student' && (
          <div className="rounded-2xl border bg-[var(--soft)] p-3 ring-1 ring-[var(--border)]">
            {(row as any).myGrade ? (
              <div>
                <div className="text-sm">Tu resultado</div>
                <div className="mt-1">
                  <span className="badge">
                    {row.gradeType === 'PASS3'
                      ? ((row as any).myGrade.resultPass3 ?? 'Sin registro')
                      : ((row as any).myGrade.resultNumeric ?? 'Sin registro')}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-[var(--muted)]">Aún no tenés resultado cargado.</div>
            )}
          </div>
        )}
      </div>
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



