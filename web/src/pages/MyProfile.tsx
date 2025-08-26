import { useEffect, useState } from 'react';
import { api, type Me } from '../lib/api';

export default function MyProfile() {
  const [me, setMe] = useState<Me['user'] | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [campus, setCampus] = useState<'DERQUI'|'JOSE_C_PAZ'>('DERQUI');
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const r = await api.me();
      setMe(r.user);
      setName(r.user.name);
      setPhone(r.user.phone || '');
      setCampus(r.user.campus);
      setAvatarUrl(r.user.avatarUrl);
    })();
  }, []);

  const onSave = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const r = await api.account.update({ name, phone, campus, avatarUrl });
      setMe(r.user);
      setMsg('Datos guardados');
    } catch (e:any) {
      setMsg(e.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const onPickAvatar = async (file?: File | null) => {
    if (!file) return;
    try {
      const { url } = await api.uploads.avatar(file);
      setAvatarUrl(url);
      setMsg('Foto subida');
    } catch (e:any) {
      setMsg(e.message || 'No se pudo subir la foto');
    }
  };

  if (!me) return <div className="card p-4">Cargando…</div>;

  return (
    <div className="space-y-3">
      <h1 className="font-heading text-xl">Mi perfil</h1>

      <div className="card p-4 grid grid-cols-1 md:grid-cols-[160px,1fr] gap-4 items-start">
        <div className="space-y-2">
          <div className="w-36 h-36 rounded-2xl border border-neutral-200 overflow-hidden bg-neutral-50">
            {avatarUrl ? (
              <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-neutral-500">Sin foto</div>
            )}
          </div>
          <label className="btn btn-secondary block text-center cursor-pointer">
            Cambiar foto
            <input type="file" accept="image/*" className="hidden" onChange={e => onPickAvatar(e.target.files?.[0] || null)} />
          </label>
          <div className="text-xs text-neutral-600">
            Recomendado: 400×400, &lt; 300 KB. La imagen se guarda como archivo y solo se almacena la URL en la base.
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-sm block mb-1">Nombre</label>
            <input className="input w-full" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label className="text-sm block mb-1">Email</label>
            <input className="input w-full bg-neutral-50" value={me.email} readOnly />
          </div>
          <div>
            <label className="text-sm block mb-1">Teléfono</label>
            <input className="input w-full" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+54 11 ..." />
          </div>
          <div>
            <label className="text-sm block mb-1">Sede</label>
            <select className="input w-full" value={campus} onChange={e => setCampus(e.target.value as any)}>
              <option value="DERQUI">Derqui</option>
              <option value="JOSE_C_PAZ">José C. Paz</option>
            </select>
          </div>

          <div className="col-span-full">
            <button className="btn btn-primary" onClick={onSave} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
            {msg && <span className="ml-3 text-neutral-700">{msg}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
