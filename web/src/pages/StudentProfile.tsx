import { useEffect, useRef, useState } from 'react';
import { api, type Me } from '../lib/api';

type Campus = 'DERQUI' | 'JOSE_C_PAZ';

// Helpers para fecha
function toISOFromAny(d: string): string | undefined {
  if (!d) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d; // yyyy-mm-dd
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(d.trim()); // dd/mm/yyyy
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return undefined;
}

function fromISOToInput(iso?: string | null): string {
  if (!iso) return '';
  const m = /^\d{4}-\d{2}-\d{2}/.exec(iso);
  return m ? m[0] : '';
}

// Resuelve URL de imagen: si viene relativa (/uploads/..), la convierte a absoluta con VITE_API_URL
function resolveUploadUrl(url?: string | null) {
  if (!url) return '';
  const clean = url.trim();
  if (!clean) return '';
  if (/^https?:\/\//i.test(clean)) return clean;
  const ORIGIN = (import.meta as any).env?.VITE_API_URL?.replace(/\/$/, '') || '';
  return clean.startsWith('/uploads/') && ORIGIN ? `${ORIGIN}${clean}` : clean;
}

/* ========= UTIL: Redimensionar a 400x400 y comprimir < 300 KB ========= */
async function downscaleImage(
  file: File,
  opts?: { maxSide?: number; maxBytes?: number; mime?: string }
): Promise<File> {
  const maxSide = opts?.maxSide ?? 400;
  const maxBytes = opts?.maxBytes ?? 300_000; // 300 KB
  const mime = opts?.mime ?? 'image/webp';     // podés cambiar a 'image/jpeg' si preferís

  if (!file.type.startsWith('image/')) return file;

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });

  let { width, height } = img;
  const scale = Math.min(1, maxSide / Math.max(width, height));
  width = Math.max(1, Math.round(width * scale));
  height = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0, width, height);

  let quality = 0.9;
  let blob: Blob | null = await new Promise(res => canvas.toBlob(res, mime, quality));
  while (blob && blob.size > maxBytes && quality > 0.4) {
    quality -= 0.1;
    // eslint-disable-next-line no-await-in-loop
    blob = await new Promise(res => canvas.toBlob(res, mime, quality));
  }
  let attempts = 0;
  while (blob && blob.size > maxBytes && attempts < 2) {
    attempts += 1;
    width = Math.max(1, Math.round(width * 0.85));
    height = Math.max(1, Math.round(height * 0.85));
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(img, 0, 0, width, height);
    // eslint-disable-next-line no-await-in-loop
    blob = await new Promise(res => canvas.toBlob(res, mime, quality));
  }
  if (!blob) return file;

  const ext = mime === 'image/webp' ? 'webp' : 'jpg';
  const newName = file.name.replace(/\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i, '') + `-mini.${ext}`;
  return new File([blob], newName, { type: mime, lastModified: Date.now() });
}

