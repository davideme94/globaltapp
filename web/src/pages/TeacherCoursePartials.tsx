import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Toaster, toast } from 'sonner';
import { api } from '../lib/api';

type Term = 'MAY' | 'OCT';
type Grade = 'A' | 'B' | 'C' | 'D' | 'E';

type Grades = {
  reading: Grade;
  writing: Grade;
  listening: Grade;
  speaking: Grade;
  attendance: Grade;
  commitment: Grade;
};

type UiRow = {
  studentId: string;
  name: string;
  grades: Grades;
  comments: string;
  saving?: boolean;
};

const TERMS: { code: Term; label: string }[] = [
  { code: 'MAY', label: 'Mayo' },
  { code: 'OCT', label: 'Octubre' },
];
const G: Grade[] = ['A', 'B', 'C', 'D', 'E'];

export default function TeacherCoursePartials() {
  const { id: courseId } = useParams<{ id: string }>();

  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [term, setTerm] = useState<Term>('MAY');

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [courseTitle, setCourseTitle] = useState<string>('Curso');
  const [rows, setRows] = useState<UiRow[]>([]);
  const anySaving = useMemo(() => rows.some(r => r.saving), [rows]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!courseId) return;
      setLoading(true); setErr(null);
      try {
        // 1) Roster del curso
        const rosterR = await api.courses.roster(courseId);
        // 2) Reportes existentes para el curso/año/term
        const partR = await api.partials.course(courseId, { term, year }).catch(() => null);

        if (partR?.course) {
          const c = partR.course as any;
          setCourseTitle(`${c.name} — ${c.year}`);
        }

        // Mapear parciales existentes por estudiante
        const byStudent = new Map<string, any>();
        (partR?.rows || []).forEach((doc: any) => {
          const sid = typeof doc.student === 'string' ? doc.student : doc.student?._id;
          if (sid) byStudent.set(sid, doc);
        });

        // Construir filas UI combinando roster + parciales (si existen)
        const ui: UiRow[] = (rosterR.roster || []).map((r: any) => {
          const sid = r.student?._id || r.student;
          const name = r.student?.name || 'Alumno';
          const existing = byStudent.get(sid);

          return {
            studentId: sid,
            name,
            grades: {
              reading: existing?.grades?.reading ?? 'C',
              writing: existing?.grades?.writing ?? 'C',
              listening: existing?.grades?.listening ?? 'C',
              speaking: existing?.grades?.speaking ?? 'C',
              attendance: existing?.grades?.attendance ?? 'C',
              commitment: existing?.grades?.commitment ?? 'C',
            },
            comments: existing?.comments ?? '',
          };
        });

        // Orden alfabético por nombre
        ui.sort((a, b) => a.name.localeCompare(b.name));

        if (!alive) return;
        setRows(ui);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || String(e));
        setRows([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [courseId, term, year]);

  const setGrade = (sid: string, key: keyof Grades, val: Grade) => {
    setRows(prev => prev.map(r => r.studentId === sid
      ? { ...r, grades: { ...r.grades, [key]: val } }
      : r
    ));
  };

  const setComment = (sid: string, txt: string) => {
    setRows(prev => prev.map(r => r.studentId === sid ? { ...r, comments: txt } : r));
  };

  const saveOne = async (r: UiRow) => {
    if (!courseId) return;
    setRows(prev => prev.map(x => x.studentId === r.studentId ? { ...x, saving: true } : x));
    try {
      await api.partials.upsert({
        courseId,
        studentId: r.studentId,
        term,
        year,
        grades: r.grades,
        comments: r.comments?.trim() || '',
      });
      toast.success('Guardado');
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo guardar el parcial.');
    } finally {
      setRows(prev => prev.map(x => x.studentId === r.studentId ? { ...x, saving: false } : x));
    }
  };

  const saveAll = async () => {
    if (!courseId) return;
    const toSave = [...rows];
    try {
      for (const r of toSave) {
        await api.partials.upsert({
          courseId,
          studentId: r.studentId,
          term,
          year,
          grades: r.grades,
          comments: r.comments?.trim() || '',
        });
      }
      toast.success('Parciales guardados.');
    } catch (e: any) {
      toast.error(e?.message || 'Error al guardar en lote.');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="font-heading text-xl">
          Informes parciales — <span className="opacity-80">{courseTitle}</span>
        </h1>
        <div className="flex items-center gap-2">
          <select
            className="input"
            value={term}
            onChange={e => setTerm(e.target.value as Term)}
            aria-label="Término"
          >
            {TERMS.map(t => <option key={t.code} value={t.code}>{t.label}</option>)}
          </select>
          <input
            className="input w-28"
            type="number"
            value={year}
            onChange={e => setYear(parseInt(e.target.value || String(new Date().getFullYear()), 10))}
            aria-label="Año"
          />
        </div>
      </div>

      <div className="text-xs text-neutral-700">
        <b>Escala:</b> A 90–100 · B 80–89 · C 70–79 · D 60–69 · E 0–59
      </div>

      {loading && (
        <div className="card p-4 space-y-2">
          <div className="h-5 w-48 skeleton" />
          <div className="h-24 skeleton" />
        </div>
      )}

      {!loading && err && <div className="card p-4 text-danger">{err}</div>}

      {!loading && !err && (
        <div className="card p-0 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-50">
              <tr>
                <th className="text-left px-3 py-2">Alumno</th>
                <th className="text-left px-3 py-2">Reading</th>
                <th className="text-left px-3 py-2">Writing</th>
                <th className="text-left px-3 py-2">Listening</th>
                <th className="text-left px-3 py-2">Speaking</th>
                <th className="text-left px-3 py-2">Attendance</th>
                <th className="text-left px-3 py-2">Commitment</th>
                <th className="text-left px-3 py-2">Comentarios</th>
                <th className="px-3 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-neutral-700">
                    No hay alumnos en este curso.
                  </td>
                </tr>
              )}

              {rows.map(r => (
                <tr key={r.studentId} className="border-t">
                  <td className="px-3 py-2 whitespace-nowrap font-medium">{r.name}</td>

                  {(['reading','writing','listening','speaking','attendance','commitment'] as const).map(k => (
                    <td key={k} className="px-3 py-2">
                      <select
                        className="input !h-8"
                        value={r.grades[k]}
                        disabled={r.saving || anySaving}
                        onChange={e => setGrade(r.studentId, k, e.target.value as Grade)}
                      >
                        {G.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </td>
                  ))}

                  <td className="px-3 py-2 min-w-[220px]">
                    <input
                      className="input !h-8 w-full"
                      placeholder="Comentario (opcional)"
                      value={r.comments}
                      disabled={r.saving || anySaving}
                      onChange={e => setComment(r.studentId, e.target.value)}
                    />
                  </td>

                  <td className="px-3 py-2 text-right">
                    <button
                      className="btn btn-primary !h-8 !py-0 disabled:opacity-60"
                      disabled={r.saving || anySaving}
                      onClick={() => saveOne(r)}
                    >
                      {r.saving ? 'Guardando…' : 'Guardar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !err && rows.length > 0 && (
        <div className="flex justify-end">
          <button
            className="btn btn-secondary"
            onClick={saveAll}
            disabled={anySaving}
          >
            Guardar todo
          </button>
        </div>
      )}

      <Toaster richColors closeButton position="top-right" />
    </div>
  );
}
