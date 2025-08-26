import { api } from './api';

export type Enrollment = {
  _id: string;
  course: string; // ObjectId string
  status?: string;
  // student puede venir como string o como objeto poblado, soportamos ambos
  student: string | { _id: string; name?: string; email?: string };
};

export async function getEnrollmentsByCourse(courseId: string): Promise<Enrollment[]> {
  const qs = new URLSearchParams({ courseId }).toString();
  const res = await api<{ enrollments: Enrollment[] }>(`/enrollments?${qs}`);
  return res.enrollments || [];
}
