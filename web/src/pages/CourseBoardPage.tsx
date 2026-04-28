import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, type Me } from '../lib/api';

/*
  Tablón / Muro del curso — Posteo de docentes/coordinador con links (preview) y texto.
  - Liviano: solo guarda texto + URLs.
  - Diseño a tono con la app (cards, badges, gradientes, botones redondeados).
*/

/* ================= Helpers de red ================ */
const ORIGIN = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const BASE = ORIGIN ? `${ORIGIN}/api` : '/api';

async function getJSON<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}${path}`, { credentials: 'include' });
  const ct = r.headers.get('content-type') || '';
  const payload = ct.includes('application/json') ? await r.json() : await r.text();
  if (!r.ok) throw new Error((payload as any)?.error || `HTTP ${r.status}`);
  return payload as T;
}

async function postJSON<T>(path: string, body: any): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const ct = r.headers.get('content-type') || '';
  const payload = ct.includes('application/json') ? await r.json() : await r.text();
  if (!r.ok) throw new Error((payload as any)?.error || `HTTP ${r.status}`);
  return payload as T;
}

async function patchJSON<T>(path: string, body: any): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const ct = r.headers.get('content-type') || '';
  const payload = ct.includes('application/json') ? await r.json() : await r.text();
  if (!r.ok) throw new Error((payload as any)?.error || `HTTP ${r.status}`);
  return payload as T;
}

async function del(path: string) {
  const r = await fetch(`${BASE}${path}`, { method: 'DELETE', credentials: 'include' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
}

/* ================== Tipos ================== */
export type LinkMeta = {
  title?: string;
  description?: string;
  image?: string;
  provider?: string;
  type?: string;
};

export type PostLink = {
  url: string;
  meta?: LinkMeta;
};

export type BoardPost = {
  _id: string;
  course: string;
  author?: { _id: string; name?: string; photoUrl?: string; role?: string } | string | null;
  title?: string;
  body?: string;
  links?: PostLink[];
  createdAt?: string;
};

/* ================ Utils ================ */
const ytId = (u: string) => {
  try {
    const url = new URL(u);
    if (url.hostname.includes('youtu.be')) return url.pathname.slice(1);
    if (url.hostname.includes('youtube.com')) return url.searchParams.get('v') || '';
  } catch {}
  return '';
};

const IMG_EXT = /\.(png|jpe?g|gif|webp|avif|bmp|svg)(\?.*)?$/i;

const isDirectImage = (u: string) => {
  try {
    const url = new URL(u);
    return IMG_EXT.test(url.pathname);
  } catch {
    return IMG_EXT.test(u);
  }
};

const niceHostOrFile = (u: string) => {
  try {
    const url = new URL(u);
    const basename = decodeURIComponent(url.pathname.split('/').pop() || '');
    return basename || url.hostname;
  } catch {
    return u;
  }
};

function buildCourseTitle(name?: string, year?: number) {
  if (!name) return 'Curso';
  if (!year) return name;

  const yearStr = String(year);
  const clean = name.replace(/\s+/g, ' ').trim();

  return clean.includes(yearStr) ? clean : `${clean} — ${yearStr}`;
}

function renderMarkdownText(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={index} className="font-black">
          {part.slice(2, -2)}
        </strong>
      );
    }

    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

function linksToText(links?: PostLink[]) {
  return (links || []).map((l) => l.url).join('\n');
}

function parseLinksFromText(value: string) {
  return value
    .split(/\n|\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 10)
    .map((url) => ({ url } as PostLink));
}

/* ============== UI: LinkPreview ============== */
function LinkPreview({ url, meta }: { url: string; meta?: LinkMeta }) {
  const id = ytId(url);

  if (id) {
    const thumb = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

    return (
      <a
        href={`https://www.youtube.com/watch?v=${id}`}
        target="_blank"
        rel="noreferrer"
        className="group block w-full max-w-full overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg sm:max-w-xl"
      >
        <div className="relative aspect-video overflow-hidden bg-neutral-100">
          <img
            src={thumb}
            alt="YouTube thumbnail"
            className="h-full w-full max-w-full object-cover transition duration-300 group-hover:scale-105"
            loading="lazy"
          />

          <div className="absolute inset-0 grid place-items-center bg-black/10">
            <div className="rounded-full bg-black/70 px-5 py-2 text-sm font-black text-white shadow-lg">
              ▶ Ver video
            </div>
          </div>
        </div>
      </a>
    );
  }

  if (isDirectImage(url)) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="group block w-full max-w-full overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg sm:max-w-xl"
      >
        <div className="bg-neutral-50">
          <img
            src={url}
            alt={meta?.title || 'Imagen'}
            className="max-h-72 w-full max-w-full object-contain transition duration-300 group-hover:scale-[1.02]"
            loading="lazy"
          />
        </div>
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="group block w-full max-w-full overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg sm:max-w-xl"
    >
      {meta?.image && (
        <img
          src={meta.image}
          alt="Preview"
          className="max-h-56 w-full max-w-full object-cover transition duration-300 group-hover:scale-[1.02]"
          loading="lazy"
        />
      )}

      <div className="p-4 text-sm">
        <div className="break-words font-black text-neutral-900">
          {meta?.title || url}
        </div>

        {meta?.description && (
          <div className="mt-1 line-clamp-2 text-neutral-600">
            {meta.description}
          </div>
        )}

        {meta?.provider && (
          <div className="mt-2 w-fit rounded-full bg-purple-50 px-3 py-1 text-xs font-bold text-purple-700">
            {meta.provider}
          </div>
        )}
      </div>
    </a>
  );
}

