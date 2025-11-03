export function toYouTubeEmbed(u?: string | null) {
  if (!u) return u || undefined;
  try {
    const url = new URL(u);
    if (url.hostname === 'youtu.be') {
      const id = url.pathname.slice(1);
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : u;
    }
    if (url.hostname.includes('youtube.com')) {
      const v = url.searchParams.get('v');
      if (v) return `https://www.youtube-nocookie.com/embed/${v}`;
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts[0] && parts[1] && (parts[0]==='shorts' || parts[0]==='live')) {
        return `https://www.youtube-nocookie.com/embed/${parts[1]}`;
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
    if (url.pathname.startsWith('/file/d/')) {
      const id = url.pathname.split('/')[3];
      return id ? `https://drive.google.com/file/d/${id}/preview` : u;
    }
    const id = url.searchParams.get('id');
    if (id) return `https://drive.google.com/file/d/${id}/preview`;
  } catch {}
  return u || undefined;
}

export function normalizeEmbedUrl(u?: string | null) {
  if (!u) return undefined;
  return toDrivePreview(toYouTubeEmbed(u));
}

export function isAudio(u?: string | null) {
  if (!u) return false;
  return /\.(mp3|m4a|wav|ogg)(\?|$)/i.test(u);
}
