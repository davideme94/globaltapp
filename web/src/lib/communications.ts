import { api } from './api';

export type Communication = {
  _id: string;
  student: string;
  course: string;
  sender: string;
  role: 'teacher'|'coordinator'|'admin';
  category: 'tarea'|'conducta'|'administrativo'|'otro';
  message: string;
  read: boolean;
  createdAt: string;
};

export async function listCommunications(params?: { studentId?: string; courseId?: string }) {
  const qs = params ? '?' + new URLSearchParams(params as any).toString() : '';
  return api<{ communications: Communication[] }>(`/communications${qs}`);
}

export async function sendCommunication(input: { studentId: string; courseId: string; category?: Communication['category']; message: string }) {
  return api<{ communication: Communication }>(`/communications`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function markRead(id: string) {
  return api<{ communication: Communication }>(`/communications/${id}/read`, { method: 'PATCH' });
}