/* ============ Componente: Composer ============ */
function Composer({
  onCreated,
  canPost,
}: {
  onCreated: (p: BoardPost) => void;
  canPost: boolean;
}) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [urls, setUrls] = useState<string>('');
  const [busy, setBusy] = useState(false);

  const parseLinks = () => parseLinksFromText(urls);

  const previewLinks = useMemo(() => parseLinks(), [urls]);

  return (
    <section className="w-full max-w-full overflow-hidden rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-purple-100 text-2xl">
          📣
        </div>

        <div className="min-w-0">
          <h2 className="text-lg font-black text-neutral-900">
            Nuevo comunicado
          </h2>
          <p className="text-sm text-neutral-500">
            Publicá avisos, recursos, videos o enlaces para tus estudiantes.
          </p>
        </div>
      </div>

      <div className="grid min-w-0 gap-3">
        <input
          className="w-full max-w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-700 outline-none transition placeholder:text-neutral-400 focus:border-purple-400 focus:bg-white focus:ring-4 focus:ring-purple-100"
          placeholder="Título (opcional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <textarea
          className="min-h-[115px] w-full max-w-full resize-none rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-700 outline-none transition placeholder:text-neutral-400 focus:border-purple-400 focus:bg-white focus:ring-4 focus:ring-purple-100"
          placeholder="Escribí el texto del comunicado…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />

        <textarea
          className="min-h-[85px] w-full max-w-full resize-none rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-700 outline-none transition placeholder:text-neutral-400 focus:border-purple-400 focus:bg-white focus:ring-4 focus:ring-purple-100"
          placeholder="Pegá links: YouTube, artículos, Drive, imágenes… uno por línea"
          value={urls}
          onChange={(e) => setUrls(e.target.value)}
        />

        {previewLinks.length > 0 && (
          <div className="w-full max-w-full overflow-hidden rounded-3xl border border-purple-100 bg-purple-50/50 p-4">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white text-lg shadow-sm">
                👀
              </div>

              <div className="min-w-0">
                <h3 className="text-sm font-black text-neutral-900">
                  Vista previa
                </h3>
                <p className="text-xs text-neutral-500">
                  Así se verán los enlaces cuando publiques.
                </p>
              </div>
            </div>

            <div className="grid w-full max-w-full grid-cols-1 gap-4 sm:grid-cols-2">
              {previewLinks.map((l, i) => (
                <LinkPreview key={`${l.url}-${i}`} url={l.url} meta={l.meta} />
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
          <button
            className="w-full rounded-2xl border border-neutral-200 bg-white px-5 py-3 text-sm font-black uppercase tracking-wide text-neutral-700 shadow-sm transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            onClick={() => {
              setTitle('');
              setBody('');
              setUrls('');
            }}
            disabled={busy}
          >
            Limpiar
          </button>

          <button
            className="w-full rounded-2xl bg-gradient-to-r from-purple-600 to-pink-500 px-6 py-3 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-purple-200 transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 sm:w-auto"
            disabled={busy || !canPost || (!body.trim() && !title.trim() && !urls.trim())}
            onClick={async () => {
              setBusy(true);

              try {
                const links = parseLinks();

                const res = await postJSON<{ ok: boolean; post: BoardPost }>(
                  `/courses/${encodeURIComponent((window as any).__courseId || '')}/board`,
                  {
                    title: title.trim() || undefined,
                    body: body.trim() || undefined,
                    links,
                  }
                );

                onCreated(res.post);

                setTitle('');
                setBody('');
                setUrls('');
              } catch (e: any) {
                alert(e?.message || 'No se pudo publicar');
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? 'Publicando…' : 'Publicar'}
          </button>
        </div>
      </div>
    </section>
  );
}

/* ============ Componente: PostItem ============ */
function PostItem({
  p,
  canManage,
  onDelete,
  onUpdate,
}: {
  p: BoardPost;
  canManage: boolean;
  onDelete: (id: string) => void;
  onUpdate: (post: BoardPost) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(p.title || '');
  const [editBody, setEditBody] = useState(p.body || '');
  const [editUrls, setEditUrls] = useState(linksToText(p.links));
  const [savingEdit, setSavingEdit] = useState(false);

  const editPreviewLinks = useMemo(() => parseLinksFromText(editUrls), [editUrls]);

  const who = useMemo(() => {
    if (!p.author) return { name: '', role: '' };
    if (typeof p.author === 'string') return { name: '', role: '' };

    return {
      name: p.author?.name || '',
      role: p.author?.role || '',
    };
  }, [p.author]);

  const when = p.createdAt ? new Date(p.createdAt) : null;

  const cancelEdit = () => {
    setEditTitle(p.title || '');
    setEditBody(p.body || '');
    setEditUrls(linksToText(p.links));
    setEditing(false);
  };

  const saveEdit = async () => {
    setSavingEdit(true);

    try {
      const links = parseLinksFromText(editUrls);

      const res = await patchJSON<{ ok: boolean; post: BoardPost }>(
        `/board/${encodeURIComponent(p._id)}`,
        {
          title: editTitle.trim() || undefined,
          body: editBody.trim() || undefined,
          links,
        }
      );

      onUpdate(res.post);
      setEditing(false);
    } catch (e: any) {
      alert(e?.message || 'No se pudo editar la publicación');
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <article className="w-full max-w-full overflow-hidden rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-purple-200 hover:shadow-lg sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="min-w-0 max-w-full break-words text-lg font-black leading-snug text-neutral-900">
              {p.title ? renderMarkdownText(p.title) : 'Comunicado'}
            </h3>

            {who.role && (
              <span className="rounded-full border border-pink-200 bg-pink-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-pink-700">
                {who.role}
              </span>
            )}
          </div>

          <div className="mt-1 break-words text-xs font-medium text-neutral-500">
            {who.name || 'Autor no disponible'}
            {when ? ` • ${when.toLocaleString()}` : ''}
          </div>
        </div>

        {canManage && !editing && (
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <button
              className="rounded-full border border-purple-100 bg-purple-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-purple-700 transition hover:bg-purple-100"
              onClick={() => setEditing(true)}
            >
              Editar
            </button>

            <button
              className="rounded-full border border-red-100 bg-red-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-red-600 transition hover:bg-red-100"
              onClick={() => onDelete(p._id)}
            >
              Eliminar
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <div className="grid min-w-0 gap-3">
          <input
            className="w-full max-w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-700 outline-none transition placeholder:text-neutral-400 focus:border-purple-400 focus:bg-white focus:ring-4 focus:ring-purple-100"
            placeholder="Título"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
          />

          <textarea
            className="min-h-[140px] w-full max-w-full resize-none rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-700 outline-none transition placeholder:text-neutral-400 focus:border-purple-400 focus:bg-white focus:ring-4 focus:ring-purple-100"
            placeholder="Texto del comunicado"
            value={editBody}
            onChange={(e) => setEditBody(e.target.value)}
          />

          <textarea
            className="min-h-[85px] w-full max-w-full resize-none rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-700 outline-none transition placeholder:text-neutral-400 focus:border-purple-400 focus:bg-white focus:ring-4 focus:ring-purple-100"
            placeholder="Links, uno por línea"
            value={editUrls}
            onChange={(e) => setEditUrls(e.target.value)}
          />

          {editPreviewLinks.length > 0 && (
            <div className="w-full max-w-full overflow-hidden rounded-3xl border border-purple-100 bg-purple-50/50 p-4">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white text-lg shadow-sm">
                  👀
                </div>

                <div className="min-w-0">
                  <h3 className="text-sm font-black text-neutral-900">
                    Vista previa
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Así se verán los enlaces al guardar.
                  </p>
                </div>
              </div>

              <div className="grid w-full max-w-full grid-cols-1 gap-4 sm:grid-cols-2">
                {editPreviewLinks.map((l, i) => (
                  <LinkPreview key={`${l.url}-${i}`} url={l.url} meta={l.meta} />
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              className="w-full rounded-2xl border border-neutral-200 bg-white px-5 py-3 text-sm font-black uppercase tracking-wide text-neutral-700 shadow-sm transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              onClick={cancelEdit}
              disabled={savingEdit}
            >
              Cancelar
            </button>

            <button
              className="w-full rounded-2xl bg-gradient-to-r from-purple-600 to-pink-500 px-6 py-3 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-purple-200 transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 sm:w-auto"
              onClick={saveEdit}
              disabled={savingEdit || (!editTitle.trim() && !editBody.trim() && !editUrls.trim())}
            >
              {savingEdit ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      ) : (
        <>
          {p.body && (
            <div className="max-w-full overflow-hidden break-words whitespace-pre-wrap rounded-2xl bg-neutral-50 p-4 text-[15px] leading-relaxed text-neutral-700">
              {renderMarkdownText(p.body)}
            </div>
          )}

          {!!(p.links && p.links.length) && (
            <div className="mt-4 grid w-full max-w-full grid-cols-1 gap-4 sm:grid-cols-2">
              {p.links!.map((l, i) => (
                <LinkPreview key={i} url={l.url} meta={l.meta} />
              ))}
            </div>
          )}
        </>
      )}
    </article>
  );
}

/* ============== Página principal ============== */
export default function CourseBoardPage() {
  const { id } = useParams<{ id: string }>();

  const [me, setMe] = useState<Me['user'] | null>(null);
  const [courseTitle, setCourseTitle] = useState('Curso');
  const [rows, setRows] = useState<BoardPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [moreBusy, setMoreBusy] = useState(false);

  const canPost =
    me?.role === 'teacher' || me?.role === 'coordinator' || me?.role === 'admin';

  const canManage = me?.role === 'teacher' || me?.role === 'coordinator';

  useEffect(() => {
    (window as any).__courseId = id || '';
  }, [id]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);

        const m = await api.me();
        if (!alive) return;
        setMe(m.user);

        if (id) {
          try {
            const info = await getJSON<{
              course: { _id: string; name: string; year: number };
            }>(`/courses/${encodeURIComponent(id)}/links`);

            if (alive && info?.course) {
              setCourseTitle(buildCourseTitle(info.course.name, info.course.year));
            }
          } catch {}

          if (alive && (courseTitle === 'Curso' || !courseTitle)) {
            try {
              const mine = await api.courses.mine();

              const match = (mine?.rows || []).find(
                (r: any) => String(r?.course?._id || r?._id) === String(id)
              );

              if (match) {
                const c = (match as any).course || match;
                setCourseTitle(buildCourseTitle(c.name, c.year));
              }
            } catch {}
          }

          if (
            alive &&
            (courseTitle === 'Curso' || !courseTitle) &&
            (m.user.role === 'coordinator' ||
              m.user.role === 'admin' ||
              m.user.role === 'teacher')
          ) {
            try {
              const year = new Date().getFullYear();
              const all = await api.courses.list({ year });
              const c = (all.courses || []).find((x: any) => String(x._id) === String(id));

              if (c) setCourseTitle(buildCourseTitle(c.name, c.year));
            } catch {}
          }

          const r = await getJSON<{ rows: BoardPost[] }>(
            `/courses/${encodeURIComponent(id)}/board?limit=30`
          );

          if (!alive) return;
          setRows(r.rows || []);
        }
      } catch (e) {
        if (alive) setRows([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [id]);

  const loadMore = async () => {
    if (!rows.length || !id) return;

    setMoreBusy(true);

    try {
      const last = rows[rows.length - 1]?.createdAt;

      const r = await getJSON<{ rows: BoardPost[] }>(
        `/courses/${encodeURIComponent(id)}/board?before=${encodeURIComponent(
          last || ''
        )}&limit=30`
      );

      setRows((prev) => [...prev, ...(r.rows || [])]);
    } catch {
    } finally {
      setMoreBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 overflow-hidden px-3 py-4 sm:px-4 md:space-y-6 md:px-6 md:py-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-600 via-fuchsia-500 to-pink-500 p-[2px] shadow-xl">
        <div className="relative rounded-3xl bg-white/95 p-5 sm:p-6 md:p-8">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-purple-200/60 blur-3xl" />
          <div className="absolute -bottom-12 -left-10 h-40 w-40 rounded-full bg-pink-200/60 blur-3xl" />

          <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="mb-3 w-fit rounded-full border border-purple-100 bg-purple-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-purple-700">
                💬 Espacio de comunicación
              </div>

              <h1 className="text-2xl font-black tracking-tight text-neutral-900 sm:text-3xl md:text-4xl">
                Muro del curso
              </h1>

              <p className="mt-2 break-words text-base font-semibold text-neutral-600">
                {courseTitle}
              </p>
            </div>

            <div className="w-fit rounded-2xl border border-purple-100 bg-purple-50 px-4 py-3 text-sm shadow-sm">
              <p className="font-black text-purple-800">
                Comunicados y recursos
              </p>
              <p className="text-xs text-purple-500">
                Publicaciones del curso
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Composer */}
      {canPost && (
        <Composer
          canPost={canPost}
          onCreated={(p) => setRows((prev) => [p, ...prev])}
        />
      )}

      {/* Feed */}
      {loading ? (
        <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="mb-4 h-5 w-44 animate-pulse rounded-full bg-neutral-200" />
          <div className="h-24 animate-pulse rounded-2xl bg-neutral-100" />
        </section>
      ) : rows.length === 0 ? (
        <section className="rounded-3xl border border-dashed border-neutral-200 bg-neutral-50 p-10 text-center shadow-sm">
          <div className="mb-3 text-5xl">📭</div>

          <h3 className="text-lg font-black text-neutral-800">
            Aún no hay publicaciones
          </h3>

          <p className="mt-1 text-sm text-neutral-500">
            Cuando publiques un comunicado, aparecerá en este muro.
          </p>
        </section>
      ) : (
        <section className="grid min-w-0 gap-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-black text-neutral-900">
                Publicaciones
              </h2>
              <p className="text-sm text-neutral-500">
                Historial de comunicados del curso.
              </p>
            </div>

            <span className="shrink-0 rounded-full border border-purple-100 bg-purple-50 px-4 py-2 text-xs font-black uppercase tracking-wide text-purple-700">
              {rows.length} publicación{rows.length === 1 ? '' : 'es'}
            </span>
          </div>

          {rows.map((p) => (
            <PostItem
              key={p._id}
              p={p}
              canManage={canManage}
              onUpdate={(updatedPost) => {
                setRows((prev) =>
                  prev.map((item) => (item._id === updatedPost._id ? updatedPost : item))
                );
              }}
              onDelete={async (idDel) => {
                if (!confirm('¿Eliminar publicación?')) return;

                try {
                  await del(`/board/${encodeURIComponent(idDel)}`);
                  setRows((prev) => prev.filter((x) => x._id !== idDel));
                } catch (e: any) {
                  alert(e?.message || 'No se pudo eliminar');
                }
              }}
            />
          ))}

          <div className="flex justify-center pt-2">
            <button
              className="rounded-2xl border border-neutral-200 bg-white px-6 py-3 text-sm font-black uppercase tracking-wide text-neutral-700 shadow-sm transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={loadMore}
              disabled={moreBusy}
            >
              {moreBusy ? 'Cargando…' : 'Cargar más'}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
