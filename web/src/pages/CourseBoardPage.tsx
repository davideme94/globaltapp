import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, type Me } from '../lib/api';

/*
  Tablón / Muro del curso — Posteo de docentes/coordinador con links (preview) y texto.
  - Liviano: solo guarda texto + URLs.
  - Diseño a tono con la app (cards, badges, gradientes, botones redondeados).

  Endpoints esperados (server):
    GET  /api/courses/:id/board?before=&limit=30  -> { rows: Post[] }
    POST /api/courses/:id/board { title, body, links:[{url, meta?}] } -> { ok, post }
    DELETE /api/board/:postId  (opcional: coord/admin o autor)
    POST /api/unfurl { url } -> { title?, description?, image?, provider? }   (opcional)

  Si aún no los tenés, este front cae de pie si /unfurl no existe: muestra la URL pelada,
  si es YouTube embebe bonito, y ahora si es una imagen directa la previsualiza.
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
async function del(path: string) {
  const r = await fetch(`${BASE}${path}`, { method: 'DELETE', credentials: 'include' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
}

/* ================== Tipos ================== */
export type LinkMeta = { title?: string; description?: string; image?: string; provider?: string; type?: string };
export type PostLink = { url: string; meta?: LinkMeta };
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
  } catch { return u; }
};

// Evita "2025 — 2025" si el nombre ya trae el año
function buildCourseTitle(name?: string, year?: number) {
  if (!name) return 'Curso';
  if (!year) return name;
  const yearStr = String(year);
  const clean = name.replace(/\s+/g, ' ').trim();
  return clean.includes(yearStr) ? clean : `${clean} — ${yearStr}`;
}

/* ============== UI: LinkPreview ============== */
function LinkPreview({ url, meta }: { url: string; meta?: LinkMeta }) {
  // 1) YouTube con thumbnail
  const id = ytId(url);
  if (id) {
    const thumb = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
    return (
      <a href={`https://www.youtube.com/watch?v=${id}`} target="_blank" rel="noreferrer"
         className="block rounded-2xl overflow-hidden border bg-white hover:shadow transition max-w-xl">
        <div className="relative aspect-video">
          <img src={thumb} alt="YouTube thumbnail" className="w-full h-full object-cover" loading="lazy"/>
          <div className="absolute inset-0 grid place-items-center">
            <div className="rounded-full bg-black/60 text-white px-4 py-1 text-sm font-medium">▶ Play</div>
          </div>
        </div>
        <div className="p-3 text-sm">
          <div className="font-medium">{meta?.title || 'YouTube'}</div>
          {meta?.description && <div className="text-neutral-600 line-clamp-2">{meta.description}</div>}
        </div>
      </a>
    );
  }

  // 2) Imagen directa (jpg/png/webp/gif/svg/etc.)
  if (isDirectImage(url)) {
    return (
      <a href={url} target="_blank" rel="noreferrer"
         className="block rounded-2xl overflow-hidden border bg-white hover:shadow transition max-w-xl">
        <img src={url} alt={meta?.title || niceHostOrFile(url)} className="w-full max-h-72 object-contain bg-neutral-50" loading="lazy" />
        <div className="p-3 text-sm">
          <div className="font-medium truncate">{meta?.title || niceHostOrFile(url)}</div>
          {meta?.description && <div className="text-neutral-600 line-clamp-2">{meta.description}</div>}
        </div>
      </a>
    );
  }

  // 3) Enlace normal (usa OG image si vino del backend /unfurl)
  return (
    <a href={url} target="_blank" rel="noreferrer"
       className="block rounded-2xl overflow-hidden border bg-white hover:shadow transition max-w-xl">
      {meta?.image && (
        <img src={meta.image} alt="Preview" className="w-full max-h-56 object-cover" loading="lazy"/>
      )}
      <div className="p-3 text-sm">
        <div className="font-medium">{meta?.title || url}</div>
        {meta?.description && <div className="text-neutral-600 line-clamp-2">{meta.description}</div>}
        {meta?.provider && <div className="text-xs text-neutral-500 mt-1">{meta.provider}</div>}
      </div>
    </a>
  );
}

/* ============ Componente: Composer (crear post) ============ */
function Composer({ onCreated, canPost }:{ onCreated:(p:BoardPost)=>void; canPost:boolean }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [urls, setUrls] = useState<string>('');
  const [busy, setBusy] = useState(false);

  const parseLinks = () =>
    urls.split(/\n|\s+/).map(s => s.trim()).filter(Boolean).slice(0, 10).map(url => ({ url } as PostLink));

  return (
    <div className="card p-4 space-y-2">
      <div className="text-sm font-medium">Nuevo comunicado</div>
      <input className="input" placeholder="Título (opcional)" value={title} onChange={e=>setTitle(e.target.value)} />
      <textarea className="input min-h-[90px]" placeholder="Escribí el texto del comunicado…" value={body} onChange={e=>setBody(e.target.value)} />
      <textarea className="input min-h-[70px]" placeholder="Pegá links (YouTube, artículos, Drive, imágenes…) — uno por línea" value={urls} onChange={e=>setUrls(e.target.value)} />
      <div className="flex gap-2 justify-end pt-1">
        <button className="btn btn-secondary" onClick={()=>{setTitle('');setBody('');setUrls('');}} disabled={busy}>Limpiar</button>
        <button className="btn btn-primary" disabled={busy || !canPost || (!body.trim() && !title.trim() && !urls.trim())}
          onClick={async()=>{
            setBusy(true);
            try {
              const links = parseLinks();
              const res = await postJSON<{ ok:boolean; post:BoardPost }>(`/courses/${encodeURIComponent((window as any).__courseId || '')}/board`, {
                title: title.trim() || undefined,
                body: body.trim() || undefined,
                links,
              });
              onCreated(res.post);
              setTitle(''); setBody(''); setUrls('');
            } catch (e:any) { alert(e?.message || 'No se pudo publicar'); }
            finally { setBusy(false); }
          }}>
          {busy ? 'Publicando…' : 'Publicar'}
        </button>
      </div>
    </div>
  );
}

