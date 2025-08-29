// src/lib/communications.ts
// Helpers de comunicaciones (front). NO usa api(...) como función -> hace fetch a /api/*

/** === Tipos del FRONT (con los nombres que ya usa tu UI) === */
export type Communication = {
  _id: string;
  student: string;
  course: string;
  sender: string;
  role: 'teacher' | 'coordinator' | 'admin'; // mapeado desde senderRole
  category: 'tarea' | 'conducta' | 'administrativo' | 'otro'; // desde TASK/...
  message: string;  // body
  read: boolean;    // readAt != null
  createdAt: string;
};

/** === Mapeos UI <-> API === */
type ApiCategory = 'TASK' | 'BEHAVIOR' | 'ADMIN' | 'INFO';

function uiToApiCategory(ui?: Communication['category']): ApiCategory {
  switch (ui) {
    case 'tarea': return 'TASK';
    case 'conducta': return 'BEHAVIOR';
    case 'administrativo': return 'ADMIN';
    default: return 'INFO';
  }
}
function apiToUiCategory(api: ApiCategory): Communication['category'] {
  switch (api) {
    case 'TASK': return 'tarea';
    case 'BEHAVIOR': return 'conducta';
    case 'ADMIN': return 'administrativo';
    default: return 'otro';
  }
}

/** Normaliza un item del backend al shape que espera tu UI */
function normalizeApiItem(it: any): Communication {
  const course =
    typeof it.course === 'object' && it.course ? String(it.course._id) :
    typeof it.course === 'string' ? it.course : '';

  const student =
    typeof it.student === 'object' && it.student ? String(it.student._id) :
    typeof it.student === 'string' ? it.student : '';

  const sender =
    typeof it.sender === 'object' && it.sender ? String(it.sender._id) :
    typeof it.sender === 'string' ? it.sender : '';

  const role = (it.senderRole as string) as Communication['role'];

  return {
    _id: String(it._id),
    student,
    course,
    sender,
    role,
    category: apiToUiCategory(it.category as ApiCategory),
    message: String(it.body ?? it.message ?? ''),
    read: Boolean(it.readAt),
    createdAt: new Date(it.createdAt || Date.now()).toISOString(),
  };
}

/* ========== HTTP helper (fetch a /api) ========== */
const ORIGIN = (import.meta as any).env?.VITE_API_URL?.replace(/\/$/, '') || '';
const BASE = ORIGIN ? `${ORIGIN}/api` : '/api';

async function http<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    ...init,
    headers: {
      ...(init?.headers || {}),
      ...(init?.body && typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
    },
  });

  const ct = res.headers.get('content-type') || '';
  const isJSON = ct.includes('application/json');
  const payload = isJSON ? await res.json() : (await res.text());

  if (!res.ok) {
    const msg =
      (isJSON && (payload as any)?.error) ||
      (isJSON && (payload as any)?.message) ||
      (typeof payload === 'string' ? payload : `HTTP ${res.status}`);
    throw new Error(msg);
  }
  return payload as T;
}

/* ===============================
 * LISTAR
 * =============================== */
export async function listCommunications(params?: { studentId?: string; courseId?: string }) {
  if (!params || (!params.courseId && !params.studentId)) {
    const r = await http<{ rows: any[] }>('/communications/mine');
    const communications = (r.rows || []).map(normalizeApiItem);
    return { communications };
  }

  const qs = new URLSearchParams();
  if (params.studentId) qs.set('studentId', params.studentId);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const r = await http<{ rows: any[] }>(`/communications/course/${params.courseId}${suffix}`);
  const communications = (r.rows || []).map(normalizeApiItem);
  return { communications };
}

/* ===============================
 * ENVIAR
 * =============================== */
export async function sendCommunication(input: {
  courseId?: string;             // opcional si es broadcast global
  studentId?: string;            // si viene vacío => broadcast al curso
  category?: Communication['category'];
  message: string;
}) {
  // 🔀 Si no viene ni courseId ni studentId => usamos el endpoint de broadcast general
  if (!input.courseId && !input.studentId) {
    const payload = {
      title: (input.category ? input.category.toUpperCase() : 'INFO') + ' · ' + (input.message || '').slice(0, 60),
      body: input.message,
      category: uiToApiCategory(input.category),
      // (opcional: podrías pasar roles/campuses si querés filtrar)
    };
    return http<{ ok: true; sent: number; ids: string[] }>('/communications/broadcast', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Caso normal (curso y opcionalmente alumno)
  const payload = {
    courseId: input.courseId,
    studentId: input.studentId?.trim() || undefined,
    category: uiToApiCategory(input.category),
    title: (input.category ? input.category.toUpperCase() : 'INFO') + ' · ' + (input.message || '').slice(0, 60),
    body: input.message,
  };
  return http<{ ok: true; sent: number; ids: string[] }>('/communications', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/* ===============================
 * MARCAR LEÍDO
 * =============================== */
export async function markRead(id: string) {
  return http<{ ok: true }>(`/communications/${id}/read`, { method: 'PUT' });
}
