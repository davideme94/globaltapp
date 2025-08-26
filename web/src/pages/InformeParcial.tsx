import { useEffect, useMemo, useState } from 'react';
import { getMe, type Me } from '../lib/api';
import { getMyCourses, type TeacherCourse } from '../lib/teacher';
import { getEnrollmentsByCourse, type Enrollment } from '../lib/enrollments';
import { listPartialReports, upsertPartialReport, type PartialReport, type GradeLetter } from '../lib/partials';

// --------- util ----------
function currentYear() { return new Date().getFullYear(); }
const G: GradeLetter[] = ['A','B','C','D','E'];
function studentIdOf(en: Enrollment): string {
  const s: any = en.student;
  return (typeof s === 'string') ? s : (s?._id || '');
}
function studentLabelOf(en: Enrollment): string {
  const s: any = en.student;
  if (typeof s === 'string') return s;
  return s?.name || s?.email || s?._id || '';
}

// extrae datos del curso (populado o id)
function courseNameOf(r?: PartialReport): string | undefined {
  const c: any = r?.course;
  if (!c) return undefined;
  return typeof c === 'string' ? c : (c.name || c._id);
}
function courseTeacherNameOf(r?: PartialReport): string | undefined {
  const c: any = r?.course;
  if (!c) return undefined;
  if (typeof c === 'string') return undefined;
  const t = c.teacher as any;
  if (!t) return undefined;
  return typeof t === 'string' ? t : (t.name || t._id);
}

