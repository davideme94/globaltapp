import { useEffect, useMemo, useState } from 'react';
import { api, type Course, type Campus as ApiCampus } from '../lib/api'; // ⬅️ alias para evitar choque
import SuggestInput, { type Option } from './SuggestInput';

// Campus local: extiende el del backend con 'ALL'
type Campus = ApiCampus | 'ALL';

export default function CourseAndStudentPicker({
  mode = 'course',              // 'course' | 'student'
  year = new Date().getFullYear(),
  onPickCourse,
  onPickStudent,
}:{
  mode?: 'course'|'student';
  year?: number;
  onPickCourse?: (course: { _id:string; name:string; campus: ApiCampus }) => void; // campus real del curso
  onPickStudent?: (student: { _id:string; name:string; email?:string }) => void;
}) {
  const [campus, setCampus] = useState<Campus>('ALL');

  // --- curso ---
  const [courseQuery, setCourseQuery] = useState('');
  const [courseOpts, setCourseOpts] = useState<Option[]>([]);
  const [courseId, setCourseId] = useState('');
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [courseMap, setCourseMap] = useState<Record<string, Course>>({}); // id → Course

  // --- alumno ---
  const [studentQuery, setStudentQuery] = useState('');
  const [studentOpts, setStudentOpts] = useState<Option[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentMap, setStudentMap] = useState<Record<string, { _id:string; name:string; email?:string }>>({}); // id → student

  // buscar cursos por nombre + campus
  useEffect(() => {
    const q = courseQuery.trim().toLowerCase();
    if (!q) { setCourseOpts([]); setCourseMap({}); return; }

    setLoadingCourses(true);
    (async () => {
      try {
        const filters = campus === 'ALL'
          ? { year }
          : { year, campus: campus as ApiCampus }; // tipado correcto para la API

        const res = await api.courses.list(filters);
        const rows = res.courses || [];
        const filtered = rows.filter((c:Course) =>
          (c.name || '').toLowerCase().includes(q)
        );

        // opciones para el desplegable
        const opts: Option[] = filtered.map((c:Course) => ({
          value: c._id,
          label: `${c.name} · ${c.campus === 'DERQUI' ? 'Derqui' : 'José C. Paz'}`,
        }));

        // mapa id → curso real (para obtener campus real al confirmar)
        const nextMap: Record<string, Course> = {};
        filtered.forEach((c) => { nextMap[c._id] = c; });

        setCourseOpts(opts);
        setCourseMap(nextMap);
      } finally {
        setLoadingCourses(false);
      }
    })();
  }, [courseQuery, campus, year]);

  // buscar alumnos del curso por nombre/email
  useEffect(() => {
    const q = studentQuery.trim().toLowerCase();
    if (!q || !courseId || mode !== 'student') { setStudentOpts([]); setStudentMap({}); return; }

    setLoadingStudents(true);
    (async () => {
      try {
        const r = await api.courses.roster(courseId);
        const students = (r.roster || [])
          .map((it:any) => it.student)
          .filter(Boolean);

        const matched = students.filter((s:any) =>
          (`${s.name || ''} ${s.email || ''}`).toLowerCase().includes(q)
        );

        const opts: Option[] = matched.map((s:any) => ({
          value: s._id,
          label: `${s.name}${s.email ? ` · ${s.email}` : ''}`,
        }));

        const nextMap: Record<string, { _id:string; name:string; email?:string }> = {};
        matched.forEach((s:any) => { nextMap[s._id] = { _id:s._id, name:s.name, email:s.email }; });

        setStudentOpts(opts);
        setStudentMap(nextMap);
      } finally {
        setLoadingStudents(false);
      }
    })();
  }, [studentQuery, courseId, mode]);

  const canPickStudent = useMemo(() => mode === 'student' && !!courseId, [mode, courseId]);

  return (
    <div className="space-y-3">
      {/* Filtro de campus */}
      <div className="flex items-center gap-2">
        <label className="text-sm">Sede:</label>
        <select
          className="input"
          value={campus}
          onChange={e => setCampus(e.target.value as Campus)}
        >
          <option value="ALL">Todas</option>
          <option value="DERQUI">Derqui</option>
          <option value="JOSE_C_PAZ">José C. Paz</option>
        </select>
      </div>

      {/* Buscar curso */}
      <div>
        <div className="text-sm text-neutral-600 mb-1">Curso</div>
        <SuggestInput
          value={courseQuery}
          onChange={v => setCourseQuery(v)}
          onPick={opt => { setCourseId(opt.value); setCourseQuery(opt.label); }}
          placeholder="Escribí el nombre del curso…"
          options={courseOpts}
          loading={loadingCourses}
        />
        {courseId && (
          <div className="text-xs text-neutral-500 mt-1">Course ID: <code>{courseId}</code></div>
        )}
      </div>

      {/* Buscar alumno dentro del curso (opcional) */}
      {mode === 'student' && (
        <div>
          <div className="text-sm text-neutral-600 mb-1">Alumno</div>
          <SuggestInput
            value={studentQuery}
            onChange={v => setStudentQuery(v)}
            onPick={opt => {
              setStudentQuery(opt.label);
              const s = studentMap[opt.value];
              if (s) onPickStudent?.(s);
            }}
            placeholder={canPickStudent ? 'Escribí nombre o email…' : 'Elegí primero un curso'}
            options={studentOpts}
            loading={loadingStudents}
          />
        </div>
      )}

      {/* Botones de confirmación */}
      <div className="flex gap-2">
        <button
          className="btn"
          disabled={!courseId}
          onClick={() => {
            const c = courseMap[courseId];
            if (c) onPickCourse?.({ _id: c._id, name: c.name, campus: c.campus as ApiCampus });
          }}
        >
          Usar curso
        </button>

        {mode === 'student' && (
          <button
            className="btn-secondary"
            disabled={!canPickStudent || studentOpts.length === 0}
            onClick={() => {/* elige desde el onPick del Suggest */}}
          >
            Usar alumno
          </button>
        )}
      </div>
    </div>
  );
}
