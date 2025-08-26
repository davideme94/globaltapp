import { api } from './api';

export type Campus = 'DERQUI'|'JOSE_C_PAZ';
type Ref<T = { _id: string; name?: string; email?: string; campus?: Campus }> = string | T;
type RefWithTeacher = string | ({ _id: string; name?: string; campus?: Campus; teacher?: Ref<{ _id: string; name?: string }> });

export type TrimBlock = { writing?: number; speaking?: number; reading?: number; listening?: number };

export type ReportCard = {
  _id: string;
  student: Ref;
  course: RefWithTeacher;
  year: number;
  campus?: Campus;
  trimesters: { t1?: TrimBlock; t2?: TrimBlock; t3?: TrimBlock; };
  finals?: { oral?: number; written?: number };
  notes?: string;
  closed: boolean;
  createdBy: Ref<{ _id: string; name?: string }>;
  createdAt: string;
  updatedAt: string;
};

export async function listReportCards(params: { studentId?: string; courseId?: string; year?: number }) {
  const qs = new URLSearchParams(params as any).toString();
  return api<{ reportCards: ReportCard[] }>(`/report-cards${qs ? `?${qs}` : ''}`);
}

export async function upsertReportCard(input: {
  studentId: string; courseId: string; year?: number; campus?: Campus;
  t1?: TrimBlock; t2?: TrimBlock; t3?: TrimBlock;
  finals?: { oral?: number; written?: number };
  notes?: string;
}) {
  return api<{ reportCard: ReportCard; updated: boolean }>(`/report-cards`, {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export async function setReportClosed(id: string, closed: boolean) {
  return api<{ reportCard: ReportCard }>(`/report-cards/${id}/close`, {
    method: 'PATCH',
    body: JSON.stringify({ closed })
  });
}
