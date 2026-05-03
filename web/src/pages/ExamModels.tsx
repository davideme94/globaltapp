import { useEffect, useMemo, useState } from 'react';
import { api, type ExamModelRow, type Pass3 } from '../lib/api';
import { useSearchParams } from 'react-router-dom';
import { ExternalLink, Check, FileText } from 'lucide-react';

type CourseOpt = { _id: string; name: string; campus?: 'DERQUI' | 'JCP' | string };

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
  const [savedAt, setSavedAt] = useState<number>(0);

  const role: 'student' | 'teacher' | 'coordinator' | 'admin' | undefined = me?.role;

  const isCoordinator = role === 'coordinator';
  const isAdmin = role === 'admin';
  const isTeacher = role === 'teacher';
  const isStaffSimple = isTeacher || isAdmin;
  const isStudent = role === 'student';

  // permisos
  const canEditLinks = isCoordinator;
  const canToggleVisibility = !!role && ['teacher', 'coordinator', 'admin'].includes(role);
  const allowGrade = isCoordinator || isTeacher;

  useEffect(() => {
    api.me()
      .then(r => setMe(r.user))
      .catch(() => setMe(null));
  }, []);

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
        // Admin ve TODOS los cursos igual que coordinador, pero sin poder cargar notas
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
          } catch {
            // ok
          }

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

  useEffect(() => {
    if (courseId) reload();
  }, [courseId]);

  const reload = () =>
    api.exams.listModels(courseId)
      .then(setRows)
      .catch((e: any) => {
        console.error(e);
        setRows([]);
      });

  useEffect(() => {
    if (!courseId && courses.length) setParams({ course: courses[0]._id });
  }, [courses, courseId, setParams]);

  // estados editables link/visible por tarjeta
  const [form, setForm] = useState<Record<string, { driveUrl: string; visible: boolean }>>({});

  useEffect(() => {
    const m: Record<string, { driveUrl: string; visible: boolean }> = {};

    rows.forEach(r => {
      m[r._id] = {
        driveUrl: (r as any).driveUrl || '',
        visible: !!(r as any).visible,
      };
    });

    setForm(m);
  }, [rows]);

  const grouped = useMemo(() => ({
    mid: rows.filter(r => r.category === 'MID_YEAR').sort((a, b) => a.number - b.number),
    end: rows.filter(r => r.category === 'END_YEAR').sort((a, b) => a.number - b.number),
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

        if (canEditLinks && (f.driveUrl || '') !== ((r as any).driveUrl || '')) {
          patch.driveUrl = f.driveUrl;
        }

        if (canToggleVisibility && !!f.visible !== !!(r as any).visible) {
          patch.visible = f.visible;
        }

        if (Object.keys(patch).length) {
          updates.push(api.exams.updateModel(r._id, patch));
        }
      }

      await Promise.all(updates);
      await reload();
      setSavedAt(Date.now());
    } catch (e: any) {
      window.alert(e?.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const showSaved = savedAt > 0 && (Date.now() - savedAt < 3000);

  const selectedCourse = courses.find(x => x._id === courseId);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-3 py-4 sm:px-5 md:px-6 md:py-6">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-r from-slate-900 via-violet-700 to-indigo-700 p-[2px] shadow-xl shadow-violet-100">
        <div className="relative overflow-hidden rounded-[2rem] bg-white p-5 sm:p-7 md:p-8">
          <div className="absolute -right-14 -top-14 h-44 w-44 rounded-full bg-violet-200/60 blur-3xl" />
          <div className="absolute -bottom-16 -left-14 h-44 w-44 rounded-full bg-indigo-200/60 blur-3xl" />

          <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="mb-3 w-fit rounded-full border border-violet-100 bg-violet-50 px-4 py-1.5 text-xs font-black uppercase tracking-wide text-violet-700">
                Exámenes modelo
              </div>

              <h1 className="text-2xl font-black tracking-tight text-neutral-950 sm:text-3xl md:text-4xl">
                Gestión de exámenes modelo
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-neutral-600 sm:text-base">
                Consultá, habilitá y administrá modelos de examen según tu rol y curso asignado.
              </p>
            </div>

            <div className="grid w-full gap-3 sm:grid-cols-2 md:w-auto md:min-w-[360px]">
              <div className="rounded-3xl border border-violet-100 bg-violet-50/80 px-5 py-4 shadow-sm">
                <p className="text-xs font-black uppercase tracking-wide text-violet-500">
                  Rol
                </p>
                <p className="mt-1 text-sm font-black text-violet-800">
                  {role || '—'}
                </p>
              </div>

              <div className="rounded-3xl border border-indigo-100 bg-indigo-50/80 px-5 py-4 shadow-sm">
                <p className="text-xs font-black uppercase tracking-wide text-indigo-500">
                  Curso
                </p>
                <p className="mt-1 break-words text-sm font-black text-indigo-800">
                  {selectedCourse?.name || 'Sin curso'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CONTROLES */}
      <section className="rounded-[2rem] border border-neutral-200 bg-white p-4 shadow-xl shadow-neutral-100 sm:p-5">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-black text-neutral-950">
              Curso seleccionado
            </h2>
            <p className="text-sm text-neutral-500">
              Elegí el curso para visualizar sus exámenes modelo.
            </p>
          </div>

          {courseId && (
            <span className="w-fit rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2 text-xs font-black uppercase tracking-wide text-neutral-600">
              {fmtCampus(selectedCourse?.campus)}
            </span>
          )}
        </div>

        {courses.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
            <label className="grid gap-2">
              <span className="text-sm font-black text-neutral-700">
                Curso
              </span>

              <select
                className="min-h-[54px] w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-700 outline-none transition focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100"
                value={courseId}
                onChange={e => setParams({ course: e.target.value })}
              >
                {courses.map(c => (
                  <option key={c._id} value={c._id}>
                    {c.name} — {fmtCampus(c.campus)}
                  </option>
                ))}
              </select>
            </label>

            {(isCoordinator || isStaffSimple) && (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:justify-end">
                <button
                  className="w-full rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-3 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-violet-200 transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                  onClick={onSave}
                  disabled={saving}
                >
                  {saving ? 'Guardando…' : 'Guardar cambios'}
                </button>

                {showSaved && (
                  <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-700">
                    <Check size={16} /> Guardado
                  </span>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-neutral-200 bg-neutral-50 p-6 text-center">
            <p className="text-sm font-bold text-neutral-700">
              No hay cursos disponibles.
            </p>
          </div>
        )}

        {(isCoordinator || isStaffSimple) && (
          <div className="mt-4 rounded-3xl border border-neutral-200 bg-neutral-50 px-5 py-4 text-sm leading-relaxed text-neutral-600">
            {isCoordinator
              ? 'Podés editar links, habilitar la vista y cargar notas.'
              : isTeacher
                ? 'Como docente podés habilitar la vista y cargar nota.'
                : 'Como admin podés habilitar la vista.'}
          </div>
        )}
      </section>

      <Section title="Exámenes modelos - Mitad de año" count={grouped.mid.length}>
        {grouped.mid.map(m => (
          <ExamRow
            key={m._id}
            row={m}
            form={form[m._id] || { driveUrl: '', visible: false }}
            setForm={(patch) =>
              setForm(s => ({
                ...s,
                [m._id]: {
                  ...(s[m._id] || { driveUrl: '', visible: false }),
                  ...patch,
                },
              }))
            }
            mode={isCoordinator ? 'coord' : isStaffSimple ? 'staffSimple' : 'student'}
            canToggleVisibility={!!canToggleVisibility}
            allowGrade={allowGrade}
          />
        ))}
      </Section>

      <Section title="Exámenes modelos - Fin de año" count={grouped.end.length}>
        {grouped.end.map(m => (
          <ExamRow
            key={m._id}
            row={m}
            form={form[m._id] || { driveUrl: '', visible: false }}
            setForm={(patch) =>
              setForm(s => ({
                ...s,
                [m._id]: {
                  ...(s[m._id] || { driveUrl: '', visible: false }),
                  ...patch,
                },
              }))
            }
            mode={isCoordinator ? 'coord' : isStaffSimple ? 'staffSimple' : 'student'}
            canToggleVisibility={!!canToggleVisibility}
            allowGrade={allowGrade}
          />
        ))}
      </Section>
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: any;
}) {
  return (
    <section className="rounded-[2rem] border border-neutral-200 bg-white p-4 shadow-xl shadow-neutral-100 sm:p-5">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-black text-neutral-950">
            {title}
          </h2>
          <p className="text-sm text-neutral-500">
            Modelos disponibles para esta instancia.
          </p>
        </div>

        <span className="w-fit rounded-full border border-violet-100 bg-violet-50 px-4 py-2 text-xs font-black uppercase tracking-wide text-violet-700">
          {count} modelo{count === 1 ? '' : 's'}
        </span>
      </div>

      {count === 0 ? (
        <div className="rounded-3xl border border-dashed border-neutral-200 bg-neutral-50 p-6 text-center">
          <p className="text-sm font-bold text-neutral-700">
            No hay modelos cargados en esta sección.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {children}
        </div>
      )}
    </section>
  );
}

/* =========================
   Mini-helpers visuales
   ========================= */
function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-3 py-1 text-[11px] font-black uppercase tracking-wide text-neutral-600 shadow-sm">
      {children}
    </span>
  );
}

function SoftDivider() {
  return <div className="my-4 h-px bg-neutral-200" />;
}

function ExamIcon() {
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/15 text-white shadow-sm backdrop-blur">
      <FileText size={24} strokeWidth={2.4} />
    </div>
  );
}

/* =========================
   Tarjeta de examen
   ========================= */
function ExamRow({
  row,
  form,
  setForm,
  mode,
  canToggleVisibility,
  allowGrade,
}: {
  row: ExamModelRow;
  form: { driveUrl: string; visible: boolean };
  setForm: (patch: Partial<{ driveUrl: string; visible: boolean }>) => void;
  mode: 'coord' | 'staffSimple' | 'student';
  canToggleVisibility: boolean;
  allowGrade: boolean;
}) {
  const title = `${row.category === 'MID_YEAR' ? 'Mitad de año' : 'Fin de año'} · Modelo ${row.number}`;

  const canOpen =
    mode === 'coord' ? !!form.driveUrl : !!(form.driveUrl);

  const catLabel = row.category === 'MID_YEAR' ? 'Mitad de año' : 'Fin de año';

  const gradeLabel = row.gradeType === 'PASS3'
    ? 'Aprobación simple'
    : 'Nota 1–10';

  return (
    <article className="overflow-hidden rounded-[2rem] border border-neutral-200 bg-white shadow-lg shadow-neutral-100 transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-xl">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-violet-700 to-indigo-700 px-5 py-5 text-white">
        <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-12 -left-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <ExamIcon />

            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/20 bg-white/15 px-3 py-1 text-xs font-black uppercase tracking-wide text-white shadow-sm backdrop-blur-sm">
                  {catLabel}
                </span>

                <span className="rounded-full border border-white/20 bg-white/15 px-3 py-1 text-xs font-black uppercase tracking-wide text-white shadow-sm backdrop-blur-sm">
                  {gradeLabel}
                </span>
              </div>

              <h3 className="break-words text-xl font-black leading-tight sm:text-2xl">
                {title}
              </h3>
            </div>
          </div>

          <a
            className={
              'inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black uppercase tracking-wide transition sm:w-auto ' +
              (canOpen
                ? 'border border-white/30 bg-white/15 text-white shadow-sm backdrop-blur hover:bg-white/25'
                : 'pointer-events-none border border-white/20 bg-white/10 text-white/50')
            }
            href={canOpen ? form.driveUrl : undefined}
            target="_blank"
            rel="noreferrer"
            title={canOpen ? 'Abrir examen' : 'Sin link disponible'}
          >
            Ver examen <ExternalLink size={16} />
          </a>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap gap-2">
          <Chip>{catLabel}</Chip>
          <Chip>{gradeLabel}</Chip>
          <Chip>{form.visible ? 'Visible para alumnos' : 'No visible'}</Chip>
        </div>

        <SoftDivider />

        {/* Vista por rol */}
        {mode === 'coord' && (
          <div className="grid gap-4">
            <label className="grid gap-2">
              <span className="text-sm font-black text-neutral-700">
                URL del examen Drive
              </span>

              <input
                className="min-h-[52px] w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-700 outline-none transition placeholder:text-neutral-400 focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100"
                placeholder="https://drive.google.com/..."
                value={form.driveUrl}
                onChange={e => setForm({ driveUrl: e.target.value })}
              />
            </label>

            <label className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
              <input
                type="checkbox"
                checked={form.visible}
                onChange={e => setForm({ visible: e.target.checked })}
                className="h-5 w-5 accent-violet-600"
              />
              <span className="text-sm font-bold text-neutral-700">
                Habilitar vista para alumnos
              </span>
            </label>

            <div className="rounded-[1.75rem] border border-neutral-200 bg-neutral-50 p-4">
              <GradeBox row={row} />
            </div>
          </div>
        )}

        {mode === 'staffSimple' && (
          <div className="grid gap-4">
            {canToggleVisibility && (
              <label className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                <input
                  type="checkbox"
                  checked={form.visible}
                  onChange={e => setForm({ visible: e.target.checked })}
                  className="h-5 w-5 accent-violet-600"
                />

                <span className="text-sm font-bold text-neutral-700">
                  Habilitar vista para alumnos
                </span>
              </label>
            )}

            {allowGrade ? (
              <div className="rounded-[1.75rem] border border-neutral-200 bg-neutral-50 p-4">
                <GradeBox row={row} />
              </div>
            ) : (
              <div className="rounded-3xl border border-neutral-200 bg-neutral-50 px-5 py-4 text-sm font-semibold text-neutral-500">
                Solo docentes pueden cargar notas.
              </div>
            )}
          </div>
        )}

        {mode === 'student' && (
          <div className="rounded-[1.75rem] border border-neutral-200 bg-neutral-50 p-4">
            {(row as any).myGrade ? (
              <div>
                <div className="text-sm font-black uppercase tracking-wide text-neutral-500">
                  Tu resultado
                </div>

                <div className="mt-2">
                  <span className="inline-flex rounded-full border border-violet-100 bg-violet-50 px-4 py-2 text-sm font-black text-violet-700">
                    {row.gradeType === 'PASS3'
                      ? ((row as any).myGrade.resultPass3 ?? 'Sin registro')
                      : ((row as any).myGrade.resultNumeric ?? 'Sin registro')}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-sm font-semibold text-neutral-500">
                Aún no tenés resultado cargado.
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function GradeBox({ row }: { row: ExamModelRow }) {
  const [studentId, setStudentId] = useState('');
  const [students, setStudents] = useState<{ _id: string; name: string }[]>([]);
  const [num, setNum] = useState<string>('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  // última nota cargada por alumno en esta sesión
  const [lastGrades, setLastGrades] = useState<Record<string, string>>({});

  useEffect(() => {
    // roster del curso del modelo para validar permisos
    api.courses.teacher(String((row as any).course?._id || (row as any).course))
      .catch(() => ({ teacher: null }));

    const courseId = String((row as any).course?._id || (row as any).course);

    if (!courseId) return;

    api.courses.roster(courseId)
      .then(r => setStudents((r.roster || []).map((it: any) => ({
        _id: it.student?._id,
        name: it.student?.name,
      }))))
      .catch(() => setStudents([]));
  }, [row]);

  // si existe api.exams.getGrade, cuando cambio de alumno intento leer su nota guardada
  useEffect(() => {
    if (!studentId) return;
    if (lastGrades[studentId]) return;

    const anyApi = api as any;

    if (!anyApi.exams || !anyApi.exams.getGrade) return;

    (async () => {
      try {
        const g = await anyApi.exams.getGrade(row._id, { studentId });

        if (!g) return;

        const value =
          row.gradeType === 'PASS3'
            ? (g.resultPass3 ?? '')
            : (typeof g.resultNumeric === 'number' ? String(g.resultNumeric) : '');

        if (!value) return;

        setLastGrades((prev: Record<string, string>) => ({
          ...prev,
          [studentId]: value,
        }));
      } catch {
        // silencio
      }
    })();
  }, [studentId, row, lastGrades]);

  const flashSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const savePass3 = async (v: Pass3) => {
    if (!studentId) return;

    setSaving(true);

    try {
      await api.exams.setGrade(row._id, { studentId, resultPass3: v });

      setLastGrades(prev => ({
        ...prev,
        [studentId]: v,
      }));

      flashSaved();
    } catch (e: any) {
      window.alert(e?.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const saveNum = async () => {
    const n = Number(num);

    if (!studentId || !(n >= 1 && n <= 10)) return;

    setSaving(true);

    try {
      await api.exams.setGrade(row._id, { studentId, resultNumeric: n });

      setLastGrades(prev => ({
        ...prev,
        [studentId]: String(n),
      }));

      setNum('');
      flashSaved();
    } catch (e: any) {
      window.alert(e?.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const lastForStudent = studentId ? lastGrades[studentId] : undefined;

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="text-base font-black text-neutral-900">
            Carga de resultado
          </h4>
          <p className="text-sm text-neutral-500">
            Seleccioná un alumno y registrá su resultado.
          </p>
        </div>

        {saved && (
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-xs font-black text-emerald-700">
            <Check size={14} /> Guardado
          </span>
        )}
      </div>

      <label className="grid gap-2">
        <span className="text-sm font-black text-neutral-700">
          Alumno
        </span>

        <select
          className="min-h-[52px] w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-700 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
          value={studentId}
          onChange={e => setStudentId(e.target.value)}
        >
          <option value="">Seleccionar…</option>
          {students.map(s => (
            <option key={s._id} value={s._id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      {studentId && (
        <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-xs font-semibold text-neutral-600">
          {lastForStudent
            ? <>Última nota cargada para este alumno: <span className="font-black text-neutral-900">{lastForStudent}</span></>
            : 'Este alumno todavía no tiene nota cargada en esta sesión.'}
        </div>
      )}

      {row.gradeType === 'PASS3' ? (
        <div className="grid gap-2 sm:grid-cols-3">
          {(['PASS', 'BARELY_PASS', 'FAILED'] as Pass3[]).map(v => (
            <button
              key={v}
              className="min-h-[48px] w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-black uppercase tracking-wide text-neutral-700 shadow-sm transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => savePass3(v)}
              disabled={saving || !studentId}
            >
              {v}
            </button>
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
          <input
            className="min-h-[52px] w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-700 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
            type="number"
            min={1}
            max={10}
            value={num}
            onChange={e => setNum(e.target.value)}
            placeholder="1-10"
          />

          <button
            className="min-h-[52px] w-full rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-3 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-violet-200 transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
            onClick={saveNum}
            disabled={saving || !studentId}
          >
            {saving ? 'Guardando…' : 'Guardar nota'}
          </button>
        </div>
      )}
    </div>
  );
}


