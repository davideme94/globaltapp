import { useEffect, useMemo, useState } from 'react';
import { getMe, type Me } from '../lib/api';
import { getMyCourses, type TeacherCourse } from '../lib/teacher';
import { listCourses, type Course } from '../lib/courses';
import { getEnrollmentsByCourse, type Enrollment } from '../lib/enrollments';
import {
  listReportCards,
  upsertReportCard,
  setReportClosed,
  type ReportCard,
  type Campus,
  type TrimBlock
} from '../lib/reportCards';

function currentYear() { return new Date().getFullYear(); }
const campusName: Record<Campus, string> = { DERQUI: 'Derqui', JOSE_C_PAZ: 'José C. Paz' };

function studentIdOf(en: Enrollment) { const s: any = en.student; return typeof s === 'string' ? s : (s?._id || ''); }
function studentLabelOf(en: Enrollment) { const s: any = en.student; return typeof s === 'string' ? s : (s?.name || s?.email || s?._id || ''); }

function courseNameOf(r?: ReportCard) { const c: any = r?.course; return !c ? undefined : (typeof c === 'string' ? c : (c.name || c._id)); }
function teacherNameOf(r?: ReportCard) {
  const c: any = r?.course; if (!c || typeof c === 'string') return undefined;
  const t: any = c.teacher; return !t ? undefined : (typeof t === 'string' ? t : (t.name || t._id));
}
function campusFrom(r?: ReportCard): Campus | undefined {
  if (r?.campus) return r.campus;
  const c: any = r?.course;
  if (!c || typeof c === 'string') return undefined;
  return c.campus as Campus | undefined;
}

