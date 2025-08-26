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

export type AttendanceStatus = 'P' | 'A' | 'T' | 'J';

export function getTeacherCourses(year?: number) {
  const q = year ? `?year=${year}` : '';
  return api<{ courses: any[] }>(`/teacher/courses${q}`);
}

export function getEnrollments(courseId: string) {
  const qs = new URLSearchParams({ courseId });
  return api<{ enrollments: any[] }>(`/enrollments?${qs.toString()}`);
}

export function getAttendance(courseId: string, date: string) {
  const qs = new URLSearchParams({ courseId, date });
  return api<{ attendance: any[] }>(`/attendance?${qs.toString()}`);
}

export function saveAttendanceBulk(courseId: string, date: string, items: { studentId: string; status: AttendanceStatus; notes?: string }[]) {
  return api<{ attendance: any[] }>(`/attendance/bulk`, {
    method: 'POST',
    body: JSON.stringify({ courseId, date, items })
  });
}