/* ============ Componente: PostItem ============ */
function PostItem({ p, canManage, onDelete }:{ p:BoardPost; canManage:boolean; onDelete:(id:string)=>void }) {
  const who = useMemo(()=>{
    if (!p.author) return { name:'', role:'' };
    if (typeof p.author === 'string') return { name:'', role:'' };
    return { name: p.author?.name || '', role: p.author?.role || '' };
  }, [p.author]);
  const when = p.createdAt ? new Date(p.createdAt) : null;

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate max-w-[60ch]">{p.title || 'Comunicado'}</span>
            {who.role && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-pink-50 text-pink-700 border border-pink-200">{who.role}</span>
            )}
          </div>
          <div className="text-xs text-neutral-500">
            {who.name || '—'} {when ? `• ${when.toLocaleString()}` : ''}
          </div>
        </div>
        {canManage && (
          <button className="text-danger text-sm" onClick={()=>onDelete(p._id)}>Eliminar</button>
        )}
      </div>

      {p.body && <div className="whitespace-pre-wrap text-[15px]">{p.body}</div>}

      {!!(p.links && p.links.length) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {p.links!.map((l, i)=>(
            <LinkPreview key={i} url={l.url} meta={l.meta}/>
          ))}
        </div>
      )}
    </div>
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
  const canPost = me?.role === 'teacher' || me?.role === 'coordinator' || me?.role === 'admin';
  const canManage = (me?.role === 'coordinator' || me?.role === 'admin');

  // guardo para Composer
  useEffect(()=>{ (window as any).__courseId = id || ''; }, [id]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const m = await api.me(); if (!alive) return; setMe(m.user);

        if (id) {
          // 1) Intento original: obtener nombre desde /links
          try {
            const info = await getJSON<{ course:{ _id:string; name:string; year:number } }>(`/courses/${encodeURIComponent(id)}/links`);
            if (alive && info?.course) setCourseTitle(buildCourseTitle(info.course.name, info.course.year));
          } catch {}

          // 1.b) Fallback para alumnos
          if (alive && (courseTitle === 'Curso' || !courseTitle)) {
            try {
              const mine = await api.courses.mine();
              const match = (mine?.rows || []).find((r:any) =>
                String(r?.course?._id || r?._id) === String(id)
              );
              if (match) {
                const c = (match as any).course || match;
                setCourseTitle(buildCourseTitle(c.name, c.year));
              }
            } catch {}
          }

          // 1.c) Fallback coord/teacher/admin: listar por año y buscar
          if (alive && (courseTitle === 'Curso' || !courseTitle) && (m.user.role === 'coordinator' || m.user.role === 'admin' || m.user.role === 'teacher')) {
            try {
              const year = new Date().getFullYear();
              const all = await api.courses.list({ year });
              const c = (all.courses || []).find((x:any) => String(x._id) === String(id));
              if (c) setCourseTitle(buildCourseTitle(c.name, c.year));
            } catch {}
          }

          // 2) Cargar posts
          const r = await getJSON<{ rows: BoardPost[] }>(`/courses/${encodeURIComponent(id)}/board?limit=30`);
          if (!alive) return; setRows(r.rows || []);
        }
      } catch (e) {
        if (alive) setRows([]);
      } finally { if (alive) setLoading(false); }
    })();
    return ()=>{ alive = false; };
  }, [id]);

  const loadMore = async () => {
    if (!rows.length || !id) return;
    setMoreBusy(true);
    try {
      const last = rows[rows.length - 1]?.createdAt;
      const r = await getJSON<{ rows: BoardPost[] }>(`/courses/${encodeURIComponent(id)}/board?before=${encodeURIComponent(last || '')}&limit=30`);
      setRows(prev => [...prev, ...(r.rows || [])]);
    } catch {}
    finally { setMoreBusy(false); }
  };

  return (
    <div className="space-y-4">
      {/* Hero/título */}
      <div className="rounded-2xl p-4 text-white" style={{ background: 'var(--grad-primary)' }}>
        <div className="font-heading text-lg">Muro del curso</div>
        <div className="opacity-90">{courseTitle}</div>
      </div>

      {/* Composer (solo docentes / coord / admin) */}
      {canPost && <Composer canPost={canPost} onCreated={(p)=> setRows(prev => [p, ...prev])} />}

      {/* Feed */}
      {loading ? (
        <div className="card p-4 space-y-2">
          <div className="h-5 w-40 skeleton"/>
          <div className="h-20 skeleton"/>
        </div>
      ) : rows.length === 0 ? (
        <div className="card p-6 text-neutral-700">Aún no hay publicaciones.</div>
      ) : (
        <div className="grid gap-3">
          {rows.map(p => (
            <PostItem key={p._id} p={p} canManage={canManage} onDelete={async(idDel)=>{
              if (!confirm('¿Eliminar publicación?')) return;
              try { await del(`/board/${encodeURIComponent(idDel)}`); setRows(prev => prev.filter(x=>x._id!==idDel)); }
              catch(e:any){ alert(e?.message || 'No se pudo eliminar'); }
            }}/>
          ))}
          <div className="flex justify-center pt-2">
            <button className="btn btn-secondary" onClick={loadMore} disabled={moreBusy}>{moreBusy ? 'Cargando…' : 'Cargar más'}</button>
          </div>
        </div>
      )}
    </div>
  );
}
