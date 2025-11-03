import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { normalizeEmbedUrl, isAudio } from '../lib/media';

type SetRow = { _id:string; title:string; units?:number; tags?:string[] };
type Q = {
  _id:string; set?:string;
  unit?: number|null;
  prompt:string;
  type:'MC'|'GAP';
  options?: string[]|null;
  answer:string;
  imageUrl?:string|null;
  embedUrl?:string|null;
};

export default function CoordinatorPracticeSets() {
  const [sets, setSets] = useState<SetRow[]>([]);
  const [sel, setSel] = useState<string>('');
  const [msg, setMsg] = useState<string|null>(null);

  // form set (crear)
  const [title, setTitle] = useState('');
  const [units, setUnits] = useState<number|''>('');
  const [tags, setTags] = useState('');

  // ====== NUEVO: editar set seleccionado ======
  const selSet = useMemo(() => sets.find(s => s._id === sel) || null, [sets, sel]);
  const [editTitle, setEditTitle] = useState('');
  const [editUnits, setEditUnits] = useState<number|''>('');
  const [editTags, setEditTags] = useState('');

  // form pregunta (crear/editar)
  const [unit, setUnit] = useState<number|''>('');
  const [prompt, setPrompt] = useState('');
  const [type, setType] = useState<'MC'|'GAP'>('MC');
  const [options, setOptions] = useState<string[]>(['', '', '']);
  const [answer, setAnswer] = useState('');
  const [media, setMedia] = useState<'none'|'image'|'embed'>('none');
  const [imageUrl, setImageUrl] = useState('');
  const [embedUrl, setEmbedUrl] = useState('');

  // ====== NUEVO: listado/edición de preguntas ======
  const [questions, setQuestions] = useState<Q[]>([]);
  const [loadingQs, setLoadingQs] = useState(false);
  const [editingQId, setEditingQId] = useState<string|null>(null);

  async function loadSets() {
    const r = await api.practice.listSets();
    setSets(r.rows);
    if (!sel && r.rows[0]) setSel(r.rows[0]._id);
  }
  useEffect(()=>{ loadSets(); }, []);

  // cuando cambia el set seleccionado → precargar sus datos para editar
  useEffect(() => {
    if (!selSet) return;
    setEditTitle(selSet.title || '');
    setEditUnits(typeof selSet.units==='number' ? selSet.units : '');
    setEditTags((selSet.tags || []).join(', '));
    loadQuestionsBySet(selSet._id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel]);

  function setOpt(i:number, val:string) {
    setOptions(prev => prev.map((x,idx)=>idx===i?val:x));
  }

  async function createSet() {
    const payload:any = { title: title.trim() };
    if (units) payload.units = Number(units);
    if (tags.trim()) payload.tags = tags.split(',').map((t:string)=>t.trim()).filter(Boolean);
    if (!payload.title) return alert('Título requerido');
    await api.practice.createSet(payload);
    setTitle(''); setUnits(''); setTags('');
    setMsg('Set creado'); setTimeout(()=>setMsg(null), 1200);
    await loadSets();
  }

  async function createQuestion() {
    if (!sel) return alert('Elegí un Set');
    const body:any = {
      setId: sel,
      unit: unit ? Number(unit) : undefined,
      prompt: prompt.trim(),
      type,
      options: type==='MC' ? options.filter(Boolean) : undefined,
      answer: answer.trim(),
      imageUrl: media==='image' ? imageUrl.trim() : undefined,
      // 👇 normalizamos embeds (YouTube/Drive → /embed o /preview)
      embedUrl: media==='embed' ? (normalizeEmbedUrl(embedUrl.trim()) || embedUrl.trim()) : undefined,
    };
    if (!body.prompt) return alert('Falta el enunciado');
    if (!body.answer) return alert('Falta la respuesta');
    if (type==='MC' && (!body.options || body.options.length<2)) return alert('Mínimo 2 opciones en MC');

    await api.practice.createQuestion(body);
    await afterSaveQuestion('Pregunta creada');
  }

  // ====== NUEVO: actualizar pregunta ======
  async function updateQuestion() {
    if (!editingQId) return;
    const body:any = {
      unit: unit ? Number(unit) : undefined,
      prompt: prompt.trim(),
      type,
      options: type==='MC' ? options.filter(Boolean) : undefined,
      answer: answer.trim(),
      imageUrl: media==='image' ? imageUrl.trim() : (media==='none' ? '' : undefined),
      // 👇 normalizamos; si se quita media, mandamos vacío para limpiar
      embedUrl: media==='embed'
        ? (normalizeEmbedUrl(embedUrl.trim()) || embedUrl.trim())
        : (media==='none' ? '' : undefined),
    };
    if (!body.prompt) return alert('Falta el enunciado');
    if (!body.answer) return alert('Falta la respuesta');
    if (type==='MC' && (!body.options || body.options.length<2)) return alert('Mínimo 2 opciones en MC');

    await api.practice.updateQuestion(editingQId, body);
    await afterSaveQuestion('Pregunta actualizada');
  }

  async function afterSaveQuestion(okMsg: string) {
    setPrompt(''); setAnswer(''); setOptions(['','','']); setUnit('');
    setImageUrl(''); setEmbedUrl(''); setMedia('none'); setType('MC');
    setEditingQId(null);
    setMsg(okMsg); setTimeout(()=>setMsg(null), 1200);
    if (sel) await loadQuestionsBySet(sel);
  }

  // ====== NUEVO: cargar preguntas del set ======
  async function loadQuestionsBySet(setId: string) {
    try {
      setLoadingQs(true);
      const r = await api.practice.listQuestionsBySet(setId);
      setQuestions(r.questions || []);
    } finally {
      setLoadingQs(false);
    }
  }

  // ====== NUEVO: editar/llenar formulario desde una pregunta ======
  function startEditQuestion(q: Q) {
    setEditingQId(q._id);
    setUnit(typeof q.unit==='number' ? q.unit : '');
    setPrompt(q.prompt || '');
    setType(q.type);
    setOptions(Array.isArray(q.options) ? (q.options.length ? q.options : ['','','']) : ['','','']);
    setAnswer(q.answer || '');
    if (q.imageUrl) { setMedia('image'); setImageUrl(q.imageUrl || ''); setEmbedUrl(''); }
    else if (q.embedUrl) { setMedia('embed'); setEmbedUrl(q.embedUrl || ''); setImageUrl(''); }
    else { setMedia('none'); setImageUrl(''); setEmbedUrl(''); }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ====== NUEVO: borrar pregunta (optimista + fallback) ======
  async function removeQuestion(id: string) {
    if (!confirm('¿Eliminar esta pregunta?')) return;

    // 1) UI optimista: la quitamos ya mismo
    setQuestions(qs => qs.filter(q => q._id !== id));

    try {
      // 2) Intento real en backend
      await api.practice.deleteQuestion(id);
      setMsg('Pregunta eliminada'); setTimeout(()=>setMsg(null), 1200);
    } catch (e:any) {
      console.warn('Fallo al eliminar en backend, la removí del UI igual:', e);
      // 3) Fallback suave: avisamos y re-cargamos para verificar estado real
      setMsg('Eliminada localmente (verificando)'); setTimeout(()=>setMsg(null), 1500);
      try { if (sel) await loadQuestionsBySet(sel); } catch {}
    }
  }

  // ====== NUEVO: guardar cambios del set ======
  async function saveSetChanges() {
    if (!sel) return;
    const patch:any = {
      title: editTitle.trim(),
      units: editUnits ? Number(editUnits) : undefined,
      tags: editTags.trim() ? editTags.split(',').map(t=>t.trim()).filter(Boolean) : [],
    };
    if (!patch.title) return alert('El set necesita título.');
    await api.practice.updateSet(sel, patch);
    setMsg('Set actualizado'); setTimeout(()=>setMsg(null), 1200);
    await loadSets();
  }

  // ====== NUEVO: eliminar set ======
  async function deleteSet() {
    if (!sel) return;
    if (!confirm('¿Eliminar este set y todas sus preguntas? Esta acción no se puede deshacer.')) return;
    await api.practice.deleteSet(sel);
    setMsg('Set eliminado'); setTimeout(()=>setMsg(null), 1200);
    await loadSets();
    setQuestions([]);
    setSel('');
  }

  const preview = useMemo(() => {
    const hasImg = media==='image' && !!imageUrl.trim();
    const rawEmbed = media==='embed' ? embedUrl.trim() : '';
    const norm = rawEmbed ? (normalizeEmbedUrl(rawEmbed) || rawEmbed) : '';
    return {
      showImg: hasImg,
      showEmbed: !!norm,
      embedSrc: norm,
      isAudio: rawEmbed ? isAudio(rawEmbed) : false,
    };
  }, [media, imageUrl, embedUrl]);

  return (
    <div style={{ padding:16, maxWidth:1100 }}>
      <h1>Prácticas — Sets y preguntas</h1>

      <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:12, marginTop:8 }}>
        {/* ===== Crear Set ===== */}
        <div style={{ border:'1px solid #e5e7eb', borderRadius:12, padding:12, background:'#fff' }}>
          <div style={{ fontWeight:700, marginBottom:8 }}>Crear Set</div>
          <div style={{ display:'grid', gap:8, gridTemplateColumns:'2fr 1fr 2fr auto' }}>
            <input placeholder="Título (ej. Kids 1 - 2025)" value={title} onChange={e=>setTitle(e.target.value)} />
            <input type="number" placeholder="Unidades" value={units} onChange={e=>setUnits(e.target.value ? Number(e.target.value) : '')} />
            <input placeholder="Tags (coma)" value={tags} onChange={e=>setTags(e.target.value)} />
            <button onClick={createSet}>Crear</button>
          </div>
          {msg && <div style={{ color:'#16a34a', marginTop:6 }}>{msg}</div>}
        </div>

        {/* ===== Seleccionar + editar Set ===== */}
        <div style={{ border:'1px solid #e5e7eb', borderRadius:12, padding:12, background:'#fff' }}>
          <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:8 }}>
            <div style={{ fontWeight:700 }}>Set seleccionado:</div>
            <select value={sel} onChange={e=>setSel(e.target.value)}>
              <option value="" disabled>Elegí un set…</option>
              {sets.map(s=> <option key={s._id} value={s._id}>{s.title}{s.units?` — ${s.units}u`:''}</option>)}
            </select>
          </div>

          {/* Editor de Set */}
          {selSet && (
            <div style={{ border:'1px solid #f1f5f9', borderRadius:12, padding:12, background:'#fafafa', marginBottom:14 }}>
              <div style={{ fontWeight:700, marginBottom:8 }}>Editar Set</div>
              <div style={{ display:'grid', gap:8, gridTemplateColumns:'2fr 1fr 2fr auto' }}>
                <input placeholder="Título" value={editTitle} onChange={e=>setEditTitle(e.target.value)} />
                <input type="number" placeholder="Unidades" value={editUnits} onChange={e=>setEditUnits(e.target.value ? Number(e.target.value) : '')} />
                <input placeholder="Tags (coma)" value={editTags} onChange={e=>setEditTags(e.target.value)} />
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={saveSetChanges}>Guardar</button>
                  <button onClick={deleteSet} style={{ color:'#dc2626' }}>Eliminar</button>
                </div>
              </div>
            </div>
          )}

          {/* Form de Nueva/Editar pregunta */}
          <div style={{ fontWeight:700, marginBottom:8 }}>Nueva pregunta</div>
          <div style={{ display:'grid', gap:10, gridTemplateColumns:'1fr' }}>
            <div style={{ display:'grid', gap:8, gridTemplateColumns:'120px 1fr' }}>
              <label>Unidad</label>
              <input type="number" min={1} placeholder="(opcional)" value={unit}
                     onChange={e=>setUnit(e.target.value ? Number(e.target.value) : '')} />
              <label>Enunciado</label>
              <textarea value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="Escribí el enunciado..." />
              <label>Tipo</label>
              <div>
                <label><input type="radio" checked={type==='MC'} onChange={()=>setType('MC')} /> Múltiple opción</label>{'  '}
                <label><input type="radio" checked={type==='GAP'} onChange={()=>setType('GAP')} /> Completar</label>
              </div>
              <label>Media</label>
              <div>
                <label><input type="radio" checked={media==='none'} onChange={()=>setMedia('none')} /> Sin media</label>{' '}
                <label><input type="radio" checked={media==='image'} onChange={()=>setMedia('image')} /> Imagen (URL)</label>{' '}
                <label><input type="radio" checked={media==='embed'} onChange={()=>setMedia('embed')} /> Embed (URL)</label>
              </div>
              {media==='image' && (<>
                <label>Imagen URL</label>
                <input placeholder="https://..." value={imageUrl} onChange={e=>setImageUrl(e.target.value)} />
              </>)}
              {media==='embed' && (<>
                <label>Embed URL</label>
                <input
                  placeholder="https://... (YouTube/Drive/MP3)"
                  value={embedUrl}
                  onChange={e=>setEmbedUrl(e.target.value)}
                  onBlur={()=> setEmbedUrl(prev => (normalizeEmbedUrl(prev) || prev))}
                />
              </>)}
            </div>

            {type==='MC' && (
              <div>
                <div style={{ fontWeight:700, marginBottom:6 }}>Opciones (mín. 2)</div>
                {options.map((op, i)=>(
                  <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:8, marginBottom:6 }}>
                    <input placeholder={`Opción ${i+1}`} value={op} onChange={e=>setOpt(i, e.target.value)} />
                    <button onClick={()=>setOpt(i, '')}>X</button>
                  </div>
                ))}
                <div style={{ display:'flex', gap:8, marginBottom:8 }}>
                  <button onClick={()=>setOptions(o=>[...o, ''])}>+ opción</button>
                  <button onClick={()=>{
                    const first = options.find(o=>o.trim());
                    if (first) setAnswer(first);
                  }}>Usar 1ra como respuesta</button>
                </div>
              </div>
            )}

            <div style={{ display:'grid', gridTemplateColumns:'120px 1fr', gap:8 }}>
              <label>Respuesta</label>
              <input placeholder="Correcta (texto exacto)" value={answer} onChange={e=>setAnswer(e.target.value)} />
            </div>

            {(preview.showImg || preview.showEmbed) && (
              <div>
                <div style={{ fontWeight:700, marginBottom:6 }}>Preview</div>
                {preview.showImg && <img src={imageUrl} alt="" style={{ maxWidth:'100%', borderRadius:12 }} />}
                {preview.showEmbed && (
                  isAudio(preview.embedSrc)
                    ? <audio controls src={preview.embedSrc} style={{ width:'100%' }} />
                    : <iframe
                        src={preview.embedSrc}
                        title="embed"
                        style={{ width:'100%', height:360, border:'1px solid #e5e7eb', borderRadius:12 }}
                        sandbox="allow-same-origin allow-scripts allow-popups"
                      />
                )}
              </div>
            )}

            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              {!editingQId ? (
                <button onClick={createQuestion} disabled={!sel}>Guardar pregunta</button>
              ) : (
                <>
                  <button onClick={updateQuestion}>Actualizar pregunta</button>
                  <button onClick={()=>{
                    setEditingQId(null);
                    setPrompt(''); setAnswer(''); setOptions(['','','']); setUnit('');
                    setImageUrl(''); setEmbedUrl(''); setMedia('none'); setType('MC');
                  }}>Cancelar</button>
                </>
              )}
              {msg && <span style={{ color:'#16a34a' }}>{msg}</span>}
            </div>
          </div>
        </div>

        {/* ===== Listado de preguntas del set ===== */}
        <div style={{ border:'1px solid #e5e7eb', borderRadius:12, padding:12, background:'#fff' }}>
          <div style={{ fontWeight:700, marginBottom:8 }}>Preguntas del set</div>
          {!sel && <div>Elegí un set para ver sus preguntas.</div>}
          {sel && (loadingQs ? (
            <div>Cargando…</div>
          ) : questions.length === 0 ? (
            <div>No hay preguntas en este set.</div>
          ) : (
            <div style={{ display:'grid', gap:8 }}>
              {questions.map(q=>(
                <div key={q._id} style={{
                  border:'1px solid #e5e7eb', borderRadius:10, padding:10, background:'#fafafa',
                  display:'grid', gridTemplateColumns:'1fr auto', gap:8
                }}>
                  <div>
                    <div style={{ fontWeight:600, marginBottom:4 }}>
                      {q.type==='MC' ? 'MC' : 'GAP'} · {q.unit ? `Unidad ${q.unit}` : 'Sin unidad'}
                    </div>
                    <div style={{ whiteSpace:'pre-wrap' }}>{q.prompt}</div>
                    {Array.isArray(q.options) && q.options.length>0 && (
                      <div style={{ marginTop:6, fontSize:13, opacity:.85 }}>
                        Opciones: {q.options.filter(Boolean).join(' · ')}
                      </div>
                    )}
                    <div style={{ marginTop:4, fontSize:13, opacity:.85 }}>
                      Respuesta: <b>{q.answer}</b>
                    </div>
                    {(q.imageUrl || q.embedUrl) && (
                      <div style={{ marginTop:6, fontSize:12, opacity:.75 }}>
                        {q.imageUrl ? `Imagen: ${q.imageUrl}` : `Embed: ${q.embedUrl}`}
                      </div>
                    )}
                  </div>
                  <div style={{ display:'flex', gap:8, alignItems:'start' }}>
                    <button onClick={()=>startEditQuestion(q)}>Editar</button>
                    <button onClick={()=>removeQuestion(q._id)} style={{ color:'#dc2626' }}>Eliminar</button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

