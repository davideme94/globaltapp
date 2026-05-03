// web/src/pages/StudentCommunications.tsx
import { useEffect, useMemo, useState } from 'react';
import { api, type Communication } from '../lib/api';

// Mapa con categorías + alias por si llegan variantes viejas
const CAT_MAP: Record<string, { name: string; color: string; classes: string; icon: string }> = {
  TASK: {
    name: 'Tarea',
    color: '#0ea5e9',
    classes: 'border-sky-100 bg-sky-50 text-sky-700',
    icon: '📝',
  },
  TASKS: {
    name: 'Tarea',
    color: '#0ea5e9',
    classes: 'border-sky-100 bg-sky-50 text-sky-700',
    icon: '📝',
  },
  BEHAVIOR: {
    name: 'Conducta',
    color: '#ef4444',
    classes: 'border-rose-100 bg-rose-50 text-rose-700',
    icon: '⚠️',
  },
  BEHAVIOUR: {
    name: 'Conducta',
    color: '#ef4444',
    classes: 'border-rose-100 bg-rose-50 text-rose-700',
    icon: '⚠️',
  },
  ADMIN: {
    name: 'Administrativa',
    color: '#8b5cf6',
    classes: 'border-violet-100 bg-violet-50 text-violet-700',
    icon: '🏫',
  },
  ADMINISTRATIVE: {
    name: 'Administrativa',
    color: '#8b5cf6',
    classes: 'border-violet-100 bg-violet-50 text-violet-700',
    icon: '🏫',
  },
  INFO: {
    name: 'Información',
    color: '#10b981',
    classes: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    icon: 'ℹ️',
  },
};

// fallback para categorías desconocidas o undefined
const DEFAULT_TAG = {
  name: 'Mensaje',
  color: '#64748b',
  classes: 'border-neutral-100 bg-neutral-50 text-neutral-700',
  icon: '💬',
};

function normalizeCategory(raw?: string | null) {
  if (!raw) return DEFAULT_TAG;

  const key = String(raw).toUpperCase();

  return CAT_MAP[key] ?? DEFAULT_TAG;
}

function ReplyItem({ r }: { r: NonNullable<Communication['replies']>[number] }) {
  const who =
    !r.user || typeof r.user === 'string'
      ? ''
      : r.user?.name || '';

  const when = r.createdAt ? new Date(r.createdAt) : null;

  return (
    <div className="rounded-3xl border border-neutral-200 bg-neutral-50 px-4 py-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs font-black uppercase tracking-wide text-neutral-500">
          {who ? who : 'Usuario'} · {r.role}
        </div>

        <div className="text-xs font-semibold text-neutral-400">
          {when ? when.toLocaleString() : ''}
        </div>
      </div>

      <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">
        {r.body}
      </div>
    </div>
  );
}

