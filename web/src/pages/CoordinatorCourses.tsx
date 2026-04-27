import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

type Teacher = { _id: string; name: string; email: string };

// Soportamos que el backend devuelva teacher:
// - como string (ID)   -> buscamos el nombre en teachers
// - como objeto        -> usamos name/email
function teacherLabel(teacher: unknown, teacherById: Map<string, Teacher>) {
  if (!teacher) return '—';
  if (typeof teacher === 'string') {
    return teacherById.get(teacher)?.name || '—';
  }
  if (typeof teacher === 'object') {
    const t = teacher as Partial<Teacher>;
    return t.name || t.email || '—';
  }
  return '—';
}

// ====== Helpers de día ======
const DAY_LABEL: Record<string, string> = {
  MON: 'Lunes',
  TUE: 'Martes',
  WED: 'Miércoles',
  THU: 'Jueves',
  FRI: 'Viernes',
  SAT: 'Sábado',
  SUN: 'Domingo',
};

const NUM_TO_CODE_0: Record<number, string> = {
  0: 'SUN',
  1: 'MON',
  2: 'TUE',
  3: 'WED',
  4: 'THU',
  5: 'FRI',
  6: 'SAT',
};

const NUM_TO_CODE_1: Record<number, string> = {
  1: 'MON',
  2: 'TUE',
  3: 'WED',
  4: 'THU',
  5: 'FRI',
  6: 'SAT',
  7: 'SUN',
};

// Normaliza distintos formatos a un código de 3 letras en mayúsculas
function normalizeDayCode(anyDay: unknown): string | null {
  if (anyDay === undefined || anyDay === null) return null;

  if (typeof anyDay === 'number') {
    if (anyDay >= 0 && anyDay <= 6) return NUM_TO_CODE_0[anyDay];
    if (anyDay >= 1 && anyDay <= 7) return NUM_TO_CODE_1[anyDay];
  }

  let s = String(anyDay).trim();
  if (!s) return null;

  if (/^\d+$/.test(s)) {
    const n = Number(s);
    if (n >= 0 && n <= 6) return NUM_TO_CODE_0[n];
    if (n >= 1 && n <= 7) return NUM_TO_CODE_1[n];
  }

  s = s.toUpperCase();

  const onlyLetters = s.replace(/[^A-ZÁÉÍÓÚÜÑ]/g, '');
  if (onlyLetters.length >= 3) {
    const head3 = onlyLetters.slice(0, 3);
    const map: Record<string, string> = {
      LUN: 'MON',
      MAR: 'TUE',
      MIE: 'WED',
      MIÉ: 'WED',
      JUE: 'THU',
      VIE: 'FRI',
      SAB: 'SAT',
      SÁB: 'SAT',
      DOM: 'SUN',
      MON: 'MON',
      TUE: 'TUE',
      WED: 'WED',
      THU: 'THU',
      FRI: 'FRI',
      SAT: 'SAT',
      SUN: 'SUN',
    };
    if (map[head3]) return map[head3];
  }

  return null;
}

// Extrae el día del item probando varias claves comunes
function extractDayCode(item: any): string | null {
  const candidates = [
    item?.day,
    item?.dayCode,
    item?.dow,
    item?.weekday,
    item?.d,
    item?.dayIndex,
    item?.dayNum,
    item?.code,
    item?.name,
  ];

  for (const c of candidates) {
    const code = normalizeDayCode(c);
    if (code) return code;
  }

  return null;
}

// Formatea el arreglo de horarios del curso
function formatSchedule(items: any[] | undefined | null, debugCourseId?: string) {
  if (!items || items.length === 0) return '';

  if (debugCourseId && (window as any).__schedLogged?.[debugCourseId] !== true) {
    (window as any).__schedLogged = (window as any).__schedLogged || {};
    (window as any).__schedLogged[debugCourseId] = true;
    console.log(`[schedule] course=${debugCourseId}\n`, JSON.stringify(items, null, 2));
  }

  const parts = items
    .filter(i => i && i.start && i.end)
    .map(i => {
      const code = extractDayCode(i);
      const day = code ? DAY_LABEL[code] || code : '';
      const time = `${i.start}–${i.end}`;
      return day ? `${day} ${time}` : time;
    });

  return parts.join(' · ');
}

function ActionLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center justify-center rounded-xl border border-fuchsia-200 bg-white px-3 py-2 text-sm font-medium text-fuchsia-700 transition hover:border-fuchsia-300 hover:bg-fuchsia-50"
    >
      {children}
    </Link>
  );
}

function InfoItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
        {label}
      </div>

      <div className="mt-1 break-words text-sm font-medium text-neutral-800">
        {value || '—'}
      </div>
    </div>
  );
}

