import { api } from './api';

export type Topic = {
  _id: string;
  course: string;
  teacher: string;
  date: string;       // YYYY-MM-DD
  content: string;
  attachments?: string[];
  createdAt: string;
};

export async function listTopics(params: { courseId: string; from?: string; to?: string }) {
  const qs = new URLSearchParams(params as any).toString();
  return api<{ topics: Topic[] }>(`/topics?${qs}`);
}

export async function createTopic(input: { courseId: string; date: string; content: string; attachments?: string[] }) {
  return api<{ topic: Topic }>(`/topics`, { method: 'POST', body: JSON.stringify(input) });
}
