// web/src/pages/TeacherStudents.tsx
import { useEffect, useMemo, useState } from 'react';
import { api, type Course, type CaseCategory, type CaseSeverity } from '../lib/api';

type StudentRow = {
  _id: string;
  name: string;
  email?: string;
  photoUrl?: string;
  dob?: string | null;
  tutor?: string;
  tutorPhone?: string;
  courses: string[]; // siempre mostramos a todos los roles
};

function calcAge(dob?: string | null) {
  if (!dob) return '';
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return String(age);
}

function resolveUploadUrl(url?: string | null) {
  if (!url) return '';
  const clean = String(url).trim();
  if (!clean) return '';
  if (/^https?:\/\//i.test(clean)) return clean; // absoluta
  const ORIGIN = (import.meta as any).env?.VITE_API_URL?.replace(/\/$/, '') || '';
  return clean.startsWith('/uploads/') && ORIGIN ? `${ORIGIN}${clean}` : clean;
}

function Avatar({ name, photoUrl }: { name: string; photoUrl?: string }) {
  const initials =
    (name || '')
      .split(' ')
      .map(s => s[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || '??';

  const src = resolveUploadUrl(photoUrl);
  const fallback = `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(initials)}`;

  return (
    <div className="flex items-center gap-3">
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      <img
        src={src || fallback}
        className="h-9 w-9 rounded-full object-cover"
        onError={(e) => { (e.currentTarget as HTMLImageElement).src = fallback; }}
      />
      <span className="font-medium">{name}</span>
    </div>
  );
}

// ¿Este curso es del profe?
function isMine(c: any, myId: string): boolean {
  const t = c?.teacher;
  if (!t) return false;
  if (typeof t === 'string') return String(t) === String(myId);
  if (typeof t === 'object') return String(t?._id || '') === String(myId);
  return false;
}

type ModalState = { open: boolean; studentId?: string; courseId?: string };

export default function TeacherStudents() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [q, setQ] = useState('');
  const [err, setErr] = useState<string | null>(null);

  // ⚠️ Modal “Nuevo caso”
  const [modal, setModal] = useState<ModalState>({ open: false });
  const [category, setCategory] = useState<CaseCategory>('ACADEMIC_DIFFICULTY');
  const [severity, setSeverity] = useState<CaseSeverity>('MEDIUM');
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        // 1) quién soy
        const me = await api.me().then(r => r.user).catch(() => null);
        if (!me) { setRows([]); return; }

        const year = new Date().getFullYear();

        // 2) Traigo cursos del año
        const all = await api.courses.list({ year }).catch(() => ({ courses: [] as Course[] }));
        let courses: Course[] = all.courses || [];

        // 3) Filtro por rol: teacher ve solo los suyos; coord/admin ven todos
        if (me.role === 'teacher') {
          courses = courses.filter(c => isMine(c, me.id));
        }

        // 4) Traigo rosters junto al curso correspondiente
        const pairs = await Promise.all(
          courses.map(async (c) => {
            const r = await api.courses.roster(c._id).catch(() => ({ roster: [] as any[] }));
            return { course: c, roster: r.roster || [] };
          })
        );

        // 5) Deduplico alumnos y acumulo cursos (label: "Nombre (Año)")
        const map = new Map<string, StudentRow>();
        for (const { course, roster } of pairs) {
          const label = `${course.name}${course.year ? ` (${course.year})` : ''}`;
          for (const item of roster) {
            const s = item?.student;
            if (!s?._id) continue;
            const existed = map.get(s._id);
            const set = new Set(existed?.courses || []);
            set.add(label);
            map.set(s._id, {
              _id: s._id,
              name: s.name || existed?.name || '',
              email: s.email || existed?.email,
              photoUrl: s.photoUrl || existed?.photoUrl,
              dob: (s.dob ?? existed?.dob) as any,
              tutor: s.tutor || s.tutorName || existed?.tutor,
              tutorPhone: s.tutorPhone || existed?.tutorPhone,
              courses: Array.from(set),
            });
          }
        }

        const list = Array.from(map.values()).sort((a, b) =>
          a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
        );

        if (alive) setRows(list);
      } catch (e: any) {
        if (alive) { setErr(e?.message || 'No se pudieron cargar los alumnos.'); setRows([]); }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return rows;
    return rows.filter(r =>
      (`${r.name} ${r.email || ''} ${(r.courses || []).join(' ')}`).toLowerCase().includes(qq)
    );
  }, [rows, q]);

  async function createCase() {
    if (!modal.studentId) return;
    await api.cases.create({
      studentId: modal.studentId,
      courseId: modal.courseId, // acá suele ser undefined (lista global)
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
      <h1 className="font-heading text-xl">Alumnos</h1>

      <div className="card p-3">
        <input
          className="input w-full md:w-96"
          placeholder="Buscar por nombre, email o curso…"
          value={q}
          onChange={e => setQ(e.target.value)}
        />
      </div>

      <div className="card">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="p-3">Alumno</th>
              <th className="p-3">Curso(s)</th>
              <th className="p-3">Edad</th>
              <th className="p-3">Tutor</th>
              <th className="p-3">Tel. Tutor</th>
              <th className="p-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td className="p-3" colSpan={6}>Cargando…</td></tr>
            )}
            {!loading && err && (
              <tr><td className="p-3 text-danger" colSpan={6}>{err}</td></tr>
            )}
            {!loading && !err && filtered.length === 0 && (
              <tr><td className="p-3" colSpan={6}>No hay alumnos.</td></tr>
            )}
            {!loading && !err && filtered.map(s => (
              <tr key={s._id} className="border-t">
                <td className="p-3">
                  <Avatar name={s.name} photoUrl={s.photoUrl} />
                </td>
                <td className="p-3">
                  {Array.isArray(s.courses) && s.courses.length
                    ? s.courses.join(' · ')
                    : '—'}
                </td>
                <td className="p-3">{calcAge(s.dob) || '—'}</td>
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
