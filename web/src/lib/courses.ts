// ─────────────────────────────────────────────────────────────────────────────
// ORIGINAL
const API_URL = import.meta.env.VITE_API_URL as string;

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => res.statusText);
    throw new Error(txt || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}
// ─────────────────────────────────────────────────────────────────────────────

// 🔧 NUEVO: base consistente con el resto del front (/api) y fallback a proxy
const __ORIGIN = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const __BASE = __ORIGIN ? `${__ORIGIN}/api` : '/api';

/**
 * 🔧 NUEVO http<T>:
 * - Usa __BASE (…/api o /api) para que funcione con proxy de Vite.
 * - Misma semántica que la función original `api`, no rompe nada.
 */
async function http<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${__BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => res.statusText);
    throw new Error(txt || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

/**
 * (Opcional) Mantengo una referencia para detectar usos accidentales de la `api` local.
 * No borro nada del código original; si alguna vez se usa esta función por error,
 * se podría habilitar el warning:
 */
// @ts-ignore
const __deprecated_api = api;
// console.warn('Aviso: estás usando la función local api(...) de lib/courses.ts. Preferí http(...) o lib/api.ts');

export type CourseInput = {
  name: string;
  level?: string;
  year: number;
  campus: 'DERQUI' | 'JOSE_C_PAZ';
  teacherEmail?: string;
  teacherId?: string;
  daysOfWeek?: number[];
  startTime?: string;
  endTime?: string;
  materials?: string[];
};

export function getCourses(params?: { year?: number; campus?: 'DERQUI' | 'JOSE_C_PAZ' }) {
  const qs = new URLSearchParams();
  if (params?.year) qs.set('year', String(params.year));
  if (params?.campus) qs.set('campus', params.campus);
  const q = qs.toString() ? `?${qs.toString()}` : '';
  // 🔧 Antes: return api<{ courses: any[] }>(`/courses${q}`);
  return http<{ courses: any[] }>(`/courses${q}`);
}

export function createCourse(payload: CourseInput) {
  // 🔧 Antes: return api<{ course: any }>(`/courses`, { … })
  return http<{ course: any }>(`/courses`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function enrollByEmail(payload: { studentEmail: string; courseId: string; practiceEnabled?: boolean }) {
  // 🔧 Antes: return api<{ enrollment: any }>(`/enrollments`, { … })
  return http<{ enrollment: any }>(`/enrollments`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}
