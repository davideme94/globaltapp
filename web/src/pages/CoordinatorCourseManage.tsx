import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Toaster, toast } from "sonner";

/* ====== Tipos ====== */
type RosterItem = {
  student: {
    _id: string;
    name: string;
    email?: string;
    photoUrl?: string;

    // NUEVO / compat
    age?: number | null;
    dob?: string | null;          // YYYY-MM-DD
    tutor?: string;
    tutorName?: string;
    tutorPhone?: string;
  };
};
type CourseInfo = { _id: string; name: string; year: number; campus?: string };
type PickRow = { _id: string; name: string; email?: string };

/* ====== BASE URL: siempre con /api ====== */
const ORIGIN = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const BASE = ORIGIN ? `${ORIGIN}/api` : "/api";

/* ===== Helpers extra para avatar ===== */
function resolveUploadUrl(url?: string | null) {
  if (!url) return "";
  const clean = String(url).trim();
  if (!clean) return "";
  if (/^https?:\/\//i.test(clean)) return clean; // ya es absoluta
  // si es relativa a /uploads, armar absoluta contra VITE_API_URL
  return clean.startsWith("/uploads/") && ORIGIN ? `${ORIGIN}${clean}` : clean;
}
function initialsFromName(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");
}

/* ====== HTTP helpers ====== */
const http = async (
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: any
) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  const ct = res.headers.get("content-type") || "";
  const isJSON = ct.includes("application/json");
  const payload = isJSON ? await res.json() : (await res.text())?.replace(/<[^>]*>/g, "").trim();

  if (!res.ok) {
    const msg =
      (isJSON && (payload as any)?.error) ||
      (isJSON && (payload as any)?.message) ||
      (typeof payload === "string" ? payload : `HTTP ${res.status}`);
    throw new Error(msg);
  }
  return payload;
};
const get = (p: string) => http("GET", p);
const post = (p: string, b: any) => http("POST", p, b);

