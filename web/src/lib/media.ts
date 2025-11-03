// web/src/lib/media.ts

/** Devuelve segundos desde una string tipo '1h2m3s' o '95' */
function parseStart(val?: string | null): number | null {
  if (!val) return null;
  // formatos: "75", "1m15s", "1h2m3s"
  const m = String(val).match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i);
  if (m && (m[1] || m[2] || m[3])) {
    const h = parseInt(m[1] || '0', 10);
    const mm = parseInt(m[2] || '0', 10);
    const s = parseInt(m[3] || '0', 10);
    return h * 3600 + mm * 60 + s;
  }
  const n = parseInt(String(val), 10);
  return Number.isFinite(n) ? n : null;
}

export function toYouTubeEmbed(u?: string | null) {
  if (!u) return u || undefined;
  try {
    const url = new URL(u);

    // Params útiles
    const t = parseStart(url.searchParams.get('t') || url.searchParams.get('start'));
    const list = url.searchParams.get('list');
    const commonQS = new URLSearchParams();
    if (t && t > 0) commonQS.set('start', String(t));
    commonQS.set('rel', '0');

    // youtu.be/<id>
    if (url.hostname === 'youtu.be') {
      const id = url.pathname.slice(1);
      return id
        ? `https://www.youtube-nocookie.com/embed/${id}${commonQS.toString() ? `?${commonQS}` : ''}`
        : u;
    }

    if (url.hostname.includes('youtube.com')) {
      // /watch?v=<id> [&list=...]
      if (url.pathname === '/watch' && url.searchParams.get('v')) {
        const id = url.searchParams.get('v')!;
        if (list) commonQS.set('list', list);
        return `https://www.youtube-nocookie.com/embed/${id}${commonQS.toString() ? `?${commonQS}` : ''}`;
      }

      // playlist pura
      if (url.pathname === '/playlist' && list) {
        // no soporta "start" sobre la lista, pero dejamos rel=0
        const qs = new URLSearchParams();
        qs.set('list', list);
        qs.set('rel', '0');
        return `https://www.youtube-nocookie.com/embed/videoseries?${qs}`;
      }

      // shorts/<id> o live/<id>
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts[0] && parts[1] && (parts[0] === 'shorts' || parts[0] === 'live')) {
        return `https://www.youtube-nocookie.com/embed/${parts[1]}${commonQS.toString() ? `?${commonQS}` : ''}`;
      }
    }
  } catch {}
  return u || undefined;
}

export function toDrivePreview(u?: string | null) {
  if (!u) return u || undefined;
  try {
    const url = new URL(u);
    if (!url.hostname.includes('drive.google.com')) return u;
    // /file/d/<id>/view → /preview
    if (url.pathname.startsWith('/file/d/')) {
      const id = url.pathname.split('/')[3];
      return id ? `https://drive.google.com/file/d/${id}/preview` : u;
    }
    // ?id=<id>
    const id = url.searchParams.get('id');
    if (id) return `https://drive.google.com/file/d/${id}/preview`;
  } catch {}
  return u || undefined;
}

export function normalizeEmbedUrl(u?: string | null) {
  if (!u) return undefined;
  // Primero YouTube, si no matchea, probamos Drive
  const yt = toYouTubeEmbed(u);
  if (yt && yt !== u) return yt;
  return toDrivePreview(u);
}

export function isAudio(u?: string | null) {
  if (!u) return false;
  return /\.(mp3|m4a|wav|ogg)(\?|$)/i.test(u);
}
