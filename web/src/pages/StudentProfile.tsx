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
  const mime = opts?.mime ?? 'image/webp'; // podés cambiar a 'image/jpeg' si preferís

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
  const [dob, setDob] = useState(''); // yyyy-mm-dd (para <input type="date">)
  const [tutor, setTutor] = useState('');
  const [tutorPhone, setTutorPhone] = useState('');

  // "snapshot" original para Cancelar y detectar cambios
  const [orig, setOrig] = useState<{
    name: string;
    campus: Campus;
    phone: string;
    photoUrl?: string;
    dob?: string | null;
    tutor?: string;
    tutorPhone?: string;
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
      setErr(null);
      setMsg(null);
      setSaving(true);

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

    if (!/^image\//.test(f.type)) {
      setErr('Subí una imagen válida');
      return;
    }

    try {
      setErr(null);
      setMsg(null);

      // 🔽 Procesamos antes de subir (400x400, <300KB, WEBP)
      const processed = await downscaleImage(f, {
        maxSide: 400,
        maxBytes: 300_000,
        mime: 'image/webp',
      });

      const up = await uploadAvatar(processed);

      // ✅ Para pasar la validación zod.url(), enviamos URL absoluta si vino relativa
      const ORIGIN = (import.meta as any).env?.VITE_API_URL?.replace(/\/$/, '') || '';
      const absoluteUrl = /^https?:\/\//i.test(up.url) ? up.url : ORIGIN ? `${ORIGIN}${up.url}` : up.url;

      // preview inmediata
      setPhotoUrl(absoluteUrl);

      // 🔒 Sólo actualizamos photoUrl en el backend (no tocamos otros campos)
      await api.updateMe({ photoUrl: absoluteUrl });

      setMsg('Foto actualizada');

      // refrescamos snapshot/orig para que "Cancelar" no vuelva a la imagen vieja
      setOrig(prev => prev ? { ...prev, photoUrl: absoluteUrl } : prev);
    } catch (e: any) {
      setErr(e.message || 'No se pudo subir la foto');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6 px-3 py-4 sm:px-5 md:px-6 md:py-6">
        <section className="overflow-hidden rounded-[2rem] border border-neutral-200 bg-white p-5 shadow-xl shadow-neutral-100 sm:p-7">
          <div className="flex flex-col gap-6 md:flex-row">
            <div className="h-64 w-full max-w-[280px] animate-pulse rounded-[2rem] bg-neutral-100" />

            <div className="min-w-0 flex-1 space-y-4">
              <div className="h-7 w-56 animate-pulse rounded-full bg-neutral-100" />
              <div className="h-5 w-80 max-w-full animate-pulse rounded-full bg-neutral-100" />

              <div className="grid gap-4 md:grid-cols-2">
                <div className="h-14 animate-pulse rounded-2xl bg-neutral-100" />
                <div className="h-14 animate-pulse rounded-2xl bg-neutral-100" />
                <div className="h-14 animate-pulse rounded-2xl bg-neutral-100" />
                <div className="h-14 animate-pulse rounded-2xl bg-neutral-100" />
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  const imgSrc = resolveUploadUrl(photoUrl);
  const campusLabel = campus === 'DERQUI' ? 'Derqui' : 'José C. Paz';
  const roleLabel =
    me?.role === 'student'
      ? 'Alumno'
      : me?.role === 'teacher'
        ? 'Docente'
        : me?.role === 'coordinator'
          ? 'Coordinación'
          : me?.role === 'admin'
            ? 'Administración'
            : 'Usuario';

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
                👤 Perfil del estudiante
              </div>

              <h1 className="break-words text-2xl font-black tracking-tight text-neutral-950 sm:text-3xl md:text-4xl">
                Mi perfil
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-neutral-600 sm:text-base">
                Revisá y actualizá tus datos personales, foto de perfil e información de contacto.
              </p>
            </div>

            <div className="grid w-full gap-3 sm:grid-cols-2 md:w-auto md:min-w-[360px]">
              <div className="rounded-3xl border border-violet-100 bg-violet-50/80 px-5 py-4 shadow-sm">
                <p className="text-xs font-black uppercase tracking-wide text-violet-500">
                  Rol
                </p>
                <p className="mt-1 text-sm font-black text-violet-800">
                  {roleLabel}
                </p>
              </div>

              <div className="rounded-3xl border border-sky-100 bg-sky-50/80 px-5 py-4 shadow-sm">
                <p className="text-xs font-black uppercase tracking-wide text-sky-500">
                  Sede
                </p>
                <p className="mt-1 text-sm font-black text-sky-800">
                  {campusLabel}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ALERTAS */}
      {(msg || err) && (
        <section className="space-y-3">
          {msg && (
            <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-700 shadow-sm">
              ✅ {msg}
            </div>
          )}

          {err && (
            <div className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-bold text-rose-700 shadow-sm">
              {err}
            </div>
          )}
        </section>
      )}

      {/* CARD PRINCIPAL */}
      <section className="overflow-hidden rounded-[2rem] border border-neutral-200 bg-white shadow-xl shadow-neutral-100">
        <div className="grid gap-0 lg:grid-cols-[320px_1fr]">
          {/* AVATAR */}
          <aside className="relative overflow-hidden border-b border-neutral-200 bg-gradient-to-b from-violet-50 via-white to-sky-50 p-5 sm:p-7 lg:border-b-0 lg:border-r">
            <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-violet-200/60 blur-3xl" />
            <div className="absolute -bottom-10 -left-10 h-36 w-36 rounded-full bg-sky-200/60 blur-3xl" />

            <div className="relative space-y-5">
              <div className="mx-auto flex w-full max-w-[260px] flex-col items-center">
                <div className="relative h-64 w-64 max-w-full overflow-hidden rounded-[2rem] border border-white bg-neutral-100 shadow-xl shadow-neutral-200">
                  {imgSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imgSrc}
                      alt="avatar"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-100 to-neutral-200 text-sm font-bold text-neutral-500">
                      Sin foto
                    </div>
                  )}

                  <div className="absolute bottom-3 left-3 rounded-full border border-white/70 bg-white/90 px-3 py-1 text-xs font-black uppercase tracking-wide text-neutral-700 shadow-sm backdrop-blur">
                    Foto de perfil
                  </div>
                </div>

                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onChangeFile}
                />

                <button
                  className="mt-4 w-full rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-500 px-5 py-3 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-violet-200 transition hover:-translate-y-0.5 hover:shadow-xl"
                  onClick={onPickFile}
                >
                  Cambiar foto
                </button>

                <div className="mt-3 rounded-2xl border border-neutral-200 bg-white/80 px-4 py-3 text-xs leading-relaxed text-neutral-500 shadow-sm">
                  Recomendado: 400×400, &lt; 300 KB. La imagen se guarda como archivo y solo se almacena la URL en la base.
                </div>
              </div>
            </div>
          </aside>

          {/* FORM */}
          <div className="p-5 sm:p-7">
            {/* BARRA DE ACCIONES */}
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-black text-neutral-950">
                  Datos personales
                </h2>
                <p className="text-sm text-neutral-500">
                  {editing
                    ? 'Estás editando tu información. Guardá o cancelá los cambios.'
                    : 'Estos son los datos registrados en tu perfil.'}
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                {!editing ? (
                  <button
                    className="w-full rounded-2xl border border-violet-200 bg-violet-50 px-5 py-3 text-sm font-black uppercase tracking-wide text-violet-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-violet-100 hover:shadow-md sm:w-auto"
                    onClick={() => setEditing(true)}
                  >
                    Editar
                  </button>
                ) : (
                  <>
                    <button
                      className="w-full rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-500 px-5 py-3 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-violet-200 transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
                      onClick={saveProfile}
                      disabled={saving}
                    >
                      {saving ? 'Guardando…' : 'Guardar cambios'}
                    </button>

                    <button
                      className="w-full rounded-2xl border border-neutral-200 bg-white px-5 py-3 text-sm font-black uppercase tracking-wide text-neutral-700 shadow-sm transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
                      onClick={() => {
                        resetToOrig();
                        setEditing(false);
                        setMsg(null);
                        setErr(null);
                      }}
                      disabled={saving}
                    >
                      Cancelar
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="w-full">
                <div className="mb-1.5 text-sm font-black text-neutral-700">
                  Nombre
                </div>
                <input
                  className="min-h-[52px] w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-700 outline-none transition placeholder:text-neutral-400 focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  disabled={!editing}
                />
              </label>

              <label className="w-full">
                <div className="mb-1.5 text-sm font-black text-neutral-700">
                  Email
                </div>
                <input
                  className="min-h-[52px] w-full rounded-2xl border border-neutral-200 bg-neutral-100 px-4 py-3 text-sm font-semibold text-neutral-500 outline-none disabled:cursor-not-allowed"
                  value={email}
                  disabled
                />
              </label>

              <label className="w-full">
                <div className="mb-1.5 text-sm font-black text-neutral-700">
                  Teléfono
                </div>
                <input
                  className="min-h-[52px] w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-700 outline-none transition placeholder:text-neutral-400 focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+54 11 ..."
                  disabled={!editing}
                />
              </label>

              <label className="w-full">
                <div className="mb-1.5 text-sm font-black text-neutral-700">
                  Sede
                </div>
                <select
                  className="min-h-[52px] w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-700 outline-none transition focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500"
                  value={campus}
                  onChange={e => setCampus(e.target.value as Campus)}
                  disabled={!editing}
                >
                  <option value="DERQUI">Derqui</option>
                  <option value="JOSE_C_PAZ">José C. Paz</option>
                </select>
              </label>

              <label className="w-full">
                <div className="mb-1.5 text-sm font-black text-neutral-700">
                  Fecha de nacimiento
                </div>
                <input
                  type="date"
                  className="min-h-[52px] w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-700 outline-none transition focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500"
                  value={dob}
                  onChange={e => setDob(e.target.value)}
                  disabled={!editing}
                />
              </label>

              <label className="w-full">
                <div className="mb-1.5 text-sm font-black text-neutral-700">
                  Tutor
                </div>
                <input
                  className="min-h-[52px] w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-700 outline-none transition placeholder:text-neutral-400 focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500"
                  value={tutor}
                  onChange={e => setTutor(e.target.value)}
                  placeholder="Nombre del tutor"
                  disabled={!editing}
                />
              </label>

              <label className="w-full md:col-span-2">
                <div className="mb-1.5 text-sm font-black text-neutral-700">
                  Tel. Tutor
                </div>
                <input
                  className="min-h-[52px] w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-700 outline-none transition placeholder:text-neutral-400 focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500"
                  value={tutorPhone}
                  onChange={e => setTutorPhone(e.target.value)}
                  placeholder="+54 11 ..."
                  disabled={!editing}
                />
              </label>
            </div>

            <div className="mt-6 rounded-3xl border border-neutral-200 bg-neutral-50 px-5 py-4 text-xs leading-relaxed text-neutral-500">
              El email no se puede modificar desde esta pantalla. Para cambiarlo, contactá a administración.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