/* ====== Pantalla ====== */
export default function CoordinatorCourseManage() {
  const { id: courseId = "" } = useParams<{ id: string }>();
  const [course, setCourse] = useState<CourseInfo | null>(null);
  const [roster, setRoster] = useState<RosterItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PickRow[]>([]);
  const [searching, setSearching] = useState(false);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  /* Cargar curso + roster */
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const list = await get(`/courses?year=${new Date().getFullYear()}`).catch(() => ({ courses: [] as CourseInfo[] }));
        const c = (list.courses as CourseInfo[]).find((x) => x._id === courseId) || null;
        if (alive) setCourse(c);

        const r = await get(`/courses/${courseId}/roster`);
        if (alive) setRoster(Array.isArray(r.roster) ? r.roster : []);
      } catch (e: any) {
        if (alive) setErr(e?.message || String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [courseId]);

  /* Búsqueda (debounce) */
  useEffect(() => {
    if (!adding) return;
    const t = setTimeout(async () => {
      const term = q.trim();
      if (!term) { setResults([]); return; }
      setSearching(true);
      try {
        const rs = await searchStudents(term);
        const enrolled = new Set(roster.map(r => r.student._id));
        setResults(rs.filter(r => !enrolled.has(r._id)));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q, adding, roster]);

  const sorted = useMemo(
    () => roster.slice().sort((a, b) => (a.student.name || "").localeCompare(b.student.name || "")),
    [roster]
  );

  /* Inscribir por ID */
  const onAdd = async (studentId: string) => {
    setBusyId(studentId);
    try {
      await post(`/courses/${courseId}/enroll`, { studentId });
      toast.success("Alumno agregado");
      const r = await get(`/courses/${courseId}/roster`);
      setRoster(Array.isArray(r.roster) ? r.roster : []);
    } catch (e: any) {
      toast.error(e?.message || "No se pudo agregar");
    } finally {
      setBusyId(null);
    }
  };

  /* Inscribir por ID o Email (autoCreate) */
  const onAddByInput = async (raw: string) => {
    const v = raw.trim();
    if (!v) return;
    setBusyId(v);
    try {
      if (v.includes("@")) {
        const r = await post(`/courses/${courseId}/enroll`, { email: v, autoCreate: true });
        if (r?.createdPassword) toast.success(`Usuario creado. Contraseña: ${r.createdPassword}`);
      } else {
        await post(`/courses/${courseId}/enroll`, { studentId: v });
      }
      toast.success("Alumno agregado");
      const rr = await get(`/courses/${courseId}/roster`);
      setRoster(Array.isArray(rr.roster) ? rr.roster : []);
      setQ("");
      setResults([]);
    } catch (e: any) {
      toast.error(e?.message || "No se pudo agregar");
    } finally {
      setBusyId(null);
    }
  };

  /* Quitar del curso */
  const onRemove = async (studentId: string) => {
    if (!confirm("¿Quitar este alumno del curso?")) return;
    setBusyId(studentId);
    try {
      await http("DELETE", `/courses/${courseId}/enroll/${studentId}`);
      toast.success("Alumno quitado");
      setRoster((s) => s.filter((x) => x.student._id !== studentId));
    } catch (e: any) {
      toast.error(e?.message || "No se pudo quitar");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-xl">Gestionar curso</h1>
          <div className="text-sm text-neutral-700 mt-1">
            {course ? (<><b>{course.name}</b> · {course.year} · {course.campus || "—"}</>) : "(cargando curso...)"}
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => { setAdding(true); setQ(""); setResults([]); }}>
          Agregar alumnos
        </button>
      </div>

      {/* Tabla */}
      <div className="card overflow-x-auto">
        <table className="min-w-full">
          <thead className="sticky top-0 bg-white">
            <tr className="text-left text-sm text-neutral-700">
              {["Alumno", "Edad", "Tutor", "Tel. Tutor", "Email", "Acciones"].map((h) => (
                <th key={h} className="px-3 py-2 border-b border-neutral-200">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="text-sm">
            {loading && (<tr><td colSpan={6} className="px-3 py-6"><div className="h-16 skeleton" /></td></tr>)}
            {!loading && sorted.map((r) => {
              const s = r.student;
              const src = resolveUploadUrl(s.photoUrl);
              const initials = initialsFromName(s.name || "A");
              const fallback = `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(initials || "A")}`;
              return (
                <tr key={s._id} className="hover:bg-neutral-50">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-neutral-200 overflow-hidden flex items-center justify-center text-xs font-semibold text-neutral-700">
                        {src ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={src}
                            alt={s.name}
                            className="h-8 w-8 object-cover"
                            onError={(e) => { e.currentTarget.src = fallback; }}
                          />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={fallback} alt={s.name} className="h-8 w-8 object-cover" />
                        )}
                      </div>
                      <div className="font-medium">{s.name}</div>
                    </div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {s.age ?? ageFrom(s.dob ?? undefined) ?? "—"}
                  </td>
                  <td className="px-3 py-2">{s.tutorName || s.tutor || "—"}</td>
                  <td className="px-3 py-2">{s.tutorPhone || "—"}</td>
                  <td className="px-3 py-2">{s.email || "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <button
                      className="btn btn-secondary !py-1"
                      onClick={() => onRemove(s._id)}
                      disabled={busyId === s._id}
                    >
                      Quitar
                    </button>
                  </td>
                </tr>
              );
            })}
            {!loading && sorted.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-neutral-700">No hay alumnos en este curso.</td></tr>
            )}
            {err && <tr><td colSpan={6} className="px-3 py-3 text-danger">{err}</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Modal agregar */}
      {adding && (
        <div
          className="fixed inset-0 bg-black/20 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setAdding(false); }}
        >
          <div className="card w-full max-w-2xl p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-lg">Agregar alumnos</h2>
              <button className="btn btn-secondary !py-1" onClick={() => setAdding(false)}>Cerrar</button>
            </div>

            <div className="mt-3">
              <input
                className="input"
                placeholder="Buscar por nombre / email… (o pegá un ID/email)"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <p className="text-xs text-neutral-700 mt-1">
                Tip: también podés agregar directo por <b>ID</b> o <b>email</b>.
              </p>
            </div>

            <div className="mt-3 max-h-72 overflow-auto border rounded">
              {searching && <div className="p-3 text-sm">Buscando…</div>}
              {!searching && results.length === 0 && q && <div className="p-3 text-sm">Sin resultados.</div>}
              {!searching && results.map((u) => (
                <div key={u._id} className="flex items-center justify-between p-3 border-b">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{u.name}</div>
                    <div className="text-xs text-neutral-700 truncate">{u.email || u._id}</div>
                  </div>
                  <button
                    className="btn btn-primary !py-1"
                    onClick={() => onAdd(u._id)}
                    disabled={busyId === u._id}
                  >
                    Agregar
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-3">
              <button
                className="btn btn-primary"
                disabled={!q.trim()}
                onClick={() => onAddByInput(q)}
              >
                Agregar por ID/Email: {q.trim() || "—"}
              </button>
            </div>
          </div>
        </div>
      )}

      <Toaster richColors closeButton position="top-right" />
    </div>
  );
}

/* ===== helpers ===== */
function ageFrom(dob?: string | null) {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

/* Buscar alumnos por nombre/email */
async function searchStudents(q: string): Promise<PickRow[]> {
  const endpoints = [
    `/users/search?role=student&q=${encodeURIComponent(q)}`,
    `/students/search?q=${encodeURIComponent(q)}`,
    `/users?role=student&q=${encodeURIComponent(q)}`
  ];
  for (const p of endpoints) {
    try {
      const r = await fetch(`${BASE}${p}`, { credentials: "include" });
      if (!r.ok) continue;
      const data = await r.json();
      const arr: any[] = data.rows || data.students || data.users || data.items || [];
      if (Array.isArray(arr) && arr.length) {
        return arr.map((u: any) => ({ _id: u._id, name: u.name, email: u.email }));
      }
    } catch { /* siguiente */ }
  }
  return [];
}