// --------- tarjeta del alumno (vista bonita) ----------
function TarjetaInforme({
  studentName,
  teacherName,
  levelName,
  period,
  report
}: {
  studentName: string;
  teacherName?: string;
  levelName?: string;
  period: 'MAYO'|'OCTUBRE';
  report?: PartialReport;
}) {
  const grades = report?.grades || {};
  const row = (label: string, value?: string) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', borderBottom: '1px solid #eaeaea' }}>
      <span style={{ fontWeight: 600 }}>{label}</span>
      <span style={{ fontWeight: 700 }}>{value || '-'}</span>
    </div>
  );

  return (
    <div style={{ background: '#f9fbff', borderRadius: 16, boxShadow: '0 1px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
      <div style={{ background: '#4876ff', color: 'white', padding: 16, textAlign: 'center', fontWeight: 800, letterSpacing: 1 }}>
        GLOBAL-T — INFORME PARCIAL ({period})
      </div>

      <div style={{ padding: 14, display: 'grid', gap: 10 }}>
        {/* encabezado */}
        <div style={{ background: '#fff', borderRadius: 12, padding: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'grid', gap: 8 }}>
            <div><b>Nombre:</b> <span style={{ fontWeight: 700 }}>{studentName}</span></div>
            <div><b>Profesor:</b> <span style={{ fontWeight: 700 }}>{teacherName || '—'}</span></div>
            <div><b>Nivel:</b> <span style={{ fontWeight: 700 }}>{levelName || '—'}</span></div>
          </div>
        </div>

        {/* Grades */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ padding: '10px 12px', fontWeight: 800 }}>Grades</div>
            {row('Reading', grades.reading)}
            {row('Writing', grades.writing)}
            {row('Listening', grades.listening)}
            {row('Speaking', grades.speaking)}
            {row('Attendance', grades.attendance)}
            {row('Commitment', grades.commitment)}
          </div>
          <div style={{ background: '#fff', borderRadius: 12, padding: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Grading system</div>
            <ul style={{ margin: 0, paddingLeft: 16, lineHeight: 1.6 }}>
              <li>A = 90 – 100</li>
              <li>B = 80 – 89</li>
              <li>C = 70 – 79</li>
              <li>D = 60 – 69</li>
              <li>E = 0 – 59</li>
            </ul>
          </div>
        </div>

        {/* Comments */}
        <div style={{ background: '#fff', borderRadius: 12, padding: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Comments</div>
          <div style={{ whiteSpace: 'pre-wrap', minHeight: 80 }}>
            {report?.text?.trim() ? report.text : '—'}
          </div>
        </div>
      </div>
    </div>
  );
}

// --------- página principal ----------
export default function InformeParcialPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [loadingMe, setLoadingMe] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selects curso/alumno/periodo
  const [myCourses, setMyCourses] = useState<TeacherCourse[]>([]);
  const [courseId, setCourseId] = useState('');
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [studentId, setStudentId] = useState('');
  const [period, setPeriod] = useState<'MAYO'|'OCTUBRE'>('MAYO');

  // Listado de informes del curso+periodo
  const [items, setItems] = useState<PartialReport[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  // Estado de edición por alumno (docente)
  type RowState = {
    text: string;
    grades: PartialReport['grades'];
    saving?: boolean;
  };
  const [rows, setRows] = useState<Record<string, RowState>>({}); // key: studentId

  useEffect(() => {
    setLoadingMe(true);
    getMe().then(setMe).catch((e) => setError(e.message)).finally(() => setLoadingMe(false));
  }, []);

  const isTeacher = me?.role === 'teacher';
  const isStudent = me?.role === 'student';
  const canEdit = me && (me.role === 'teacher' || me.role === 'coordinator' || me.role === 'admin');

  // Cursos del docente
  useEffect(() => {
    if (isTeacher) {
      getMyCourses().then(cs => {
        setMyCourses(cs);
        if (cs[0]?._id) setCourseId(cs[0]._id);
      }).catch(e => setError(e.message));
    }
  }, [isTeacher]);

  // Alumnos del curso
  useEffect(() => {
    if (!courseId) { setEnrollments([]); setStudentId(''); return; }
    getEnrollmentsByCourse(courseId).then(rows => {
      setEnrollments(rows);
      if (rows[0]) setStudentId(studentIdOf(rows[0]));
    }).catch(e => setError(e.message));
  }, [courseId]);

  // Traer informes existentes (del curso+periodo) y preparar estado por alumno
  const refresh = async () => {
    setLoadingList(true);
    try {
      const params: any = { year: currentYear(), period };
      if (courseId) params.courseId = courseId;
      if (isStudent) params.studentId = me?.id;

      const { partialReports } = await listPartialReports(params);
      setItems(partialReports);

      if (isTeacher && enrollments.length) {
        const map: Record<string, RowState> = {};
        for (const en of enrollments) {
          const sid = studentIdOf(en);
          const existing = partialReports.find(r => r.student === sid);
          map[sid] = {
            text: existing?.text || '',
            grades: { ...(existing?.grades || {}) }
          };
        }
        setRows(map);
      }
    } catch (e: any) { setError(e.message || 'Error al listar'); }
    finally { setLoadingList(false); }
  };
  useEffect(() => { if (me) refresh(); /* eslint-disable-next-line */ }, [me, courseId, period]);

  // Guardar una fila (docente)
  const saveRow = async (sid: string) => {
    setRows(prev => ({ ...prev, [sid]: { ...prev[sid], saving: true } }));
    try {
      const r = rows[sid];
      await upsertPartialReport({
        studentId: sid,
        courseId,
        year: currentYear(),
        period,
        text: r.text,
        grades: r.grades
      });
      await refresh();
    } catch (e: any) { setError(e.message || 'Error al guardar'); }
    finally { setRows(prev => ({ ...prev, [sid]: { ...prev[sid], saving: false } })); }
  };

  // Helpers UI docente
  const setGrade = (sid: string, key: keyof NonNullable<PartialReport['grades']>, val: GradeLetter) =>
    setRows(prev => ({ ...prev, [sid]: { ...prev[sid], grades: { ...(prev[sid]?.grades||{}), [key]: val } } }));

  const setComment = (sid: string, text: string) =>
    setRows(prev => ({ ...prev, [sid]: { ...prev[sid], text } }));

  if (loadingMe) return <div style={{ padding: 16 }}>Cargando...</div>;
  if (error) return <div style={{ padding: 16, color: 'crimson' }}>Error: {error}</div>;
  if (!me) return <div style={{ padding: 16 }}>No logueado</div>;

  // ----- UI ALUMNO: tarjeta única -----
  if (isStudent) {
    const report = items.find(r => r.period === period); // del año actual
    const teacherName = courseTeacherNameOf(report);
    const levelName = courseNameOf(report);
    return (
      <div style={{ maxWidth: 900, margin: '0 auto', padding: 16 }}>
        <h2>Informe parcial</h2>
        <div style={{ marginBottom: 10 }}>
          <label>Período:&nbsp;</label>
          <select value={period} onChange={e => setPeriod(e.target.value as any)}>
            <option value="MAYO">Mayo</option>
            <option value="OCTUBRE">Octubre</option>
          </select>
          <button onClick={refresh} style={{ marginLeft: 8 }} disabled={loadingList}>Refrescar</button>
        </div>
        <TarjetaInforme
          studentName={me.name}
          teacherName={teacherName}
          levelName={levelName}
          period={period}
          report={report}
        />
      </div>
    );
  }

  // ----- UI DOCENTE/COORD/ADMIN -----
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 16 }}>
      <h2>Informe parcial</h2>

      <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {isTeacher ? (
            <>
              <div>
                <label>Curso:&nbsp;</label>
                <select value={courseId} onChange={e => setCourseId(e.target.value)}>
                  {myCourses.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label>Período:&nbsp;</label>
                <select value={period} onChange={e => setPeriod(e.target.value as any)}>
                  <option value="MAYO">Mayo</option>
                  <option value="OCTUBRE">Octubre</option>
                </select>
              </div>
              <button onClick={refresh} disabled={!courseId || loadingList}>Refrescar</button>
            </>
          ) : (
            <>
              <input placeholder="Course ID" value={courseId} onChange={e => setCourseId(e.target.value)} />
              <div>
                <label>Período:&nbsp;</label>
                <select value={period} onChange={e => setPeriod(e.target.value as any)}>
                  <option value="MAYO">Mayo</option>
                  <option value="OCTUBRE">Octubre</option>
                </select>
              </div>
              <button onClick={refresh} disabled={!courseId || loadingList}>Refrescar</button>
            </>
          )}
        </div>
      </div>

      {/* Tabla de alumnos */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f6f8fb' }}>
              <th style={th}>Alumno</th>
              {['Reading','Writing','Listening','Speaking','Attendance','Commitment'].map(h => <th key={h} style={th}>{h}</th>)}
              <th style={th}>Comentarios</th>
              {canEdit && <th style={th}></th>}
            </tr>
          </thead>
          <tbody>
            {enrollments.map(en => {
              const sid = studentIdOf(en);
              const label = studentLabelOf(en);
              const state = rows[sid] || { text: '', grades: {} };
              return (
                <tr key={sid}>
                  <td style={td}>{label}</td>
                  {(['reading','writing','listening','speaking','attendance','commitment'] as const).map(k => (
                    <td key={k} style={td}>
                      <select value={state.grades?.[k] || ''} onChange={e => setGrade(sid, k, e.target.value as GradeLetter)}>
                        <option value="">—</option>
                        {G.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </td>
                  ))}
                  <td style={{ ...td, minWidth: 260 }}>
                    <textarea
                      rows={2}
                      value={state.text}
                      onChange={e => setComment(sid, e.target.value)}
                      placeholder="Comentarios…"
                      style={{ width: '100%' }}
                    />
                  </td>
                  {canEdit && (
                    <td style={td}>
                      <button onClick={() => saveRow(sid)} disabled={!courseId || rows[sid]?.saving}>
                        {rows[sid]?.saving ? 'Guardando…' : 'Guardar'}
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
            {enrollments.length === 0 && (
              <tr><td colSpan={9} style={{ ...td, textAlign: 'center' }}>No hay alumnos para este curso.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Vista previa para un alumno seleccionado (opcional) */}
      {studentId && (
        <div style={{ marginTop: 18 }}>
          <h3>Vista del alumno seleccionado</h3>
          <TarjetaInforme
            studentName={studentLabelOf(enrollments.find(e => studentIdOf(e) === studentId) as Enrollment) || '—'}
            teacherName={me?.name}
            levelName={myCourses.find(c => c._id === courseId)?.name}
            period={period}
            report={items.find(r => r.student === studentId)}
          />
        </div>
      )}
    </div>
  );
}

const th: React.CSSProperties = { border: '1px solid #eee', padding: 8, textAlign: 'left', fontWeight: 700, whiteSpace: 'nowrap' };
const td: React.CSSProperties = { border: '1px solid #eee', padding: 8, verticalAlign: 'top' };
