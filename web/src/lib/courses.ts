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
  return api<{ courses: any[] }>(`/courses${q}`);
}

export function createCourse(payload: CourseInput) {
  return api<{ course: any }>(`/courses`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function enrollByEmail(payload: { studentEmail: string; courseId: string; practiceEnabled?: boolean }) {
  return api<{ enrollment: any }>(`/enrollments`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}
