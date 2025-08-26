import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';

export default function TeacherBritishCourse() {
  const { id: courseId } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [course, setCourse] = useState<{ _id:string; name:string; year:number } | null>(null);
  const [rows, setRows] = useState<{ student:{_id:string; name:string}; oral:number|null; written:number|null }[]>([]);
  const [meta, setMeta] = useState<{ provider?: string; examiner?: string }>({});

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!courseId) return;
      setLoading(true); setErr(null);
      try {
        const r = await api.british.course(courseId);
        if (!alive) return;
        setCourse(r.course || null);
        setRows((r.rows || []).map((x:any) => ({
          student: x.student?._id ? x.student : { _id: String(x.student), name: 'Alumno' },
          oral: x.oral ?? null,
          written: x.written ?? null
        })));
        const f = (r.rows || []).find(Boolean);
        setMeta({ provider: f?.provider, examiner: f?.examiner });
      } catch (e:any) {
        if (!alive) return;
        setErr(e?.message || String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [courseId]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-xl">
          Británico (solo lectura) {course ? `— ${course.name} (${course.year})` : ''}
        </h1>
        <Link to="/teacher/courses" className="btn btn-secondary">Volver a cursos</Link>
      </div>

      {loading && <div className="card p-4"><div className="h-20 skeleton"/></div>}
      {!loading && err && <div className="card p-4 text-danger">{err}</div>}
      {!loading && !err && (
        <>
          <div className="card p-4 text-sm text-neutral-700">
            <div><b>Proveedor:</b> {meta.provider || '—'}</div>
            <div><b>Examinador:</b> {meta.examiner || '—'}</div>
          </div>

          <div className="card overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="text-left text-sm text-neutral-700">
                  <th className="px-3 py-2 border-b">Alumno</th>
                  <th className="px-3 py-2 border-b">Oral</th>
                  <th className="px-3 py-2 border-b">Escrito</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {rows.map(r => (
                  <tr key={r.student._id} className="hover:bg-neutral-50">
                    <td className="px-3 py-2">{r.student.name}</td>
                    <td className="px-3 py-2">{r.oral ?? '—'}</td>
                    <td className="px-3 py-2">{r.written ?? '—'}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={3} className="px-3 py-6 text-center text-neutral-700">Sin datos.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
