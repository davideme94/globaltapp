import { api } from './api';

export type GradeLetter = 'A'|'B'|'C'|'D'|'E';

type Ref<T = { _id: string; name?: string; email?: string }> = string | T;
type RefWithTeacher = string | ({ _id: string; name?: string; teacher?: Ref<{ _id: string; name?: string }> });

export type PartialReport = {
  _id: string;
  student: Ref;
  course: RefWithTeacher;
  year: number;
  period: 'MAYO' | 'OCTUBRE';
  text: string;
  grades?: {
    reading?: GradeLetter;
    writing?: GradeLetter;
    listening?: GradeLetter;
    speaking?: GradeLetter;
    attendance?: GradeLetter;
    commitment?: GradeLetter;
  };
  createdBy: Ref<{ _id: string; name?: string }>;
  createdAt: string;
  updatedAt: string;
};

export async function listPartialReports(params: { studentId?: string; courseId?: string; year?: number; period?: 'MAYO'|'OCTUBRE' }) {
  const qs = new URLSearchParams(params as any).toString();
  return api<{ partialReports: PartialReport[] }>(`/partial-reports${qs ? `?${qs}` : ''}`);
}

export async function upsertPartialReport(input: {
  studentId: string;
  courseId: string;
  year?: number;
  period: 'MAYO'|'OCTUBRE';
  text?: string;
  grades?: PartialReport['grades'];
}) {
  return api<{ partialReport: PartialReport; updated: boolean }>(`/partial-reports`, {
    method: 'POST',
    body: JSON.stringify(input)
  });
}
