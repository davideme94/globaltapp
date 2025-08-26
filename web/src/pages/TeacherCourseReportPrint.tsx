import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, type RosterItem } from '../lib/api';

export default function TeacherCourseReportPrint() {
  const { id } = useParams<{ id: string }>();
  const [roster, setRoster] = useState<RosterItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [courseMeta, setCourseMeta] = useState<{ name: string; year: number } | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    (async () => {
      if (!id) return;
      const [r1, r2] = await Promise.all([
        api.courses.roster(id),
        api.reportcards.listCourse(id)
      ]);
      setRoster(r1.roster);
      setCourseMeta({ name: r2.course.name, year: r2.course.year });
      setSelectedId(r1.roster[0]?.student._id ?? null); // primer alumno por defecto
    })();
  }, [id]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return roster;
    return roster.filter(r => r.student.name.toLowerCase().includes(term));
  }, [q, roster]);

  const printUrl = selectedId ? `/print/final/${id}/${selectedId}` : '';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', height: 'calc(100vh - 60px)' }}>
      {/* Sidebar */}
      <aside style={{ borderRight: '1px solid #eee', padding: 12, overflow: 'auto' }}>
        <div style={{ marginBottom: 6, fontWeight: 700 }}>
          Boletín – {courseMeta?.name} ({courseMeta?.year})
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Link to={`/teacher/course/${id}/report`}>✏️ Editar boletín</Link>
          <Link to={`/teacher/courses`}>↩ Volver a cursos</Link>
        </div>
        <input
          placeholder="Buscar alumno…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ width: '100%', marginBottom: 8 }}
        />
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {filtered.map(r => (
            <li key={r.student._id}>
              <button
                onClick={() => setSelectedId(r.student._id)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '6px 8px',
                  marginBottom: 4,
                  border: '1px solid #ddd',
                  borderRadius: 8,
                  background: selectedId === r.student._id ? '#eef6ff' : '#fff'
                }}
              >
                {r.student.name}
              </button>
            </li>
          ))}
          {filtered.length === 0 && <li style={{ color: '#666' }}>Sin resultados</li>}
        </ul>
      </aside>

      {/* Visor A4 */}
      <main style={{ padding: 12 }}>
        {!selectedId ? (
          <div>Seleccioná un alumno.</div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <a href={printUrl} target="_blank" rel="noreferrer">
                <button>🖨️ Abrir en pestaña nueva</button>
              </a>
            </div>
            <iframe
              title="Boletín A4"
              src={printUrl}
              style={{ width: '100%', height: 'calc(100vh - 130px)', border: '1px solid #ddd', borderRadius: 8, background: '#fff' }}
            />
          </>
        )}
      </main>
    </div>
  );
}
