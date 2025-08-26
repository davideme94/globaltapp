import { useEffect, useRef, useState } from 'react';
import { api, type Me } from '../lib/api';

type Campus = 'DERQUI' | 'JOSE_C_PAZ';
const API_BASE = (import.meta as any).env?.VITE_API_URL ?? '/api';

export default function StudentProfile() {
  const [me, setMe] = useState<Me['user'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [campus, setCampus] = useState<Campus>('DERQUI');
  const [phone, setPhone] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(undefined);

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.me();
        setMe(r.user);
        setName(r.user.name || '');
        setEmail(r.user.email || '');
        setCampus(r.user.campus as Campus);
        // @ts-ignore (campos opcionales)
        setPhone((r.user as any).phone || '');
        // @ts-ignore
        setPhotoUrl((r.user as any).photoUrl || undefined);
      } catch (e:any) {
        setErr(e.message || 'Error al cargar el perfil');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function uploadAvatar(file: File) {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`${API_BASE}/uploads/avatar`, {
      method: 'POST',
      body: fd,
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
    return data as { url: string };
  }

  async function saveProfile() {
    try {
      setErr(null); setMsg(null); setSaving(true);
      const res = await fetch(`${API_BASE}/me`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, campus, phone, photoUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
      setMsg('Perfil actualizado');
      // refrescamos barra superior
      await api.me().then(r => setMe(r.user)).catch(()=>{});
    } catch (e:any) {
      setErr(e.message);
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
    if (f.size > 1_000_000 * 3) { setErr('Máximo 3MB'); return; }
    try {
      setErr(null); setMsg(null);
      const up = await uploadAvatar(f);
      setPhotoUrl(up.url);
      // guardamos de una el nuevo photoUrl
      await saveProfile();
      setMsg('Foto actualizada');
    } catch (e:any) {
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

  return (
    <div className="card p-4">
      <h1 className="font-heading text-xl mb-3">Mi perfil</h1>

      <div className="grid grid-cols-1 md:grid-cols-[280px,1fr] gap-4 items-start">
        {/* Avatar */}
        <div className="space-y-3">
          <div className="w-full aspect-square max-w-[260px] rounded-2xl bg-neutral-100 border border-neutral-200 flex items-center justify-center overflow-hidden">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt="avatar" className="w-full h-full object-cover" />
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="w-full">
              <div className="text-sm text-neutral-600 mb-1">Nombre</div>
              <input className="input" value={name} onChange={e=>setName(e.target.value)} />
            </label>

            <label className="w-full">
              <div className="text-sm text-neutral-600 mb-1">Email</div>
              <input className="input" value={email} disabled />
            </label>

            <label className="w-full">
              <div className="text-sm text-neutral-600 mb-1">Teléfono</div>
              <input className="input" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+54 11 ..." />
            </label>

            <label className="w-full">
              <div className="text-sm text-neutral-600 mb-1">Sede</div>
              <select className="input" value={campus} onChange={e=>setCampus(e.target.value as Campus)}>
                <option value="DERQUI">Derqui</option>
                <option value="JOSE_C_PAZ">José C. Paz</option>
              </select>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button className="btn btn-primary" onClick={saveProfile} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
            {msg && <span className="text-success text-sm">{msg}</span>}
            {err && <span className="text-danger text-sm">{err}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
