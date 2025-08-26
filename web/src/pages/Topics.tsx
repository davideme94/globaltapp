import { useEffect, useMemo, useState } from 'react';
import { getMe, type Me } from '../lib/api';
import { getMyCourses, type TeacherCourse } from '../lib/teacher';
import { listTopics, createTopic, type Topic } from '../lib/topics';

function todayYMD() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export default function Topics() {
  const [me, setMe] = useState<Me | null>(null);
  const [loadingMe, setLoadingMe] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [myCourses, setMyCourses] = useState<TeacherCourse[]>([]);
  const [courseId, setCourseId] = useState('');
  const [from, setFrom] = useState(todayYMD());
  const [to, setTo] = useState(todayYMD());
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  const [date, setDate] = useState(todayYMD());
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoadingMe(true);
    getMe().then(setMe).catch((e) => setError(e.message)).finally(() => setLoadingMe(false));
  }, []);

  const canCreate = useMemo(() => me && (me.role === 'teacher' || me.role === 'coordinator'), [me]);

  // Cargar cursos del docente (sólo teacher)
  useEffect(() => {
    if (me?.role === 'teacher') {
      getMyCourses().then((cs) => {
        setMyCourses(cs);
        if (cs[0]?._id) setCourseId(cs[0]._id);
      }).catch((e) => setError(e.message));
    }
  }, [me]);

  const refresh = async () => {
    if (!courseId) return;
    setLoadingList(true);
    try {
      const { topics } = await listTopics({ courseId, from, to });
      setTopics(topics);
    } catch (e: any) {
      setError(e.message || 'Error al listar');
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => { if (courseId) refresh(); /* eslint-disable-next-line */ }, [courseId]);

  const onCreate = async () => {
    if (!courseId || !content.trim() || !date) return;
    setSaving(true);
    try {
      await createTopic({ courseId, date, content: content.trim() });
      setContent('');
      await refresh();
      alert('Tema registrado ✅');
    } catch (e: any) {
      setError(e.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (loadingMe) return <div style={{ padding: 16 }}>Cargando...</div>;
  if (error) return <div style={{ padding: 16, color: 'crimson' }}>Error: {error}</div>;
  if (!me) return <div style={{ padding: 16 }}>No logueado</div>;

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: 16 }}>
      <h2>Libro de temas</h2>
      <p><b>Usuario:</b> {me.name} — <i>{me.role.toUpperCase()}</i></p>

      {/* Selector de curso y rango */}
      <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, marginBottom: 12 }}>
        <div style={{ display: 'grid', gap: 8 }}>
          {me.role === 'teacher' ? (
            <div>
              <label>Curso: </label>
              <select value={courseId} onChange={e => setCourseId(e.target.value)}>
                {myCourses.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>
          ) : (
            <div>
              <input
                placeholder="Course ID"
                value={courseId}
                onChange={e => setCourseId(e.target.value)}
              />
              <small>Coordinador/Admin: pegá el ID del curso (luego añadimos buscador).</small>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <div>
              <label>Desde:&nbsp;</label>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
            </div>
            <div>
              <label>Hasta:&nbsp;</label>
              <input type="date" value={to} onChange={e => setTo(e.target.value)} />
            </div>
            <button onClick={refresh} disabled={!courseId || loadingList}>Refrescar</button>
          </div>
        </div>
      </div>

      {/* Form de creación (teacher/coordinator) */}
      {canCreate && (
        <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <h3>Registrar contenido del día</h3>
          <div style={{ display: 'grid', gap: 8 }}>
            <div>
              <label>Fecha:&nbsp;</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <textarea
              rows={4}
              placeholder="Contenido visto (ej: Simple Past: afirmativas/negativas + listening Unit 3)"
              value={content}
              onChange={e => setContent(e.target.value)}
            />
            <button onClick={onCreate} disabled={!courseId || saving || content.trim().length < 3}>Guardar</button>
          </div>
        </div>
      )}

      {/* Lista */}
      <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 8 }}>
        {topics.map(t => (
          <li key={t._id} style={{ border: '1px solid #eee', borderRadius: 8, padding: 12 }}>
            <small><b>{t.date}</b> · course:{t.course} · teacher:{t.teacher}</small>
            <div style={{ whiteSpace: 'pre-wrap', marginTop: 6 }}>{t.content}</div>
          </li>
        ))}
      </ul>
      {topics.length === 0 && <p>No hay temas en el rango.</p>}
    </div>
  );
}