function Item({
  c,
  onRead,
  onReply,
}: {
  c: Communication;
  onRead: (id: string) => void;
  onReply: (id: string, body: string) => Promise<void>;
}) {
  const created = c.createdAt ? new Date(c.createdAt) : null;
  const tag = normalizeCategory((c as any).category);

  const read = !!c.readAt;

  const courseName =
    !c.course || typeof c.course === 'string'
      ? ''
      : `${c.course?.name || 'Curso'}${c.course?.year ? ` (${c.course.year})` : ''}`;

  const senderName =
    !c.sender || typeof c.sender === 'string'
      ? ''
      : c.sender?.name || '';

  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  // título solo = categoría; cuerpo = body || title (compat)
  const displayTitle = tag.name;
  const bodyText = (c.body && c.body.trim().length ? c.body : (c.title || '')).trim();

  return (
    <article className={`overflow-hidden rounded-[2rem] border bg-white shadow-xl shadow-neutral-100 transition hover:-translate-y-0.5 hover:shadow-2xl ${read ? 'border-neutral-200' : 'border-violet-200'}`}>
      <div className="relative overflow-hidden bg-gradient-to-r from-violet-600 via-fuchsia-500 to-sky-500 px-5 py-5 text-white sm:px-6">
        <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/20 blur-2xl" />
        <div className="absolute -bottom-12 -left-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-2xl shadow-sm backdrop-blur-sm">
              {tag.icon}
            </div>

            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/20 bg-white/15 px-3 py-1 text-xs font-black uppercase tracking-wide text-white shadow-sm backdrop-blur-sm">
                  {tag.name}
                </span>

                {!read && (
                  <span className="rounded-full border border-white/20 bg-white px-3 py-1 text-xs font-black uppercase tracking-wide text-violet-700 shadow-sm">
                    Nuevo
                  </span>
                )}
              </div>

              <h2 className="break-words text-xl font-black leading-tight sm:text-2xl">
                {displayTitle || '(Sin asunto)'}
              </h2>

              <p className="mt-1 text-sm font-semibold text-white/80">
                {created
                  ? `${created.toLocaleDateString()} ${created.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}`
                  : 'Sin fecha'}
              </p>
            </div>
          </div>

          {!read && (
            <button
              onClick={() => onRead(c._id)}
              aria-label="Marcar leído"
              className="w-full rounded-2xl border border-white/30 bg-white/15 px-4 py-2 text-sm font-black uppercase tracking-wide text-white shadow-sm backdrop-blur transition hover:bg-white/25 sm:w-auto"
            >
              Marcar leído
            </button>
          )}
        </div>
      </div>

      <div className="space-y-5 p-4 sm:p-5">
        {bodyText && (
          <div className="rounded-3xl border border-neutral-200 bg-neutral-50 px-5 py-4">
            <div className="mb-2 text-xs font-black uppercase tracking-wide text-neutral-500">
              Mensaje
            </div>

            <div className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-800 sm:text-base">
              {bodyText}
            </div>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-3xl border border-neutral-200 bg-white px-4 py-3">
            <p className="text-xs font-black uppercase tracking-wide text-neutral-400">
              Curso
            </p>
            <p className="mt-1 break-words text-sm font-bold text-neutral-700">
              {courseName || 'Curso no informado'}
            </p>
          </div>

          <div className="rounded-3xl border border-neutral-200 bg-white px-4 py-3">
            <p className="text-xs font-black uppercase tracking-wide text-neutral-400">
              Enviado por
            </p>
            <p className="mt-1 break-words text-sm font-bold text-neutral-700">
              {senderName || 'Remitente no informado'}
            </p>
          </div>
        </div>

        {/* Hilo de respuestas */}
        {!!(c.replies && c.replies.length) && (
          <div className="rounded-[1.75rem] border border-neutral-200 bg-white p-4">
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-sm font-black uppercase tracking-wide text-neutral-700">
                Respuestas
              </h3>

              <span className="w-fit rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-black text-neutral-500">
                {c.replies.length}
              </span>
            </div>

            <div className="grid gap-3">
              {c.replies!.map((r) => (
                <ReplyItem key={r._id} r={r} />
              ))}
            </div>
          </div>
        )}

        {/* Cuadro para responder */}
        <div className="rounded-[1.75rem] border border-neutral-200 bg-neutral-50 p-4">
          <label className="grid gap-2">
            <span className="text-sm font-black text-neutral-700">
              Responder comunicación
            </span>

            <textarea
              placeholder="Escribí tu respuesta (opcional)…"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              className="min-h-[110px] w-full resize-none rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-700 outline-none transition placeholder:text-neutral-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
            />
          </label>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-neutral-500">
              La respuesta quedará agregada al hilo de la comunicación.
            </p>

            <button
              disabled={!reply.trim() || sending}
              onClick={async () => {
                setSending(true);

                try {
                  await onReply(c._id, reply.trim());
                  setReply('');
                } finally {
                  setSending(false);
                }
              }}
              className="w-full rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-500 to-sky-500 px-5 py-3 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-violet-200 transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {sending ? 'Enviando…' : 'Responder'}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function StudentCommunications() {
  const [rows, setRows] = useState<Communication[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    try {
      const r = await api.communications.mine();

      // orden defensivo por fecha
      const ordered = r.rows.slice().sort((a, b) =>
        String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
      );

      setRows(ordered);
      setErr(null);
    } catch (e: any) {
      setErr(e.message || 'Error al cargar comunicaciones');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const unread = useMemo(() => rows.filter((r) => !r.readAt).length, [rows]);

  async function markRead(id: string) {
    try {
      await api.communications.markRead(id);
    } finally {
      await load();
    }
  }

  async function sendReply(id: string, body: string) {
    await api.communications.reply(id, body);
    await load();
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6 px-3 py-4 sm:px-5 md:px-6 md:py-6">
        <section className="overflow-hidden rounded-[2rem] border border-neutral-200 bg-white p-5 shadow-xl shadow-neutral-100 sm:p-7">
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 animate-pulse rounded-2xl bg-neutral-100" />

              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-6 w-56 animate-pulse rounded-full bg-neutral-100" />
                <div className="h-4 w-80 max-w-full animate-pulse rounded-full bg-neutral-100" />
              </div>
            </div>

            <div className="h-64 animate-pulse rounded-[2rem] bg-neutral-100" />
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-3 py-4 sm:px-5 md:px-6 md:py-6">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-r from-violet-600 via-fuchsia-500 to-sky-500 p-[2px] shadow-xl shadow-violet-100">
        <div className="relative overflow-hidden rounded-[2rem] bg-white p-5 sm:p-7 md:p-8">
          <div className="absolute -right-14 -top-14 h-44 w-44 rounded-full bg-violet-200/60 blur-3xl" />
          <div className="absolute -bottom-16 -left-14 h-44 w-44 rounded-full bg-sky-200/60 blur-3xl" />

          <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="mb-3 w-fit rounded-full border border-violet-100 bg-violet-50 px-4 py-1.5 text-xs font-black uppercase tracking-wide text-violet-700">
                💬 Libro de comunicaciones
              </div>

              <h1 className="text-2xl font-black tracking-tight text-neutral-950 sm:text-3xl md:text-4xl">
                Comunicaciones
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-neutral-600 sm:text-base">
                Consultá los mensajes enviados por docentes, coordinación o administración y respondé desde el mismo hilo.
              </p>
            </div>

            <div className="grid w-full gap-3 sm:grid-cols-2 md:w-auto md:min-w-[360px]">
              <div className="rounded-3xl border border-violet-100 bg-violet-50/80 px-5 py-4 shadow-sm">
                <p className="text-xs font-black uppercase tracking-wide text-violet-500">
                  Total
                </p>
                <p className="mt-1 text-sm font-black text-violet-800">
                  {rows.length}
                </p>
              </div>

              <div className="rounded-3xl border border-rose-100 bg-rose-50/80 px-5 py-4 shadow-sm">
                <p className="text-xs font-black uppercase tracking-wide text-rose-500">
                  Sin leer
                </p>
                <p className="mt-1 text-sm font-black text-rose-800">
                  {unread}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {err && (
        <section className="rounded-[2rem] border border-rose-200 bg-rose-50 p-6 text-rose-700 shadow-sm">
          <h2 className="text-xl font-black">
            No se pudieron cargar las comunicaciones
          </h2>
          <p className="mt-1 text-sm font-bold">
            {err}
          </p>
        </section>
      )}

      {rows.length === 0 ? (
        <section className="rounded-[2rem] border border-dashed border-neutral-200 bg-neutral-50 p-8 text-center">
          <div className="mb-3 text-5xl">
            📭
          </div>

          <h3 className="text-lg font-black text-neutral-800">
            Aún no hay mensajes
          </h3>

          <p className="mt-1 text-sm text-neutral-500">
            Cuando recibas comunicaciones, aparecerán en esta sección.
          </p>
        </section>
      ) : (
        <section className="grid gap-5">
          {rows.map((r) => (
            <Item key={r._id} c={r} onRead={markRead} onReply={sendReply} />
          ))}
        </section>
      )}
    </div>
  );
}
