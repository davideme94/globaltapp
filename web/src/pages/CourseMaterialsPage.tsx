import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, type Me } from '../lib/api';

export default function CourseMaterialsPage() {
  const { id } = useParams<{ id: string }>();

  const [me, setMe] = useState<Me['user'] | null>(null);
  const [courseName, setCourseName] = useState('');

  const [syllabusUrl, setSyllabusUrl] = useState('');
  const [materialsUrl, setMaterialsUrl] = useState('');

  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const canEdit = me?.role === 'coordinator' || me?.role === 'admin';

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr(null);

        const m = await api.me();
        if (!alive) return;
        setMe(m.user);

        if (!id) return;
        const r = await api.courses.links.get(id);
        if (!alive) return;

        setCourseName(`${r.course.name} — ${r.course.year}`);
        setSyllabusUrl(r.links?.syllabusUrl || '');
        setMaterialsUrl(r.links?.materialsUrl || '');
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || 'No se pudo cargar el material del curso.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  async function save() {
    if (!id) return;
    setErr(null);
    try {
      await api.courses.links.set(id, {
        syllabusUrl: syllabusUrl || undefined,
        materialsUrl: materialsUrl || undefined,
      });
      setMsg('Material de curso guardado.');
      setTimeout(() => setMsg(null), 2000);
    } catch (e: any) {
      setErr(e?.message || 'No se pudo guardar.');
    }
  }

  return (
    <div className="space-y-3">
      <h1 className="font-heading text-xl">
        Material del curso — <span className="opacity-80">{courseName || 'Curso'}</span>
      </h1>

      {/* Card principal */}
      <div className="card p-4 space-y-4 max-w-3xl">
        {loading && (
          <div className="space-y-2">
            <div className="h-5 w-48 skeleton" />
            <div className="h-20 skeleton" />
          </div>
        )}

        {!loading && (
          <>
            {err && <div className="text-danger">{err}</div>}

            {/* Acciones rápidas tipo "chips" */}
            {(syllabusUrl || materialsUrl) ? (
              <div className="flex flex-wrap gap-2">
                {materialsUrl && (
                  <a
                    className="btn btn-secondary !py-1"
                    href={materialsUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Abrir carpeta
                  </a>
                )}
                {syllabusUrl && (
                  <a
                    className="btn btn-secondary !py-1"
                    href={syllabusUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Syllabus
                  </a>
                )}
              </div>
            ) : (
              <div className="text-neutral-600">Aún no hay materiales cargados.</div>
            )}

            {/* Formulario solo para coord/admin */}
            {canEdit && (
              <div className="grid gap-3 pt-2">
                <label className="grid gap-1">
                  <span className="text-sm font-medium">URL Syllabus (Drive)</span>
                  <input
                    className="input"
                    placeholder="https://drive.google.com/..."
                    value={syllabusUrl}
                    onChange={(e) => setSyllabusUrl(e.target.value)}
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-sm font-medium">URL Carpeta materiales (Drive)</span>
                  <input
                    className="input"
                    placeholder="https://drive.google.com/..."
                    value={materialsUrl}
                    onChange={(e) => setMaterialsUrl(e.target.value)}
                  />
                </label>

                <div className="flex items-center gap-3">
                  <button className="btn btn-primary" onClick={save}>Guardar</button>
                  {msg && <div className="text-green-600 text-sm">{msg}</div>}
                </div>

                <div className="text-xs text-neutral-600">
                  Solo coordinador/administrativo pueden editar. Los docentes pueden visualizar.
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
