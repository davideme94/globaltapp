// src/pages/CoordinatorStudentSearch.tsx
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api, type Course } from '../lib/api';

/* ----------------- helpers ----------------- */
type Campus = 'DERQUI' | 'JOSE_C_PAZ' | string;

type TeacherMini = { _id: string; name: string; photoUrl?: string | null };
type CourseMini = { _id: string; name: string; year: number; campus: Campus; teacher?: TeacherMini | null };

type Row = {
  _id: string;
  name: string;
  email?: string;
  photoUrl?: string;
  dob?: string | null;
  phone?: string;
  tutor?: string;
  tutorPhone?: string;
  campus?: Campus;
  courses: CourseMini[];
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

const ORIGIN = (import.meta as any).env?.VITE_API_URL?.replace(/\/$/, '') || '';
function resolveUploadUrl(url?: string | null) {
  if (!url) return '';
  const clean = String(url).trim();
  if (!clean) return '';
  if (/^https?:\/\//i.test(clean)) return clean;
  return clean.startsWith('/uploads/') && ORIGIN ? `${ORIGIN}${clean}` : clean;
}

function initialsFromName(name: string) {
  return (name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('') || '??';
}

function Avatar({ name, photoUrl, size = 36 }: { name: string; photoUrl?: string | null; size?: number }) {
  const src = resolveUploadUrl(photoUrl);
  const fallback = `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(initialsFromName(name))}`;
  return (
    // eslint-disable-next-line jsx-a11y/img-redundant-alt
    <img
      src={src || fallback}
      alt={`Foto de ${name}`}
      className="rounded-full object-cover bg-neutral-200"
      style={{ width: size, height: size }}
      onError={(e) => {
        const el = e.currentTarget as HTMLImageElement;
        if (el.src !== fallback) el.src = fallback;
      }}
    />
  );
}

/* ----------------- página ----------------- */
export default function CoordinatorStudentSearch() {
  const loc = useLocation();
  const urlQ = new URLSearchParams(loc.search).get('q') || '';

  const [q, setQ] = useState(urlQ);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [campus, setCampus] = useState<Campus | 'ALL'>('ALL');

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);

  // cargar al entrar si viene ?q= desde el buscador global
  useEffect(() => {
    if ((urlQ || '').trim()) {
      onSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // una vez

  /** 🔹 Fallback a tu método anterior (cursos+roster) por compatibilidad */
  async function buildFromRoster(): Promise<Row[]> {
    const list = await api.courses.list({
      year,
      campus: campus === 'ALL' ? (undefined as any) : (campus as any),
    });
    const courses = (list.courses || []) as Course[];

    const map = new Map<string, Row>();
    for (const c of courses) {
      try {
        const r = await api.courses.roster(c._id);
        for (const it of r.roster || []) {
          const s: any = it?.student || {};
          if (!s?._id) continue;

          // filtro por q
          if (q.trim()) {
            const hay = (`${s.name || ''} ${s.email || ''}`)
              .toLowerCase()
              .includes(q.trim().toLowerCase());
            if (!hay) continue;
          }

          if (!map.has(s._id)) {
            map.set(s._id, {
              _id: s._id,
              name: s.name,
              email: s.email,
              photoUrl: s.photoUrl,
              dob: s.dob,
              phone: s.phone,
              tutor: s.tutor || s.tutorName,
              tutorPhone: s.tutorPhone,
              courses: [
                {
                  _id: c._id,
                  name: c.name,
                  year: c.year,
                  campus: c.campus as Campus,
                  // teacher puede venir poblado en /courses si lo tenés así
                  // @ts-ignore
                  teacher: (c as any).teacher
                    ? {
                        // @ts-ignore
                        _id: String((c as any).teacher._id),
                        // @ts-ignore
                        name: (c as any).teacher.name,
                        // @ts-ignore
                        photoUrl: (c as any).teacher.photoUrl || null,
                      }
                    : null,
                },
              ],
            });
          } else {
            const row = map.get(s._id)!;
            if (!row.courses.some((x) => x._id === c._id)) {
              row.courses.push({
                _id: c._id,
                name: c.name,
                year: c.year,
                campus: c.campus as Campus,
                // @ts-ignore
                teacher: (c as any).teacher
                  ? {
                      // @ts-ignore
                      _id: String((c as any).teacher._id),
                      // @ts-ignore
                      name: (c as any).teacher.name,
                      // @ts-ignore
                      photoUrl: (c as any).teacher.photoUrl || null,
                    }
                  : null,
              });
            }
          }
        }
      } catch {
        // si el roster falla, seguimos con el resto
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
    );
  }

  async function onSearch() {
    setLoading(true);
    setError(null);
    try {
      // 🔸 Primero intento el endpoint nuevo (más eficiente y ya trae teacher+foto)
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      params.set('year', String(year));
      if (campus !== 'ALL') params.set('campus', String(campus));

      const resp = await fetch(`/api/students/courses?${params.toString()}`, {
        credentials: 'include',
      });

      if (resp.ok) {
        const data = await resp.json();
        setRows((data.rows || []) as Row[]);
      } else {
        // Fallback silencioso a método anterior
        const fallbackRows = await buildFromRoster();
        setRows(fallbackRows);
      }
    } catch {
      // Fallback si hubo error de red
      try {
        const fallbackRows = await buildFromRoster();
        setRows(fallbackRows);
      } catch (e: any) {
        setError(e?.message || 'Error al buscar alumnos');
        setRows([]);
      }
    } finally {
      setLoading(false);
    }
  }

  const yearOpts = useMemo(() => {
    const y = new Date().getFullYear();
    return [y - 1, y, y + 1];
  }, []);

  return (
    <div className="space-y-3">
      <h1 className="font-heading text-xl">Buscar alumno</h1>

      {/* filtros */}
      <div className="card p-3 flex flex-col md:flex-row gap-2 md:items-center">
        <input
          className="input w-full md:w-[420px]"
          placeholder="Nombre o email del alumno"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSearch();
          }}
        />
        <select
          className="input w-full md:w-[120px]"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
        >
          {yearOpts.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <select
          className="input w-full md:w-[180px]"
          value={campus}
          onChange={(e) => setCampus(e.target.value as any)}
        >
          <option value="ALL">Todas las sedes</option>
          <option value="DERQUI">DERQUI</option>
          <option value="JOSE_C_PAZ">JOSE_C_PAZ</option>
        </select>
        <button className="btn btn-secondary md:ml-auto" onClick={onSearch} disabled={loading}>
          {loading ? 'Buscando…' : 'Buscar'}
        </button>
      </div>

      {/* errores */}
      {error && <div className="text-danger">{error}</div>}

      {/* tabla */}
      <div className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 bg-white">
            <tr className="text-left text-neutral-700">
              <th className="px-3 py-2 border-b">Alumno</th>
              <th className="px-3 py-2 border-b">Curso(s) y Docente</th>
              <th className="px-3 py-2 border-b">Edad</th>
              <th className="px-3 py-2 border-b">Tel.</th>
              <th className="px-3 py-2 border-b">Tutor</th>
              <th className="px-3 py-2 border-b">Tel. Tutor</th>
              <th className="px-3 py-2 border-b">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="px-3 py-6">
                  <div className="h-16 skeleton" />
                </td>
              </tr>
            )}

            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-neutral-700">
                  Sin resultados. Escribí al menos 3 letras del nombre o email y presioná “Buscar”.
                </td>
              </tr>
            )}

            {!loading &&
              rows.map((s) => {
                const c0 = s.courses[0];

                return (
                  <tr key={s._id} className="border-t align-top">
                    {/* Alumno */}
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-3">
                        <Avatar name={s.name} photoUrl={s.photoUrl} />
                        <div className="min-w-0">
                          <div className="font-medium truncate">{s.name}</div>
                          <div className="text-xs text-neutral-600 truncate">{s.email || '—'}</div>
                        </div>
                      </div>
                    </td>

                    {/* Cursos + Docente */}
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-2">
                        {s.courses && s.courses.length ? (
                          s.courses.map((c) => (
                            <div key={c._id} className="flex items-center gap-2">
                              <span className="inline-flex items-center rounded-lg bg-neutral-50 px-2 py-1">
                                <span className="font-medium">{c.name}</span>
                                <span className="mx-1 text-neutral-600">—</span>
                                <span className="text-neutral-700">{c.campus}</span>
                                {c.year ? <span className="ml-1 text-neutral-600">({c.year})</span> : null}
                              </span>
                              {c.teacher && (
                                <span className="inline-flex items-center gap-2">
                                  <Avatar name={c.teacher.name} photoUrl={c.teacher.photoUrl} size={20} />
                                  <span className="text-neutral-800">{c.teacher.name}</span>
                                </span>
                              )}
                            </div>
                          ))
                        ) : (
                          <span>—</span>
                        )}
                      </div>
                    </td>

                    {/* Edad */}
                    <td className="px-3 py-2">{calcAge(s.dob) || '—'}</td>

                    {/* Tel alumno */}
                    <td className="px-3 py-2">{s.phone || '—'}</td>

                    {/* Tutor */}
                    <td className="px-3 py-2">{s.tutor || '—'}</td>

                    {/* Tel tutor */}
                    <td className="px-3 py-2">{s.tutorPhone || '—'}</td>

                    {/* Acciones */}
                    <td className="px-3 py-2 whitespace-nowrap">
                      {c0 ? (
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <Link to={`/coordinator/course/${c0._id}/boletin`} className="text-brand-primary underline">
                            Boletín
                          </Link>
                          <span>·</span>
                          <Link to={`/coordinator/course/${c0._id}/partials`} className="text-brand-primary underline">
                            Reporte parcial
                          </Link>
                          <span>·</span>
                          <Link to={`/coordinator/course/${c0._id}/british`} className="text-brand-primary underline">
                            Británico
                          </Link>
                          <span>·</span>
                          <Link to={`/communications`} className="text-brand-primary underline">
                            Comunicaciones
                          </Link>
                        </div>
                      ) : (
                        <span className="text-neutral-500">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
