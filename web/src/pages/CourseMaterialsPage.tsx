import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, type Me } from '../lib/api';

export default function CourseMaterialsPage() {
  const { id } = useParams<{ id: string }>();
  const [me, setMe] = useState<Me['user']|null>(null);
  const [syllabusUrl, setSyllabusUrl] = useState('');
  const [materialsUrl, setMaterialsUrl] = useState('');
  const [msg, setMsg] = useState<string|null>(null);
  const [courseName, setCourseName] = useState('');

  const canEdit = me?.role === 'coordinator' || me?.role === 'admin';

  useEffect(() => {
    (async () => {
      const m = await api.me(); setMe(m.user);
      if (!id) return;
      const r = await api.courses.links.get(id);
      setCourseName(`${r.course.name} (${r.course.year})`);
      setSyllabusUrl(r.links?.syllabusUrl || '');
      setMaterialsUrl(r.links?.materialsUrl || '');
    })();
  }, [id]);

  async function save() {
    if (!id) return;
    await api.courses.links.set(id, { syllabusUrl: syllabusUrl || undefined, materialsUrl: materialsUrl || undefined });
    setMsg('Links actualizados.');
    setTimeout(()=>setMsg(null), 2000);
  }

  return (
    <div style={{ padding:16, maxWidth:800 }}>
      <h1>Material del curso — {courseName}</h1>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
        {syllabusUrl && <a href={syllabusUrl} target="_blank" rel="noreferrer"><button>Abrir syllabus</button></a>}
        {materialsUrl && <a href={materialsUrl} target="_blank" rel="noreferrer"><button>Abrir carpeta</button></a>}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:8 }}>
        <input placeholder="URL Syllabus (Drive)" value={syllabusUrl} onChange={e=>setSyllabusUrl(e.target.value)} disabled={!canEdit} />
        <input placeholder="URL Carpeta materiales (Drive)" value={materialsUrl} onChange={e=>setMaterialsUrl(e.target.value)} disabled={!canEdit} />
        <button onClick={save} disabled={!canEdit}>Guardar</button>
        {msg && <div style={{ color:'#16a34a' }}>{msg}</div>}
        {!canEdit && <small style={{ color:'#64748b' }}>Solo coordinador/administrativo pueden editar. Los docentes pueden visualizar.</small>}
      </div>
    </div>
  );
}
