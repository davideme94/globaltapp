// web/src/pages/TeacherCourseStudents.tsx
import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, type RosterItem, type CaseCategory, type CaseSeverity } from '../lib/api';

type Row = {
  _id: string;
  name: string;
  email?: string;
  photoUrl?: string;
  dob?: string | null;
  tutor?: string;
  tutorPhone?: string;
};

/* ==== helpers ==== */
const ORIGIN = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

function resolveUploadUrl(url?: string | null) {
  if (!url) return '';
  const clean = String(url).trim();
  if (!clean) return '';
  if (/^https?:\/\//i.test(clean)) return clean; // ya es absoluta
  return clean.startsWith('/uploads/') && ORIGIN ? `${ORIGIN}${clean}` : clean;
}

function ageFromDob(dob?: string | null) {
  if (!dob) return '';
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
  return String(a);
}

function Avatar({ name, photoUrl }: { name: string; photoUrl?: string }) {
  const initials =
    (name || '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() || '')
      .join('') || '??';

  const src = resolveUploadUrl(photoUrl);
  const fallback = `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(initials)}`;

  return (
    <img
      src={src || fallback}
      alt={name}
      className="h-9 w-9 rounded-full object-cover bg-neutral-200"
      onError={(e) => {
        const img = e.currentTarget as HTMLImageElement;
        if (img.src !== fallback) img.src = fallback;
      }}
    />
  );
}

type ModalState = { open: boolean; studentId?: string };

export default function TeacherCourseStudents() {
  const { id: courseId } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [courseName, setCourseName] = useState<string>('');
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState('');

  // ⚠️ Modal “Nuevo caso”
  const [modal, setModal] = useState<ModalState>({ open: false });
  const [category, setCategory] = useState<CaseCategory>('ACADEMIC_DIFFICULTY');
  const [severity, setSeverity] = useState<CaseSeverity>('MEDIUM');
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!courseId) return;
      setLoading(true);
      try {
        // Título del curso (ligero)
        const meta = await api.courses.schedule.get(courseId).catch(() => null);
        if (alive && meta?.course?.name) {
          setCourseName(
            `${meta.course.name}${meta.course.year ? ` (${meta.course.year})` : ''}`
          );
        }

        // Roster del curso
        const r = await api.courses.roster(courseId);
        const list: Row[] = (r.roster || []).map((it: RosterItem) => {
          const s = it.student as any;
          return {
            _id: s._id,
            name: s.name,
            email: s.email,
            photoUrl: s.photoUrl,
            dob: s.dob,
            tutor: s.tutor,
            tutorPhone: s.tutorPhone,
          };
        });
        list.sort((a, b) =>
          a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
        );
        if (alive) setRows(list);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [courseId]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return rows;
    return rows.filter((r) =>
      (`${r.name} ${r.email || ''}`).toLowerCase().includes(qq)
    );
  }, [rows, q]);

  async function createCase() {
    if (!modal.studentId || !courseId) return;
    await api.cases.create({
      studentId: modal.studentId,
      courseId,
      title: title.trim() || 'Seguimiento',
      description: desc.trim(),
      category,
      severity,
    });
    setModal({ open: false });
    setTitle(''); setDesc('');
    alert('Caso creado ✅');
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-heading text-xl">
          Alumnos {courseName ? `— ${courseName}` : ''}
        </h1>
        <Link to="/teacher/courses" className="btn btn-secondary">
          ← Mis cursos
        </Link>
      </div>

      <div className="card p-3">
        <input
          className="input w-full md:w-96"
          placeholder="Buscar por nombre o email…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="card">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="p-3">Alumno</th>
              <th className="p-3">Edad</th>
              <th className="p-3">Tutor</th>
              <th className="p-3">Tel. Tutor</th>
              <th className="p-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td className="p-3" colSpan={5}>
                  Cargando…
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td className="p-3" colSpan={5}>
                  Sin alumnos.
                </td>
              </tr>
            )}
            {!loading &&
              filtered.map((s) => (
                <tr key={s._id} className="border-t">
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={s.name} photoUrl={s.photoUrl} />
                      <div>
                        <div className="font-medium">{s.name}</div>
                        <div className="text-neutral-600 text-xs">
                          {s.email || ''}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-3">{ageFromDob(s.dob) || '—'}</td>
                  <td className="p-3">{s.tutor || '—'}</td>
                  <td className="p-3">{s.tutorPhone || '—'}</td>
                  <td className="p-3">
                    <button
                      className="btn btn-secondary !py-1"
                      onClick={() => setModal({ open: true, studentId: s._id })}
                    >
                      ⚠️ Reportar
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Modal Nuevo caso */}
      {modal.open && (
        <div
          className="fixed inset-0 bg-black/20 flex items-center justify-center p-4"
          onClick={(e)=>{ if(e.target===e.currentTarget) setModal({ open:false }); }}
        >
          <div className="card w-full max-w-xl p-4">
            <h3 className="font-heading text-lg mb-2">Nuevo caso</h3>
            <div className="grid gap-2">
              <select className="input" value={category} onChange={e=>setCategory(e.target.value as CaseCategory)}>
                <option value="ACADEMIC_DIFFICULTY">Dificultades académicas</option>
                <option value="ATTENDANCE">Asistencia</option>
                <option value="BEHAVIOR">Conducta</option>
                <option value="ADMIN">Administrativo</option>
                <option value="OTHER">Otro</option>
              </select>
              <select className="input" value={severity} onChange={e=>setSeverity(e.target.value as CaseSeverity)}>
                <option value="LOW">Baja</option>
                <option value="MEDIUM">Media</option>
                <option value="HIGH">Alta</option>
              </select>
              <input className="input" placeholder="Título" value={title} onChange={e=>setTitle(e.target.value)} />
              <textarea className="input h-28" placeholder="Descripción" value={desc} onChange={e=>setDesc(e.target.value)} />
              <div className="flex gap-2">
                <button className="btn btn-primary" onClick={createCase}>Crear</button>
                <button className="btn" onClick={()=>setModal({ open:false })}>Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