export default function StudentProfile() {
  const [me, setMe] = useState<Me['user'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // UI: modo edición
  const [editing, setEditing] = useState(false);

  // Estado "form" (editable)
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [campus, setCampus] = useState<Campus>('DERQUI');
  const [phone, setPhone] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(undefined);

  // Nuevos campos
  const [dob, setDob] = useState('');           // yyyy-mm-dd (para <input type="date">)
  const [tutor, setTutor] = useState('');
  const [tutorPhone, setTutorPhone] = useState('');

  // "snapshot" original para Cancelar y detectar cambios
  const [orig, setOrig] = useState<{
    name: string; campus: Campus; phone: string; photoUrl?: string;
    dob?: string | null; tutor?: string; tutorPhone?: string;
  } | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.me();
        setMe(r.user);

        // llenar form
        const rawDob = (r.user as any).dob ?? (r.user as any).birthDate ?? null;
        const dobInput = fromISOToInput(rawDob as any);

        setName(r.user.name || '');
        setEmail(r.user.email || '');
        setCampus(r.user.campus as Campus);
        setPhone((r.user as any).phone || '');
        setPhotoUrl((r.user as any).photoUrl || undefined);
        setDob(dobInput);
        setTutor((r.user as any).tutor || '');
        setTutorPhone((r.user as any).tutorPhone || '');

        // snapshot para cancelar/detección de cambios
        setOrig({
          name: r.user.name || '',
          campus: r.user.campus as Campus,
          phone: (r.user as any).phone || '',
          photoUrl: (r.user as any).photoUrl || undefined,
          dob: rawDob ? String(rawDob) : null,
          tutor: (r.user as any).tutor || '',
          tutorPhone: (r.user as any).tutorPhone || '',
        });

      } catch (e: any) {
        setErr(e.message || 'Error al cargar el perfil');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function resetToOrig() {
    if (!orig) return;
    setName(orig.name);
    setCampus(orig.campus);
    setPhone(orig.phone || '');
    setPhotoUrl(orig.photoUrl || undefined);
    setDob(fromISOToInput(orig.dob || undefined));
    setTutor(orig.tutor || '');
    setTutorPhone(orig.tutorPhone || '');
  }

  async function uploadAvatar(file: File) {
    const ORIGIN = (import.meta as any).env?.VITE_API_URL?.replace(/\/$/, '') || '';
    const API_BASE = ORIGIN ? `${ORIGIN}/api` : '/api';

    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`${API_BASE}/uploads/avatar`, {
      method: 'POST',
      body: fd,
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
    return data as { url: string }; // típicamente: { url: "/uploads/avatars/xyz.jpg" }
  }

  async function saveProfile() {
    try {
      setErr(null); setMsg(null); setSaving(true);

      // Normalizamos fecha a YYYY-MM-DD si corresponde
      const isoDob = toISOFromAny(dob);

      // Construimos payload sólo con cambios vs original (evita pisar con vacíos)
      const payload: any = {};
      if (orig) {
        if (name !== orig.name) payload.name = name;
        if (campus !== orig.campus) payload.campus = campus;
        if (phone !== (orig.phone || '')) payload.phone = phone;
        if (photoUrl !== orig.photoUrl) payload.photoUrl = photoUrl;

        const origDobISO = fromISOToInput(orig.dob || undefined); // a yyyy-mm-dd comparable
        if ((isoDob || '') !== (origDobISO || '')) payload.dob = isoDob;

        if ((tutor || '') !== (orig.tutor || '')) payload.tutor = tutor || undefined;
        if ((tutorPhone || '') !== (orig.tutorPhone || '')) payload.tutorPhone = tutorPhone || undefined;
      } else {
        payload.name = name;
        payload.campus = campus;
        payload.phone = phone;
        payload.photoUrl = photoUrl;
        payload.dob = isoDob;
        payload.tutor = tutor || undefined;
        payload.tutorPhone = tutorPhone || undefined;
      }

      // Si no hay cambios, salimos sin llamar al backend
      if (Object.keys(payload).length === 0) {
        setMsg('Sin cambios');
        setEditing(false);
        return;
      }

      await api.updateMe(payload);
      setMsg('Perfil actualizado');
      setEditing(false);

      // refrescamos /me y snapshot
      try {
        const r = await api.me();
        setMe(r.user);

        const rawDob = (r.user as any).dob ?? (r.user as any).birthDate ?? null;

        setOrig({
          name: r.user.name || '',
          campus: r.user.campus as Campus,
          phone: (r.user as any).phone || '',
          photoUrl: (r.user as any).photoUrl || undefined,
          dob: rawDob ? String(rawDob) : null,
          tutor: (r.user as any).tutor || '',
          tutorPhone: (r.user as any).tutorPhone || '',
        });
      } catch {}
    } catch (e: any) {
      setErr(e.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  function onPickFile() {
    fileRef.current?.click();
  }

  async function onChangeFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!/^image\//.test(f.type)) { setErr('Subí una imagen válida'); return; }

    try {
      setErr(null); setMsg(null);

      // 🔽 Procesamos antes de subir (400x400, <300KB, WEBP)
      const processed = await downscaleImage(f, { maxSide: 400, maxBytes: 300_000, mime: 'image/webp' });

      const up = await uploadAvatar(processed);

      // ✅ Para pasar la validación zod.url(), enviamos URL absoluta si vino relativa
      const ORIGIN = (import.meta as any).env?.VITE_API_URL?.replace(/\/$/, '') || '';
      const absoluteUrl = /^https?:\/\//i.test(up.url) ? up.url : (ORIGIN ? `${ORIGIN}${up.url}` : up.url);

      // preview inmediata
      setPhotoUrl(absoluteUrl);

      // 🔒 Sólo actualizamos photoUrl en el backend (no tocamos otros campos)
      await api.updateMe({ photoUrl: absoluteUrl });
      setMsg('Foto actualizada');

      // refrescamos snapshot/orig para que "Cancelar" no vuelva a la imagen vieja
      setOrig((prev) => prev ? { ...prev, photoUrl: absoluteUrl } : prev);
    } catch (e: any) {
      setErr(e.message || 'No se pudo subir la foto');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  if (loading) {
    return (
      <div className="card p-4">
        <div className="h-6 w-40 skeleton mb-4" />
        <div className="h-40 w-full skeleton" />
      </div>
    );
  }

  const imgSrc = resolveUploadUrl(photoUrl);

  return (
    <div className="card p-4">
      <h1 className="font-heading text-xl mb-3">Mi perfil</h1>

      <div className="grid grid-cols-1 md:grid-cols-[280px,1fr] gap-4 items-start">
        {/* Avatar */}
        <div className="space-y-3">
          <div className="w-full aspect-square max-w-[260px] rounded-2xl bg-neutral-100 border border-neutral-200 flex items-center justify-center overflow-hidden">
            {imgSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imgSrc} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="text-neutral-500">Sin foto</div>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onChangeFile}
          />
          <button className="btn btn-secondary" onClick={onPickFile}>Cambiar foto</button>
          <div className="text-xs text-neutral-600">
            Recomendado: 400×400, &lt; 300 KB. La imagen se guarda como archivo y solo se almacena la URL en la base.
          </div>
        </div>

        {/* Form */}
        <div className="space-y-3">
          {/* Barra de acciones */}
          <div className="flex flex-wrap gap-2 justify-end">
            {!editing ? (
              <button className="btn btn-secondary" onClick={() => setEditing(true)}>Editar</button>
            ) : (
              <>
                <button className="btn btn-primary" onClick={saveProfile} disabled={saving}>
                  {saving ? 'Guardando…' : 'Guardar cambios'}
                </button>
                <button
                  className="btn"
                  onClick={() => { resetToOrig(); setEditing(false); setMsg(null); setErr(null); }}
                  disabled={saving}
                >
                  Cancelar
                </button>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="w-full">
              <div className="text-sm text-neutral-600 mb-1">Nombre</div>
              <input className="input" value={name} onChange={e=>setName(e.target.value)} disabled={!editing} />
            </label>

            <label className="w-full">
              <div className="text-sm text-neutral-600 mb-1">Email</div>
              <input className="input" value={email} disabled />
            </label>

            <label className="w-full">
              <div className="text-sm text-neutral-600 mb-1">Teléfono</div>
              <input className="input" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+54 11 ..." disabled={!editing} />
            </label>

            <label className="w-full">
              <div className="text-sm text-neutral-600 mb-1">Sede</div>
              <select className="input" value={campus} onChange={e=>setCampus(e.target.value as Campus)} disabled={!editing}>
                <option value="DERQUI">Derqui</option>
                <option value="JOSE_C_PAZ">José C. Paz</option>
              </select>
            </label>

            <label className="w-full">
              <div className="text-sm text-neutral-600 mb-1">Fecha de nacimiento</div>
              <input
                type="date"
                className="input"
                value={dob}
                onChange={e=>setDob(e.target.value)}
                disabled={!editing}
              />
            </label>

            <label className="w-full">
              <div className="text-sm text-neutral-600 mb-1">Tutor</div>
              <input className="input" value={tutor} onChange={e=>setTutor(e.target.value)} placeholder="Nombre del tutor" disabled={!editing} />
            </label>

            <label className="w-full">
              <div className="text-sm text-neutral-600 mb-1">Tel. Tutor</div>
              <input className="input" value={tutorPhone} onChange={e=>setTutorPhone(e.target.value)} placeholder="+54 11 ..." disabled={!editing} />
            </label>
          </div>

          <div className="flex items-center gap-2">
            {msg && <span className="text-success text-sm">{msg}</span>}
            {err && <span className="text-danger text-sm">{err}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