/** =================== Tarjeta imprimible (2 páginas) estilo Derqui/JCP =================== */
function PrintableCard({
  studentName,
  courseName,
  teacherName,
  campus,
  year,
  coverImageUrl,
  rc
}: {
  studentName: string;
  courseName?: string;
  teacherName?: string;
  campus: Campus;
  year: number;
  coverImageUrl?: string;
  rc?: ReportCard;
}) {
  const color = campus === 'DERQUI' ? '#5ac6ff' : '#6bd3ff';
  const border = '#1f2937';
  const T = (t?: TrimBlock, k: keyof TrimBlock) => (t && t[k] != null ? t[k] : '');

  return (
    <div id="print-wrap" style={{ fontFamily: 'system-ui,Segoe UI,Roboto,Arial', color: '#111', lineHeight: 1.25 }}>
      <style>{`
        @media print {
          body > *:not(#print-wrap) { display:none !important; }
          #print-wrap { display:block !important; }
          @page { margin: 10mm; }
        }
      `}</style>

      {/* Página 1 */}
      <div style={{ pageBreakAfter: 'always', padding: '18px 18px 0', border: `1px solid ${border}`, margin: '12px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', borderBottom: `1px solid ${border}` }}>
          <div style={{ background: color, padding: '12px 16px' }}>
            {/* Si tenés logo local, reemplazá por tu URL */}
            <img src="https://i.imgur.com/0M9c5dX.png" alt="Global-T" style={{ height: 48 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, fontWeight: 800 }}>
            {year}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', minHeight: 420, borderBottom: `1px solid ${border}` }}>
          <div style={{ padding: 16 }}>
            <img
              src={coverImageUrl || 'https://upload.wikimedia.org/wikipedia/commons/9/9a/Westminster_Palace_and_River_Thames.jpg'}
              alt="Portada"
              style={{ width: '100%', height: 360, objectFit: 'cover', border: '1px solid #ccc' }}
            />
          </div>
          <div style={{ background: color, padding: 24, display: 'flex', alignItems: 'center' }}>
            <div style={{ fontSize: 36, fontWeight: 900 }}>
              Instituto<br />Educativo<br />Global-T
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', alignItems: 'stretch' }}>
          <div style={{ background: color, padding: '12px 16px', fontWeight: 800, textAlign: 'center', borderRight: `1px solid ${border}` }}>
            Ficha de Informe
          </div>
          <div style={{ padding: '10px 12px' }}>
            <div><b>Alumno:</b> {studentName}</div>
            <div><b>Curso:</b> {courseName || '—'}</div>
          </div>
        </div>

        <div style={{ padding: '10px 12px', background: color, borderTop: `1px solid ${border}` }}>
          <div style={{ fontSize: 12, fontWeight: 800 }}>
            {campus === 'DERQUI'
              ? <>Instituto Educativo Global-T · Eva Perón 795 · Derqui — Cel: 1153875334</>
              : <>Instituto Educativo Global-T · Granaderos A Caballo 4896 · José C. Paz — Cel: 1553875273</>}
          </div>
        </div>
      </div>

      {/* Página 2 */}
      <div style={{ pageBreakAfter: 'always', padding: '12px', margin: '12px', border: `1px solid ${border}` }}>
        <div style={{ fontSize: 14, fontWeight: 700, margin: '6px 0' }}>
          Profesor: {teacherName || '—'} &nbsp;&nbsp; Alumno: {studentName}
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th(border)}></th>
              <th style={th(border)}>Primer Trimestre<br /><small>(Mar/Abr/May)</small></th>
              <th style={th(border)}>Segundo Trimestre<br /><small>(Jun/Jul/Ago)</small></th>
              <th style={th(border)}>Tercer Trimestre<br /><small>(Sep/Oct/Nov/Dic)</small></th>
              <th style={th(border)}>Promedio</th>
            </tr>
          </thead>
          <tbody>
            {(['writing', 'speaking', 'reading', 'listening'] as const).map((k) => {
              const labels: Record<keyof TrimBlock, string> = {
                writing: 'Writing (escrito)',
                speaking: 'Speaking (oral)',
                reading: 'Reading (leer)',
                listening: 'Listening (escuchar)',
              };
              const v1 = T(rc?.trimesters?.t1, k);
              const v2 = T(rc?.trimesters?.t2, k);
              const v3 = T(rc?.trimesters?.t3, k);
              const vals = [v1, v2, v3].map(Number).filter(n => !Number.isNaN(n));
              const avg = vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : '';
              return (
                <tr key={k}>
                  <td style={td(border, true)}>{labels[k]}</td>
                  <td style={td(border)}>{v1}</td>
                  <td style={td(border)}>{v2}</td>
                  <td style={td(border)}>{v3}</td>
                  <td style={td(border)}><b>{avg as any}</b></td>
                </tr>
              );
            })}
            <tr><td style={td(border, true)} colSpan={5}></td></tr>
            <tr>
              <td style={td(border, true)}><b>Observaciones</b></td>
              <td style={td(border)} colSpan={4}>{rc?.notes || ''}</td>
            </tr>
            <tr>
              <td style={td(border, true)}><b>Exámenes</b></td>
              <td style={td(border)} colSpan={2}>Oral: {rc?.finals?.oral ?? ''}</td>
              <td style={td(border)} colSpan={2}>Escrito: {rc?.finals?.written ?? ''}</td>
            </tr>
            <tr>
              <td style={td(border, true)}><b>Firmas</b></td>
              <td style={td(border)} colSpan={2}>Firma del Alumno: _______________________</td>
              <td style={td(border)} colSpan={2}>Firma del Tutor: _________________________</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

const th = (b: string) => ({ border: `1px solid ${b}`, padding: '8px', background: '#f3f4f6', textAlign: 'center' } as React.CSSProperties);
const td = (b: string, left = false) => ({ border: `1px solid ${b}`, padding: '8px', textAlign: left ? 'left' : 'center', verticalAlign: 'middle' } as React.CSSProperties);

/** =================== Página principal =================== */
export default function ReportCardPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [loadingMe, setLoadingMe] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [teacherCourses, setTeacherCourses] = useState<TeacherCourse[]>([]);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState('');
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [items, setItems] = useState<ReportCard[]>([]);
  const [year, setYear] = useState(currentYear());
  const [loading, setLoading] = useState(false);

  type Row = {
    t1?: TrimBlock; t2?: TrimBlock; t3?: TrimBlock;
    finals?: { oral?: number; written?: number };
    notes?: string; reportId?: string; closed?: boolean; campus?: Campus;
    saving?: boolean;
  };
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [printFor, setPrintFor] = useState<string>(''); // studentId para imprimir
  const [coverUrl, setCoverUrl] = useState<string>(''); // portada

  useEffect(() => {
    setLoadingMe(true);
    getMe().then(setMe).catch(e => setError(e.message)).finally(() => setLoadingMe(false));
  }, []);

  const isCoord = me?.role === 'coordinator';
  const isTeacher = me?.role === 'teacher';
  const isStudent = me?.role === 'student';

  useEffect(() => {
    if (isTeacher) getMyCourses().then(setTeacherCourses).catch(e => setError(e.message));
    if (isCoord) listCourses({ year }).then(setAllCourses).catch(e => setError(e.message));
  }, [isTeacher, isCoord, year]);

  useEffect(() => {
    if (!courseId) { setEnrollments([]); return; }
    getEnrollmentsByCourse(courseId).then(setEnrollments).catch(e => setError(e.message));
  }, [courseId]);

  const refresh = async () => {
    setLoading(true);
    try {
      const { reportCards } = await listReportCards({ courseId: courseId || undefined, year });
      setItems(reportCards);
      const map: Record<string, Row> = {};
      for (const en of enrollments) {
        const sid = studentIdOf(en);
        const rc = reportCards.find(r => {
          const st: any = r.student;
          return (typeof st === 'string' ? st : st._id) === sid;
        });
        map[sid] = {
          t1: rc?.trimesters?.t1, t2: rc?.trimesters?.t2, t3: rc?.trimesters?.t3,
          finals: rc?.finals, notes: rc?.notes || '', reportId: rc?._id, closed: rc?.closed,
          campus: (rc?.campus || (typeof (rc?.course) !== 'string' ? (rc?.course as any)?.campus : undefined)) as Campus | undefined
        };
      }
      setRows(map);
    } catch (e: any) { setError(e.message || 'Error'); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (me && courseId) refresh(); /* eslint-disable-next-line */ }, [me, courseId, year]);

  const canSave = useMemo(() => isCoord || isTeacher, [isCoord, isTeacher]);

  const saveRow = async (sid: string) => {
    if (!canSave) return;
    const r = rows[sid]; if (!r) return;
    if (r.closed) { alert('Boletín cerrado'); return; }
    setRows(p => ({ ...p, [sid]: { ...p[sid], saving: true } }));
    try {
      await upsertReportCard({
        studentId: sid, courseId, year,
        campus: r.campus,
        t1: r.t1, t2: r.t2, t3: r.t3,
        finals: r.finals, notes: r.notes
      });
      await refresh();
    } catch (e: any) { setError(e.message || 'Error al guardar'); }
    finally { setRows(p => ({ ...p, [sid]: { ...p[sid], saving: false } })); }
  };

  const toggleClosed = async (sid: string) => {
    const r = rows[sid]; if (!r?.reportId) return;
    try { await setReportClosed(r.reportId, !r.closed); await refresh(); }
    catch (e: any) { setError(e.message || 'Error al cerrar/abrir'); }
  };

  if (loadingMe) return <div style={{ padding: 16 }}>Cargando...</div>;
  if (error) return <div style={{ padding: 16, color: 'crimson' }}>Error: {error}</div>;
  if (!me) return <div style={{ padding: 16 }}>No logueado</div>;

  // ---------- Vista alumno: imprime su propio boletín ----------
  if (isStudent) {
    const rc = items[0];
    const campus = (rc?.campus || campusFrom(rc) || 'DERQUI') as Campus;
    return (
      <div style={{ maxWidth: 950, margin: '0 auto', padding: 16 }}>
        <h2>Boletín Global-T</h2>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <button onClick={() => window.print()}>Imprimir / PDF</button>
          <input placeholder="URL de imagen portada (opcional)" value={coverUrl} onChange={e => setCoverUrl(e.target.value)} style={{ flex: 1 }} />
        </div>
        <PrintableCard
          studentName={me.name}
          courseName={courseNameOf(rc)}
          teacherName={teacherNameOf(rc)}
          campus={campus}
          year={rc?.year || year}
          coverImageUrl={coverUrl || undefined}
          rc={rc}
        />
      </div>
    );
  }

  // ---------- Vista Docente / Coordinador ----------
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 16 }}>
      <h2>Boletín Global-T</h2>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <div>
          <label>Año:&nbsp;</label>
          <input type="number" value={year} onChange={e => setYear(Number(e.target.value) || currentYear())} style={{ width: 100 }} />
        </div>
        {isCoord ? (
          <div>
            <label>Curso:&nbsp;</label>
            <select value={courseId} onChange={e => setCourseId(e.target.value)}>
              <option value="">(elegí)</option>
              {allCourses.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
        ) : (
          <div>
            <label>Curso (tuyo):&nbsp;</label>
            <select value={courseId} onChange={e => setCourseId(e.target.value)}>
              <option value="">(elegí)</option>
              {teacherCourses.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
        )}
        <button onClick={refresh} disabled={!courseId || loading}>Refrescar</button>

        <div style={{ marginLeft: 'auto' }}>
          <label>Imagen portada (URL):&nbsp;</label>
          <input placeholder="https://..." value={coverUrl} onChange={e => setCoverUrl(e.target.value)} style={{ width: 300 }} />
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#f6f8fb' }}>
              <th style={th('#ddd')}>Alumno</th>
              <th style={th('#ddd')}>Sede</th>
              {['T1 W', 'T1 S', 'T1 R', 'T1 L', 'T2 W', 'T2 S', 'T2 R', 'T2 L', 'T3 W', 'T3 S', 'T3 R', 'T3 L'].map(h => <th key={h} style={th('#ddd')}>{h}</th>)}
              <th style={th('#ddd')}>Final Oral</th>
              <th style={th('#ddd')}>Final Escrito</th>
              <th style={th('#ddd')}>Obs.</th>
              <th style={th('#ddd')}>Estado</th>
              <th style={th('#ddd')}></th>
              <th style={th('#ddd')}></th>
            </tr>
          </thead>
          <tbody>
            {enrollments.map(en => {
              const sid = studentIdOf(en);
              const label = studentLabelOf(en);
              const r = rows[sid] || {};
              const setTrim = (tri: 't1' | 't2' | 't3', key: keyof TrimBlock, val: string) => {
                const num = val === '' ? undefined : Number(val);
                setRows(p => ({ ...p, [sid]: { ...p[sid], [tri]: { ...(p[sid]?.[tri] || {}), [key]: num } } }));
              };
              return (
                <tr key={sid}>
                  <td style={td('#ddd', true)}>{label}</td>
                  <td style={td('#ddd')}>
                    <select value={r.campus || ''} onChange={e => setRows(p => ({ ...p, [sid]: { ...p[sid], campus: e.target.value as Campus } }))} disabled={r.closed}>
                      <option value="">(auto)</option>
                      <option value="DERQUI">Derqui</option>
                      <option value="JOSE_C_PAZ">José C. Paz</option>
                    </select>
                  </td>
                  {(['t1', 't2', 't3'] as const).flatMap(tri =>
                    (['writing', 'speaking', 'reading', 'listening'] as const).map(k => (
                      <td key={`${sid}-${tri}-${k}`} style={td('#ddd')}>
                        <input
                          type="number" min={0} max={10}
                          value={(r[tri]?.[k] ?? '') as any}
                          onChange={e => setTrim(tri, k, e.target.value)}
                          disabled={r.closed}
                          style={{ width: 60 }}
                        />
                      </td>
                    ))
                  )}
                  <td style={td('#ddd')}>
                    <input
                      type="number" min={0} max={10} style={{ width: 60 }}
                      value={r.finals?.oral ?? ''}
                      onChange={e => setRows(p => ({ ...p, [sid]: { ...p[sid], finals: { ...(p[sid]?.finals || {}), oral: e.target.value === '' ? undefined : Number(e.target.value) } } }))}
                      disabled={r.closed}
                    />
                  </td>
                  <td style={td('#ddd')}>
                    <input
                      type="number" min={0} max={10} style={{ width: 60 }}
                      value={r.finals?.written ?? ''}
                      onChange={e => setRows(p => ({ ...p, [sid]: { ...p[sid], finals: { ...(p[sid]?.finals || {}), written: e.target.value === '' ? undefined : Number(e.target.value) } } }))}
                      disabled={r.closed}
                    />
                  </td>
                  <td style={{ ...td('#ddd'), minWidth: 220 }}>
                    <textarea
                      rows={2} style={{ width: '100%' }}
                      value={r.notes || ''}
                      onChange={e => setRows(p => ({ ...p, [sid]: { ...p[sid], notes: e.target.value } }))}
                      disabled={r.closed}
                    />
                  </td>
                  <td style={td('#ddd')}>{r.closed ? 'Cerrado' : 'Abierto'}</td>
                  <td style={td('#ddd')}>
                    <button onClick={() => saveRow(sid)} disabled={!canSave || r.saving || r.closed}>
                      {r.saving ? 'Guardando…' : 'Guardar'}
                    </button>
                    {isCoord && r.reportId && (
                      <button onClick={() => toggleClosed(sid)} style={{ marginLeft: 6 }}>
                        {r.closed ? 'Reabrir' : 'Cerrar'}
                      </button>
                    )}
                  </td>
                  <td style={td('#ddd')}>
                    <button onClick={() => setPrintFor(sid)} disabled={!rows[sid]}>
                      Imprimir
                    </button>
                  </td>
                </tr>
              );
            })}
            {enrollments.length === 0 && (
              <tr><td colSpan={18} style={{ ...td('#ddd'), textAlign: 'center' }}>Elegí un curso.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Vista imprimible para un alumno seleccionado */}
      {printFor && (
        <div style={{ marginTop: 18 }}>
          <h3>Vista imprimible — {studentLabelOf(enrollments.find(e => studentIdOf(e) === printFor) as Enrollment) || 'Alumno'}</h3>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <button onClick={() => window.print()}>Imprimir / PDF</button>
            <button onClick={() => setPrintFor('')}>Cerrar vista</button>
            <select
              value={(rows[printFor]?.campus || campusFrom(items.find(r => {
                const st: any = r.student; return (typeof st === 'string' ? st : st._id) === printFor;
              }) || undefined) || 'DERQUI') as Campus}
              onChange={e => setRows(p => ({ ...p, [printFor]: { ...p[printFor], campus: e.target.value as Campus } }))}
            >
              <option value="DERQUI">Derqui</option>
              <option value="JOSE_C_PAZ">José C. Paz</option>
            </select>
            <input placeholder="URL de imagen portada (opcional)" value={coverUrl} onChange={e => setCoverUrl(e.target.value)} style={{ flex: 1 }} />
          </div>
          {(() => {
            const rc = items.find(r => {
              const st: any = r.student; return (typeof st === 'string' ? st : st._id) === printFor;
            });
            const campus = (rows[printFor]?.campus || campusFrom(rc) || 'DERQUI') as Campus;
            return (
              <PrintableCard
                studentName={studentLabelOf(enrollments.find(e => studentIdOf(e) === printFor) as Enrollment) || 'Alumno'}
                courseName={courseNameOf(rc)}
                teacherName={teacherNameOf(rc)}
                campus={campus}
                year={rc?.year || year}
                coverImageUrl={coverUrl || undefined}
                rc={rc}
              />
            );
          })()}
        </div>
      )}
    </div>
  );
}