export default function CoordinatorCourses() {
  const thisYear = new Date().getFullYear();

  const [year, setYear] = useState<number>(thisYear);
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Crear curso
  const [cName, setCName] = useState('Inglés A1');
  const [cCampus, setCCampus] = useState<'DERQUI' | 'JOSE_C_PAZ'>('DERQUI');
  const [cTeacher, setCTeacher] = useState<string>('');

  // Docentes existentes para asignar al curso
  const [teachers, setTeachers] = useState<{ _id: string; name: string; email: string }[]>([]);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setErr(null);

      try {
        const [{ courses }, { rows }] = await Promise.all([
          api.courses.list({ year }),
          api.users.list({ role: 'teacher' }),
        ]);

        if (!alive) return;

        setTeachers(
          (rows as any[]).map(r => ({
            _id: r._id,
            name: r.name,
            email: r.email,
          }))
        );

        const enriched = await Promise.all(
          courses.map(async (c: any) => {
            try {
              const [schedRes, rosterRes] = await Promise.allSettled([
                api.courses.schedule.get(c._id),
                api.courses.roster(c._id),
              ]);

              const schedule = schedRes.status === 'fulfilled' ? schedRes.value.schedule : [];
              const studentCount =
                rosterRes.status === 'fulfilled' ? rosterRes.value.roster?.length || 0 : 0;

              return {
                ...c,
                _scheduleText: formatSchedule(schedule, c._id),
                _studentCount: studentCount,
              };
            } catch {
              return {
                ...c,
                _scheduleText: '',
                _studentCount: 0,
              };
            }
          })
        );

        setCourses(enriched);
      } catch (e: any) {
        if (!alive) return;
        setErr(e.message || 'Error');
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [year]);

  const teacherById = useMemo(() => new Map(teachers.map(t => [t._id, t])), [teachers]);

  const createCourse = async () => {
    try {
      const { course } = await api.courses.create({
        name: `${cName} ${year}`,
        year,
        campus: cCampus,
      });

      if (cTeacher) await api.courses.assignTeacher(course._id, cTeacher);

      setCourses(prev => [
        {
          ...course,
          _scheduleText: '',
          _studentCount: 0,
        },
        ...prev,
      ]);

      setCName('Inglés A1');
    } catch (e: any) {
      alert(e.message || 'No se pudo crear el curso');
    }
  };

  const deleteCourse = async (course: any) => {
    const ok = window.confirm(
      `Vas a eliminar el curso:\n\n${course.name} (${course.year})\n\nSe borrarán inscripciones y datos relacionados.\n¿Continuar?`
    );

    if (!ok) return;

    try {
      await api.courses.delete(course._id);
      setCourses(prev => prev.filter(c => c._id !== course._id));
      alert('Curso eliminado');
    } catch (e: any) {
      alert(e?.message || 'No se pudo eliminar el curso');
    }
  };

  return (
    <div className="space-y-5">
      {/* Encabezado */}
      <div className="rounded-3xl border border-fuchsia-200 bg-gradient-to-r from-fuchsia-600 via-purple-600 to-indigo-600 p-6 text-white shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-sm font-medium uppercase tracking-[0.18em] text-white/80">
              Panel de cursos
            </div>

            <h1 className="mt-1 text-2xl font-bold">Cursos ({year})</h1>

            <p className="mt-2 max-w-3xl text-sm text-white/90">
              Desde aquí podés administrar cursos, asignar docentes, ver horarios, acceder al libro
              de temas, materiales, asistencia, muro y demás herramientas del curso.
            </p>
          </div>

          <div className="inline-flex w-fit items-center rounded-2xl bg-white/15 px-4 py-2 text-sm font-medium backdrop-blur">
            Año activo:
            <span className="ml-2 rounded-xl bg-white/20 px-2 py-1 font-bold">
              {year}
            </span>
          </div>
        </div>
      </div>

      {/* Año */}
      <div className="card rounded-3xl border border-neutral-200 p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-neutral-900">Filtro general</h2>
          <p className="text-sm text-neutral-600">
            Elegí el año para ver y administrar los cursos.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:max-w-xs">
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">
              Año
            </label>

            <input
              className="input w-full rounded-2xl"
              type="number"
              value={year}
              onChange={e => setYear(Number(e.target.value || thisYear))}
            />
          </div>
        </div>
      </div>

      {/* Crear curso */}
      <div className="card rounded-3xl border border-neutral-200 p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-neutral-900">Crear curso</h2>
          <p className="text-sm text-neutral-600">
            Completá los datos básicos del curso y, si querés, asignale un docente existente.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1.4fr_140px_180px_1.4fr_140px] md:items-end">
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">
              Nombre
            </label>

            <input
              className="input w-full rounded-2xl"
              value={cName}
              onChange={e => setCName(e.target.value)}
              placeholder="Inglés A1 / 2° KIDS / ..."
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">
              Año
            </label>

            <input
              className="input w-full rounded-2xl"
              type="number"
              value={year}
              onChange={e => setYear(Number(e.target.value || thisYear))}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">
              Sede
            </label>

            <select
              className="input w-full rounded-2xl"
              value={cCampus}
              onChange={e => setCCampus(e.target.value as any)}
            >
              <option value="DERQUI">Derqui</option>
              <option value="JOSE_C_PAZ">José C. Paz</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">
              Docente
            </label>

            <select
              className="input w-full rounded-2xl"
              value={cTeacher}
              onChange={e => setCTeacher(e.target.value)}
            >
              <option value="">— Seleccionar —</option>
              {teachers.map(t => (
                <option key={t._id} value={t._id}>
                  {t.name} — {t.email}
                </option>
              ))}
            </select>
          </div>

          <div>
            <button className="btn btn-primary w-full rounded-2xl" onClick={createCourse}>
              Crear curso
            </button>
          </div>
        </div>
      </div>

      {/* Listado */}
      <div className="space-y-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-neutral-900">Listado de cursos</h2>
            <p className="text-sm text-neutral-600">
              Accedé rápidamente a la gestión, horarios, asistencia, materiales y demás opciones.
            </p>
          </div>

          <div className="inline-flex w-fit items-center rounded-2xl border border-fuchsia-200 bg-fuchsia-50 px-3 py-2 text-sm font-semibold text-fuchsia-700">
            {courses.length} curso{courses.length === 1 ? '' : 's'}
          </div>
        </div>

        <div className="card rounded-3xl border border-neutral-200 p-5 shadow-sm">
          {loading && <div className="h-24 skeleton" />}

          {err && <div className="text-danger">{err}</div>}

          {!loading && !err && (
            <div className="space-y-4">
              {courses.length === 0 && (
                <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-8 text-center text-neutral-600">
                  Sin cursos para {year}.
                </div>
              )}

              {courses.map((c: any) => (
                <div
                  key={c._id}
                  className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:shadow-md"
                >
                  {/* Cabecera del curso */}
                  <div className="flex flex-col gap-3 border-b border-neutral-200 pb-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-neutral-900">{c.name}</h3>

                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="rounded-full bg-fuchsia-100 px-3 py-1 text-xs font-semibold text-fuchsia-700">
                          {c.campus === 'DERQUI' ? 'Derqui' : 'José C. Paz'}
                        </span>

                        <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
                          Año {c.year}
                        </span>

                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                          {typeof c._studentCount === 'number' ? c._studentCount : 0} alumno
                          {Number(c._studentCount) === 1 ? '' : 's'}
                        </span>
                      </div>
                    </div>

                    <button
                      className="inline-flex items-center justify-center rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100"
                      onClick={() => deleteCourse(c)}
                      title="Eliminar curso (borra inscripciones y datos relacionados)"
                    >
                      Eliminar curso
                    </button>
                  </div>

                  {/* Información */}
                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                    <InfoItem
                      label="Docente"
                      value={teacherLabel((c as any).teacher, teacherById)}
                    />

                    <InfoItem
                      label="Días y horarios"
                      value={c._scheduleText || 'Sin horarios cargados'}
                    />

                    <InfoItem
                      label="Alumnos"
                      value={typeof c._studentCount === 'number' ? c._studentCount : 0}
                    />
                  </div>

                  {/* Acciones */}
                  <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                    <div className="mb-3">
                      <h4 className="text-sm font-semibold text-neutral-900">
                        Acciones rápidas
                      </h4>

                      <p className="text-xs text-neutral-600">
                        Elegí una opción para administrar este curso.
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <ActionLink to={`/coordinator/course/${c._id}/manage`}>
                        AGREGAR ALUMNOS
                      </ActionLink>

                      <ActionLink to={`/coordinator/course/${c._id}/schedule`}>
                        ASIGNAR DÍA/HORARIO
                      </ActionLink>

                      <ActionLink to={`/coordinator/course/${c._id}/attendance`}>
                        ASISTENCIA
                      </ActionLink>

                      <ActionLink to={`/coordinator/course/${c._id}/practice`}>
                        PRÁCTICA
                      </ActionLink>

                      <ActionLink to={`/coordinator/course/${c._id}/topics`}>
                        LIBRO DE TEMAS
                      </ActionLink>

                      <ActionLink to={`/coordinator/course/${c._id}/materials`}>
                        MATERIAL DEL CURSO
                      </ActionLink>

                      <ActionLink to={`/coordinator/course/${c._id}/board`}>
                        MURO DEL CURSO
                      </ActionLink>

                      <ActionLink to={`/coordinator/course/${c._id}/student-materials`}>
                        MATERIAL DEL ALUMNO
                      </ActionLink>

                      <ActionLink to={`/coordinator/course/${c._id}/partials`}>
                        INFORMES PARCIALES
                      </ActionLink>

                      <ActionLink to={`/coordinator/course/${c._id}/boletin`}>
                        BOLETÍN
                      </ActionLink>

                      <ActionLink to={`/coordinator/course/${c._id}/british`}>
                        NOTAS BRITÁNICO
                      </ActionLink>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
