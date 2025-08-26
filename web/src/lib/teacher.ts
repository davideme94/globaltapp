import { api } from './api';

// Tipo mínimo esperado; tu API puede traer más campos (ignóralos)
export type TeacherCourse = {
  _id: string;
  name: string;
  year?: number;
  campus?: string; // 'DERQUI' | 'JOSE_C_PAZ'
};

export async function getMyCourses(): Promise<TeacherCourse[]> {
  // La API devuelve { courses: [...] }
  const res = await api<{ courses: TeacherCourse[] }>('/teacher/courses');
  return res.courses || [];
}
