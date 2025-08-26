import { useEffect, useMemo, useState } from 'react';
import { getMe, type Me } from '../lib/api';
import { listCommunications, sendCommunication, markRead, type Communication } from '../lib/communications';
import { getMyCourses, type TeacherCourse } from '../lib/teacher';
import { getEnrollmentsByCourse, type Enrollment } from '../lib/enrollments';

// UI mejorada: si sos TEACHER, podés elegir Curso y Alumno desde combos.
// Si sos STUDENT, ves tus mensajes (con "marcar leído").
export default function Communications() {
  const [me, setMe] = useState<Me | null>(null);
  const [loadingMe, setLoadingMe] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [items, setItems] = useState<Communication[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  // --- Estado para envío ---
  const canSend = useMemo(() => me && (me.role === 'teacher' || me.role === 'coordinator' || me.role === 'admin'), [me]);

  // Inputs “manuales” por si sos coordinator/admin o querés pegar IDs a mano
  const [studentId, setStudentId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [category, setCategory] = useState<'tarea'|'conducta'|'administrativo'|'otro'>('otro');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  // --- Soporte selects (TEACHER) ---
  const [myCourses, setMyCourses] = useState<TeacherCourse[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>(''); // courseId
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string>(''); // studentId

  // Carga usuario
  useEffect(() => {
    setLoadingMe(true);
    getMe().then(setMe).catch((e) => setError(e.message)).finally(() => setLoadingMe(false));
  }, []);

  // Carga cursos del docente
  useEffect(() => {
    if (me?.role === 'teacher') {
      getMyCourses()
        .then((courses) => {
          setMyCourses(courses);
          // Si hay uno, lo preselecciono
          if (courses.length === 1) setSelectedCourse(courses[0]._id);
        })
        .catch((e) => setError(e.message));
    }
  }, [me]);

  // Carga alumnos del curso seleccionado
  useEffect(() => {
    if (!selectedCourse) { setEnrollments([]); setSelectedStudent(''); return; }
    getEnrollmentsByCourse(selectedCourse)
      .then((rows) => {
        setEnrollments(rows);
        // Si hay uno, lo preselecciono
        if (rows.length === 1) {
          const st = rows[0].student as any;
          setSelectedStudent(typeof st === 'string' ? st : st?._id || '');
        }
      })
      .catch((e) => setError(e.message));
  }, [selectedCourse]);

  // Lista de comunicaciones
  const refresh = async () => {
    setLoadingList(true);
    try {
      if (me?.role === 'student') {
        const { communications } = await listCommunications();
        setItems(communications);
      } else {
        const { communications } = await listCommunications({
          studentId: (selectedStudent || studentId || '').trim() || undefined,
          courseId: (selectedCourse || courseId || '').trim() || undefined
        });
        setItems(communications);
      }
    } catch (e: any) {
      setError(e.message || 'Error al listar');
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => { if (me) refresh(); /* eslint-disable-next-line */ }, [me]);

  const readyToSend = useMemo(() => {
    const sId = (selectedStudent || studentId).trim();
    const cId = (selectedCourse || courseId).trim();
    return Boolean(canSend && sId && cId && message.trim().length >= 3);
  }, [canSend, selectedStudent, studentId, selectedCourse, courseId, message]);

  const onSend = async () => {
    setSending(true);
    setError(null);
    try {
      const sId = (selectedStudent || studentId).trim();
      const cId = (selectedCourse || courseId).trim();
      await sendCommunication({ studentId: sId, courseId: cId, category, message: message.trim() });
      setMessage('');
      await refresh();
      alert('Mensaje enviado ✅');
    } catch (e: any) {
      setError(e.message || 'Error al enviar');
    } finally {
      setSending(false);
    }
  };

  const onRead = async (id: string) => {
    try {
      await markRead(id);
    } catch {}
    setItems(prev => prev.map(i => i._id === id ? { ...i, read: true } : i));
  };

  if (loadingMe) return <div style={{ padding: 16 }}>Cargando...</div>;
  if (error) return <div style={{ padding: 16, color: 'crimson' }}>Error: {error}</div>;
  if (!me) return <div style={{ padding: 16 }}>No logueado</div>;

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: 16 }}>
      <h2>Libro de comunicaciones</h2>
      <p><b>Usuario:</b> {me.name} — <i>{me.role.toUpperCase()}</i></p>

      {canSend && (
        <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, margin: '12px 0' }}>
          <h3>Enviar comunicación</h3>

          {/* Sección de selects si es TEACHER */}
          {me.role === 'teacher' && (
            <div style={{ display: 'grid', gap: 8, marginBottom: 8 }}>
              <div>
                <label>Curso (tuyo): </label>
                <select
                  value={selectedCourse}
                  onChange={(e) => setSelectedCourse(e.target.value)}
                >
                  <option value="">-- Elegí un curso --</option>
                  {myCourses.map(c => (
                    <option key={c._id} value={c._id}>
                      {c.name}{c.campus ? ` · ${c.campus}` : ''}{c.year ? ` · ${c.year}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label>Alumno (del curso): </label>
                <select
                  value={selectedStudent}
                  onChange={(e) => setSelectedStudent(e.target.value)}
                  disabled={!selectedCourse || enrollments.length === 0}
                >
                  <option value="">{enrollments.length ? '-- Elegí un alumno --' : 'Primero elegí un curso'}</option>
                  {enrollments.map(en => {
                    const st: any = en.student;
                    const id = typeof st === 'string' ? st : (st?._id || '');
                    const label = typeof st === 'string' ? st : (st?.name || st?.email || id);
                    return <option key={en._id} value={id}>{label}</option>;
                  })}
                </select>
              </div>

              <small>Tip: Podés listar/filtrar clickeando “Refrescar”.</small>
            </div>
          )}

          {/* Inputs manuales como alternativa (coordinator/admin o por si no carga el combo) */}
          {me.role !== 'teacher' && (
            <div style={{ display: 'grid', gap: 8 }}>
              <input placeholder="Student ID" value={studentId} onChange={e => setStudentId(e.target.value)} />
              <input placeholder="Course ID" value={courseId} onChange={e => setCourseId(e.target.value)} />
            </div>
          )}

          <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
            <div>
              <label>Categoría:&nbsp;</label>
              <select value={category} onChange={e => setCategory(e.target.value as any)}>
                <option value="tarea">tarea</option>
                <option value="conducta">conducta</option>
                <option value="administrativo">administrativo</option>
                <option value="otro">otro</option>
              </select>
            </div>
            <textarea placeholder="Mensaje..." value={message} onChange={e => setMessage(e.target.value)} rows={4}/>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onSend} disabled={!readyToSend || sending}>Enviar</button>
              <button onClick={refresh} disabled={loadingList}>Refrescar</button>
            </div>
          </div>
        </div>
      )}

      {!canSend && (
        <div style={{ margin: '12px 0' }}>
          <button onClick={refresh} disabled={loadingList}>Refrescar</button>
        </div>
      )}

      <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 8 }}>
        {items.map(c => (
          <li key={c._id} style={{ border: '1px solid #eee', borderRadius: 8, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <small>
                <b>{new Date(c.createdAt).toLocaleString()}</b>
                {' · '}<span>{c.category}</span>
                {' · '}<span>{c.role}</span>
                {' · course:'}{c.course}
                {' · student:'}{c.student}
              </small>
              {me.role === 'student' && !c.read && (
                <button onClick={() => onRead(c._id)}>Marcar leído</button>
              )}
            </div>
            <div style={{ whiteSpace: 'pre-wrap', marginTop: 6 }}>{c.message}</div>
            {me.role === 'student' && c.read && <small style={{ color: 'green' }}>✓ leído</small>}
          </li>
        ))}
      </ul>

      {items.length === 0 && <p>No hay comunicaciones aún.</p>}
    </div>
  );
}
