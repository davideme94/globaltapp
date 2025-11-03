// web/src/lib/media.ts
function toSeconds(t: string) {
  // soporta t=90 / t=1m30s / t=1h2m3s
  if (/^\d+$/.test(t)) return Number(t);
  const m = t.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/i);
  if (!m) return 0;
  const h = Number(m[1] || 0);
  const mnt = Number(m[2] || 0);
  const s = Number(m[3] || 0);
  return h * 3600 + mnt * 60 + s;
}

export function toYouTubeEmbed(u?: string | null) {
  if (!u) return u || undefined;
  try {
    const url = new URL(u);

    // Tomamos el ID base y params utiles
    let id = '';
    let list = url.searchParams.get('list') || undefined;
    let start = url.searchParams.get('start') || undefined;
    const t = url.searchParams.get('t');
    if (!start && t) start = String(toSeconds(t));

    if (url.hostname === 'youtu.be') {
      id = url.pathname.slice(1);
    } else if (url.hostname.includes('youtube.com')) {
      const v = url.searchParams.get('v');
      if (v) id = v;
      else {
        const parts = url.pathname.split('/').filter(Boolean);
        // /shorts/ID o /live/ID
        if (parts[0] && parts[1] && (parts[0] === 'shorts' || parts[0] === 'live')) {
          id = parts[1];
        }
        // /embed/ID
        if (!id && parts[0] === 'embed' && parts[1]) id = parts[1];
      }
    }
    if (!id) return u;

    const qp = new URLSearchParams();
    qp.set('rel', '0');
    qp.set('modestbranding', '1');
    qp.set('playsinline', '1'); // iOS dentro de la página
    qp.set('enablejsapi', '1');
    if (start) qp.set('start', start);
    if (list) qp.set('list', list);

    return `https://www.youtube-nocookie.com/embed/${id}?${qp.toString()}`;
  } catch {}
  return u || undefined;
}

export function toDrivePreview(u?: string | null) {
  if (!u) return u || undefined;
  try {
    const url = new URL(u);
    if (!url.hostname.includes('drive.google.com')) return u;
    // /file/d/ID/...
    if (url.pathname.startsWith('/file/d/')) {
      const id = url.pathname.split('/')[3];
      return id ? `https://drive.google.com/file/d/${id}/preview` : u;
    }
    // id=...
    const id = url.searchParams.get('id');
    if (id) return `https://drive.google.com/file/d/${id}/preview`;
  } catch {}
  return u || undefined;
}

export function normalizeEmbedUrl(u?: string | null) {
  if (!u) return undefined;
  // primero YouTube, si no matchea cae a Drive
  const yt = toYouTubeEmbed(u);
  if (yt && yt.includes('youtube-nocookie.com/embed')) return yt;
  return toDrivePreview(u);
}

export function isAudio(u?: string | null) {
  if (!u) return false;
  return /\.(mp3|m4a|wav|ogg)(\?|$)/i.test(u);
}

