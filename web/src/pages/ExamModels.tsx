// web/src/pages/ExamModels.tsx
import { useEffect, useMemo, useState } from 'react';
import { api, type ExamModelRow, type Pass3 } from '../lib/api';
import { useSearchParams } from 'react-router-dom';
import { ToggleLeft, ToggleRight, ExternalLink } from 'lucide-react';

type CourseOpt = { _id: string; name: string };

export default function ExamModels() {
  const [params, setParams] = useSearchParams();
  const courseId = params.get('course') || '';
  const [me, setMe] = useState<any>(null);
  const [courses, setCourses] = useState<CourseOpt[]>([]);
  const [rows, setRows] = useState<ExamModelRow[]>([]);
  const isStaff = me && ['teacher', 'coordinator', 'admin'].includes(me.role);

  useEffect(() => {
    api.me().then(r => setMe(r.user)).catch(() => setMe(null));
  }, []);

  useEffect(() => {
    // cursos del usuario (alumno o staff)
    if (!me) return;
    if (['teacher', 'coordinator', 'admin'].includes(me.role)) {
      // Para staff, podemos reutilizar list y/o tus vistas existentes.
      // Si ya tenés un endpoint específico, cambialo aquí.
      api.courses.list().then(r => setCourses(r.courses || [])).catch(() => setCourses([]));
    } else {
      api.courses.mine().then(r => setCourses(r.rows.map(x => x.course))).catch(() => setCourses([]));
    }
  }, [me]);

  useEffect(() => {
    if (!courseId) return;
    api.exams.listModels(courseId).then(setRows).catch(() => setRows([]));
  }, [courseId]);

  // si no hay curso en query, seleccionamos el primero disponible
  useEffect(() => {
    if (!courseId && courses.length) setParams({ course: courses[0]._id });
  }, [courses, courseId, setParams]);

  const grouped = useMemo(() => ({
    mid: rows.filter(r => r.category === 'MID_YEAR').sort((a, b) => a.number - b.number),
    end: rows.filter(r => r.category === 'END_YEAR').sort((a, b) => a.number - b.number),
  }), [rows]);

  return (
    <div className="container mx-auto p-4">
      <h1 className="title">Exámenes modelos</h1>

      {courses.length > 0 && (
        <div className="mb-4">
          <label className="block text-sm mb-1">Curso</label>
          <select
            value={courseId}
            onChange={e => setParams({ course: e.target.value })}
            className="select"
          >
            {courses.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
        </div>
      )}

      {isStaff && courseId && rows.length === 0 && (
        <button
          className="btn"
          onClick={() => api.exams.seedModels(courseId).then(() => api.exams.listModels(courseId).then(setRows))}
        >
          Crear modelos por defecto (6)
        </button>
      )}

      <Section title="Exámenes modelos - Mitad de año">
        {grouped.mid.map(m =>
          <ExamCard
            key={m._id}
            row={m}
            isStaff={isStaff}
            courseId={courseId}
            onChange={() => api.exams.listModels(courseId).then(setRows)}
          />
        )}
      </Section>

      <Section title="Exámenes modelos - Fin de año">
        {grouped.end.map(m =>
          <ExamCard
            key={m._id}
            row={m}
            isStaff={isStaff}
            courseId={courseId}
            onChange={() => api.exams.listModels(courseId).then(setRows)}
          />
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: any }) {
  return (
    <div className="mt-6">
      <h2 className="subtitle">{title}</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{children}</div>
    </div>
  );
}

function ExamCard({ row, isStaff, courseId, onChange }: {
  row: ExamModelRow; isStaff: boolean; courseId: string; onChange: () => void;
}) {
  const [studentId, setStudentId] = useState<string>('');
  const [students, setStudents] = useState<{ _id: string; name: string }[]>([]);
  const [driveUrl, setDriveUrl] = useState<string>(row.driveUrl || '');

  useEffect(() => {
    setDriveUrl(row.driveUrl || '');
  }, [row.driveUrl]);

  useEffect(() => {
    if (!isStaff || !courseId) return;
    // Reutilizamos roster del curso y mapeamos a alumnos
    api.courses.roster(courseId)
      .then(r => setStudents((r.roster || []).map((it: any) => ({ _id: it.student?._id, name: it.student?.name }))))
      .catch(() => setStudents([]));
  }, [isStaff, courseId]);

  const title = `${row.category === 'MID_YEAR' ? 'Mitad' : 'Final'} - Modelo ${row.number}`;
  const canOpen = !!row.driveUrl;

  return (
    <div className="card">
      <div className="flex justify-between items-center">
        <h3 className="card-title">{title}</h3>
        <a
          href={canOpen ? row.driveUrl : undefined}
          target="_blank"
          rel="noreferrer"
          className={`link inline-flex items-center gap-1 ${canOpen ? '' : 'opacity-40 pointer-events-none'}`}
          title={canOpen ? 'Abrir en Google Drive' : 'Sin link de Drive'}
        >
          Ver en Drive <ExternalLink size={16} />
        </a>
      </div>

      <p className="muted">Tipo: {row.gradeType === 'PASS3' ? 'PASS / BARELY_PASS / FAILED' : '1–10'}</p>

      {/* Vista Alumno: muestra su resultado si existe */}
      {!isStaff && row.myGrade && (
        <div className="badge mt-2">
          {row.gradeType === 'PASS3'
            ? (row.myGrade.resultPass3 ?? 'Sin registro')
            : (row.myGrade.resultNumeric ?? 'Sin registro')}
        </div>
      )}

      {/* Vista Staff: controles */}
      {isStaff && (
        <>
          <div className="mt-3 flex gap-2 items-center">
            <input
              className="input flex-1"
              placeholder="Link de Google Drive"
              value={driveUrl}
              onChange={e => setDriveUrl(e.target.value)}
              onBlur={() => {
                if (driveUrl !== (row.driveUrl || '')) {
                  api.exams.updateModel(row._id, { driveUrl }).then(onChange).catch(() => {});
                }
              }}
            />
            <button
              className="btn"
              onClick={() => api.exams.updateModel(row._id, { visible: !row.visible }).then(onChange)}
              title={row.visible ? 'Ocultar a alumnos' : 'Habilitar para alumnos'}
            >
              {row.visible ? <ToggleRight /> : <ToggleLeft />} {row.visible ? 'Visible' : 'Oculto'}
            </button>
          </div>

          <div className="mt-3">
            <label className="block text-sm mb-1">Asignar nota a un alumno</label>
            <select className="select" value={studentId} onChange={e => setStudentId(e.target.value)}>
              <option value="">Seleccionar alumno…</option>
              {students.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>

            {row.gradeType === 'PASS3' ? (
              <div className="mt-2 flex gap-2 flex-wrap">
                {(['PASS', 'BARELY_PASS', 'FAILED'] as Pass3[]).map(v => (
                  <button
                    key={v}
                    className="btn"
                    onClick={() => studentId && api.exams.setGrade(row._id, { studentId, resultPass3: v }).then(onChange)}
                  >
                    {v}
                  </button>
                ))}
              </div>
            ) : (
              <NumericGrade onSave={(n) => {
                if (!studentId) return;
                api.exams.setGrade(row._id, { studentId, resultNumeric: n }).then(onChange);
              }}/>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function NumericGrade({ onSave }: { onSave: (n: number) => void }) {
  const [val, setVal] = useState<string>('');
  return (
    <div className="mt-2 flex gap-2 items-center">
      <input
        type="number"
        min={1}
        max={10}
        className="input w-24"
        placeholder="1-10"
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { const n = Number(val); if (n >= 1 && n <= 10) onSave(n); } }}
      />
      <button
        className="btn"
        onClick={() => { const n = Number(val); if (n >= 1 && n <= 10) onSave(n); }}
      >
        Guardar
      </button>
    </div>
  );
}

