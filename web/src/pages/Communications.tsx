// src/pages/Communications.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { listCommunications, sendCommunication, markRead, type Communication } from '../lib/communications';
import { api, type Me } from '../lib/api';

/* ---------- helpers de UI ---------- */
type Option = { value: string; label: string };

function useDebounced<T>(value: T, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

function Autocomplete({
  value, onChange, onPick, placeholder, options, loading,
}: {
  value: string;
  onChange: (v: string) => void;
  onPick: (opt: Option) => void;
  placeholder?: string;
  options: Option[];
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as any)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div ref={ref} className="relative">
      <input
        className="input w-full"
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
      />
      {open && (
        <div className="absolute z-10 mt-1 w-full max-h-56 overflow-auto bg-white border rounded shadow">
          {loading && <div className="px-3 py-2 text-sm text-neutral-600">Buscando…</div>}
          {!loading && options.length === 0 && <div className="px-3 py-2 text-sm text-neutral-600">Sin resultados</div>}
          {!loading && options.map(opt => (
            <button
              key={opt.value}
              className="block w-full text-left px-3 py-2 hover:bg-neutral-50"
              onClick={() => { onPick(opt); setOpen(false); }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- NUEVO: hilo de respuestas ---------- */
function RepliesBlock({
  replies,
}: {
  replies?: { _id: string; user: any; role: string; body: string; createdAt: string }[];
}) {
  if (!Array.isArray(replies) || replies.length === 0) return null;
  return (
    <div className="mt-2 border-l-2 pl-3 space-y-2 border-neutral-200">
      {replies.map((r) => {
        const who = typeof r.user === 'string' ? '' : (r.user?.name || '');
        const when = r.createdAt ? new Date(r.createdAt).toLocaleString() : '';
        return (
          <div key={r._id} className="text-sm">
            <div className="text-xs text-neutral-500">
              {who ? `${who} • ` : ''}{r.role} • {when}
            </div>
            <div className="whitespace-pre-wrap">{r.body}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- NUEVO: form de respuesta (staff y también usable por student si quisieras) ---------- */
function ReplyForm({ commId, onSent }: { commId: string; onSent?: () => void }) {
  const [txt, setTxt] = useState('');
  const [busy, setBusy] = useState(false);

  async function send() {
    const body = txt.trim();
    if (!body) return;
    setBusy(true);
    try {
      const ORIGIN = (import.meta as any).env?.VITE_API_URL?.replace(/\/$/, '') || '';
      await fetch(`${ORIGIN || ''}/api/communications/${commId}/replies`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      setTxt('');
      onSent?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 grid gap-2">
      <textarea
        className="input w-full h-24"
        placeholder="Escribí tu respuesta (opcional)…"
        value={txt}
        onChange={e => setTxt(e.target.value)}
      />
      <div>
        <button className="btn btn-primary" onClick={send} disabled={busy || !txt.trim()}>
          {busy ? 'Enviando…' : 'Responder'}
        </button>
      </div>
    </div>
  );
}

/* ---------- Página ---------- */
const EMOJIS = ['😀','😁','😅','😍','😎','🤓','👍','👏','🙏','🎉','🔥','✅','📌','❗','💡'];
type Mode = 'broadcast' | 'course' | 'student';

export default function Communications() {
  const [me, setMe] = useState<Me['user'] | null>(null);
  const [loadingMe, setLoadingMe] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // listado
  const [items, setItems] = useState<Communication[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  // envío
  const canSend = useMemo(
    () => !!me && (me.role === 'teacher' || me.role === 'coordinator' || me.role === 'admin'),
    [me]
  );
  const [mode, setMode] = useState<Mode>('course');
  const [category, setCategory] = useState<'tarea'|'conducta'|'administrativo'|'otro'>('otro');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  // Autocomplete: CURSO
  const [courseQuery, setCourseQuery] = useState('');
  const debCourse = useDebounced(courseQuery, 250);
  const [courseOpts, setCourseOpts] = useState<Option[]>([]);
  const [courseId, setCourseId] = useState<string>('');
  const [loadingCourses, setLoadingCourses] = useState(false);

  // Autocomplete: ALUMNO del curso
  const [studentQuery, setStudentQuery] = useState('');
  const debStudent = useDebounced(studentQuery, 250);
  const [studentOpts, setStudentOpts] = useState<Option[]>([]);
  const [studentId, setStudentId] = useState<string>('');
  const [loadingStudents, setLoadingStudents] = useState(false);

  /* cargar usuario */
  useEffect(() => {
    setLoadingMe(true);
    api.me()
      .then(r => setMe(r.user))
      .catch((e:any) => setError(e.message))
      .finally(() => setLoadingMe(false));
  }, []);

  /* buscar cursos por nombre (filtra por docente si es TEACHER) */
  useEffect(() => {
    if (!canSend) return;
    const q = debCourse.trim().toLowerCase();
    if (!q) { setCourseOpts([]); return; }
    setLoadingCourses(true);
    (async () => {
      try {
        const year = new Date().getFullYear();
        const ORIGIN = (import.meta as any).env?.VITE_API_URL?.replace(/\/$/, '') || '';
        const r = await fetch(`${ORIGIN || ''}/api/courses?year=${year}`, { credentials: 'include' });
        const data = await r.json();
        const rows: any[] = Array.isArray(data.courses) ? data.courses : [];

        const teacherId = me?.role === 'teacher' ? String(me?.id || '') : '';
        const filtered = rows.filter(c => {
          if (me?.role !== 'teacher') return true;
          const t = (c as any).teacher;
          const id = typeof t === 'string' ? t : t?._id;
          return String(id || '') === teacherId;
        });

        const opts = filtered
          .filter(c => String(c.name || '').toLowerCase().includes(q))
          .slice(0, 20)
          .map(c => ({ value: String(c._id), label: `${c.name}${c.campus ? ` · ${c.campus}` : ''}${c.year ? ` · ${c.year}` : ''}` }));
        setCourseOpts(opts);
      } catch {
        setCourseOpts([]);
      } finally {
        setLoadingCourses(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debCourse, canSend, me?.role, me?.id]);

  /* buscar alumnos del curso por nombre/email */
  useEffect(() => {
    if (!canSend || !courseId || mode !== 'student') { setStudentOpts([]); return; }
    const q = debStudent.trim().toLowerCase();
    if (!q) { setStudentOpts([]); return; }
    setLoadingStudents(true);
    (async () => {
      try {
        const ORIGIN = (import.meta as any).env?.VITE_API_URL?.replace(/\/$/, '') || '';
        const r = await fetch(`${ORIGIN || ''}/api/courses/${courseId}/roster`, { credentials: 'include' });
        const data = await r.json();
        const rows: any[] = Array.isArray(data.roster) ? data.roster : [];
        const opts = rows
          .map(r => r.student)
          .filter(Boolean)
          .filter((s:any) => (`${s.name || ''} ${s.email || ''}`).toLowerCase().includes(q))
          .slice(0, 20)
          .map((s:any) => ({ value: String(s._id), label: `${s.name || s.email || s._id}` }));
        setStudentOpts(opts);
      } catch {
        setStudentOpts([]);
      } finally {
        setLoadingStudents(false);
      }
    })();
  }, [debStudent, canSend, courseId, mode]);

  /* --- NUEVO: helper para traer replies de una comunicación --- */
  async function fetchReplies(commId: string) {
    const ORIGIN = (import.meta as any).env?.VITE_API_URL?.replace(/\/$/, '') || '';
    const r = await fetch(`${ORIGIN || ''}/api/communications/${commId}/replies`, { credentials: 'include' });
    if (!r.ok) return { replies: [] as any[] };
    return r.json() as Promise<{ replies: any[] }>;
  }

  /* listar */
  const refresh = async () => {
    setLoadingList(true);
    try {
      if (!me) return;

      // Estudiante
      if (me.role === 'student') {
        const { communications } = await listCommunications();
        const withReplies = await Promise.all(
          communications.map(async (c: any) => {
            try {
              const { replies } = await fetchReplies(c._id);
              return { ...c, replies: Array.isArray(replies) ? replies : [] };
            } catch {
              return { ...c, replies: [] };
            }
          })
        );
        setItems(withReplies as any);
        setListError(null);
        return;
      }

      // Staff
      if (!courseId) {
        setItems([]);
        setListError('Elegí un curso para ver comunicaciones');
        return;
      }

      const { communications } = await listCommunications({
        courseId,
        studentId: mode === 'student' ? (studentId || undefined) : undefined,
      });

      const withReplies = await Promise.all(
        communications.map(async (c: any) => {
          try {
            const { replies } = await fetchReplies(c._id);
            return { ...c, replies: Array.isArray(replies) ? replies : [] };
          } catch {
            return { ...c, replies: [] };
          }
        })
      );

      setItems(withReplies as any);
      setListError(null);
    } catch (e:any) {
      setListError(e.message || 'Error al listar');
    } finally {
      setLoadingList(false);
    }
  };

  // Al cargar "me": si es student, lista
  useEffect(() => {
    if (!me) return;
    if (me.role === 'student') refresh();
  }, [me]);

  // Cuando cambian curso/alumno/modo (y no sos student), refresca
  useEffect(() => {
    if (!me || me.role === 'student') return;
    if (!courseId) { setItems([]); setListError('Elegí un curso para ver comunicaciones'); return; }
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, studentId, mode]);

  const readyToSend = useMemo(() => {
    if (!canSend) return false;
    if (!message.trim()) return false;
    if (mode === 'broadcast') return true;
    if (mode === 'course') return !!courseId;
    if (mode === 'student') return !!courseId && !!studentId;
    return false;
  }, [canSend, mode, courseId, studentId, message]);

  const onSend = async () => {
    setSending(true);
    setError(null);
    try {
      const payload: { courseId?: string; studentId?: string; category?: any; message: string } = {
        message: message.trim(),
        category,
      };
      if (mode === 'course' || mode === 'student') payload.courseId = courseId || undefined;
      if (mode === 'student') payload.studentId = studentId || undefined;

      await sendCommunication(payload);
      setMessage('');
      setStudentId('');
      await refresh();
      alert('Mensaje enviado ✅');
    } catch (e:any) {
      setError(e.message || 'Error al enviar');
    } finally {
      setSending(false);
    }
  };

  const onRead = async (id: string) => {
    try { await markRead(id); } catch {}
    setItems(prev => prev.map(i => i._id === id ? { ...i, read: true } : i));
  };

  if (loadingMe) return <div className="p-4">Cargando…</div>;
  if (error) return <div className="p-4 text-danger">{error}</div>;
  if (!me) return <div className="p-4">No logueado</div>;

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      <h2 className="font-heading text-xl">Libro de comunicaciones</h2>
      <p><b>Usuario:</b> {me.name} — <i>{me.role.toUpperCase()}</i></p>

      {canSend && (
        <div className="card p-4">
          <h3 className="font-heading text-lg mb-2">Enviar comunicación</h3>

          {/* radios de destino */}
          <div className="flex flex-wrap gap-4 text-sm">
            {(me.role === 'coordinator' || me.role === 'admin') && (
              <label className="flex items-center gap-2">
                <input type="radio" name="mode" checked={mode === 'broadcast'} onChange={() => setMode('broadcast')} />
                Todos (broadcast)
              </label>
            )}
            <label className="flex items-center gap-2">
              <input type="radio" name="mode" checked={mode === 'course'} onChange={() => setMode('course')} />
              Todos los de un curso
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="mode" checked={mode === 'student'} onChange={() => setMode('student')} />
              Alumno específico de un curso
            </label>
          </div>

          {(mode === 'course' || mode === 'student') && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
              <div>
                <div className="text-sm text-neutral-600 mb-1">Course ID</div>
                <Autocomplete
                  value={courseQuery}
                  onChange={(v) => { setCourseQuery(v); }}
                  onPick={(opt) => {
                    setCourseId(opt.value);
                    setCourseQuery(opt.label);
                    setStudentId('');
                    setStudentQuery('');
                  }}
                  placeholder="Pegá un Course ID o escribí su nombre…"
                  options={courseOpts}
                  loading={loadingCourses}
                />
              </div>
              {mode === 'student' && (
                <div>
                  <div className="text-sm text-neutral-600 mb-1">Student ID</div>
                  <Autocomplete
                    value={studentQuery}
                    onChange={(v) => { setStudentQuery(v); }}
                    onPick={(opt) => { setStudentId(opt.value); setStudentQuery(opt.label); }}
                    placeholder="Pegá un Student ID o escribí su nombre…"
                    options={studentOpts}
                    loading={loadingStudents}
                  />
                </div>
              )}
            </div>
          )}

          {/* mensaje + emojis */}
          <div className="grid grid-cols-1 md:grid-cols-[200px,1fr] gap-3 mt-3">
            <div>
              <div className="text-sm text-neutral-600 mb-1">Categoría</div>
              <select className="input w-full" value={category} onChange={e => setCategory(e.target.value as any)}>
                <option value="tarea">tarea</option>
                <option value="conducta">conducta</option>
                <option value="administrativo">administrativo</option>
                <option value="otro">otro</option>
              </select>
            </div>
            <div>
              <div className="flex gap-2 flex-wrap text-xl mb-1">
                {EMOJIS.map(e => (
                  <button key={e} className="hover:scale-110 transition" title={e} onClick={() => setMessage(m => m + e)}>{e}</button>
                ))}
              </div>
              <textarea
                className="input w-full h-40"
                placeholder="Escribí el mensaje… (podés insertar emojis)"
                value={message}
                onChange={e => setMessage(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-3 flex gap-2">
            <button className="btn btn-primary" onClick={onSend} disabled={!readyToSend || sending}>
              {sending ? 'Enviando…' : 'Enviar'}
            </button>
            <button className="btn" onClick={refresh} disabled={loadingList}>Refrescar</button>
          </div>
          {error && <div className="text-danger mt-2">{error}</div>}
        </div>
      )}

      {/* listado */}
      <div>
        {listError && <div className="text-danger mb-2">{listError}</div>}
        {items.length === 0 ? (
          <div>No hay comunicaciones aún.</div>
        ) : (
          <ul className="space-y-2">
            {items.map((c: any) => (
              <li key={c._id} className="card p-3">
                <div className="flex justify-between gap-3 text-sm">
                  <div className="text-neutral-700">
                    <b>{new Date(c.createdAt).toLocaleString()}</b>
                    {' · '}{c.category}
                    {' · '}{c.role}
                    {c.course ? <> {' · course:'}{c.course}</> : null}
                    {c.student ? <> {' · student:'}{c.student}</> : null}
                  </div>
                  {me?.role === 'student' && !c.read && (
                    <button className="btn btn-secondary !py-1" onClick={() => onRead(c._id)}>Marcar leído</button>
                  )}
                </div>

                <div className="mt-2 whitespace-pre-wrap">{c.message}</div>

                {/* Hilo de respuestas */}
                <RepliesBlock replies={c.replies as any} />

                {/* Responder desde staff */}
                {me && me.role !== 'student' && (
                  <ReplyForm commId={c._id} onSent={refresh} />
                )}

                {me?.role === 'student' && c.read && <small className="text-success">✓ leído</small>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
