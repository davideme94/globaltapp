import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { normalizeEmbedUrl, isAudio } from '../lib/media';

type SetRow = { _id:string; title:string; units?:number; tags?:string[] };
type Item = {
  _id:string; title:string;
  set?:string|null; unit?:number|null;
  imageUrl?:string|null; embedUrl?:string|null;
  updatedAt:string;
};
type Q = {
  _id:string; set?:string;
  unit?: number|null;
  prompt:string;
  type:'MC'|'GAP';
  options?: string[]|null;
  answer:string;
  imageUrl?:string|null;
  embedUrl?:string|null;
  // NUEVO: referencia a Item reutilizable
  itemId?: string | null;
};

export default function CoordinatorPracticeSets() {
  const [sets, setSets] = useState<SetRow[]>([]);
  const [sel, setSel] = useState<string>('');
  const [msg, setMsg] = useState<string|null>(null);

  // form set (crear)
  const [title, setTitle] = useState('');
  const [units, setUnits] = useState<number|''>('');
  const [tags, setTags] = useState('');

  // editar set
  const selSet = useMemo(() => sets.find(s => s._id === sel) || null, [sets, sel]);
  const [editTitle, setEditTitle] = useState('');
  const [editUnits, setEditUnits] = useState<number|''>('');
  const [editTags, setEditTags] = useState('');

  // form pregunta
  const [unit, setUnit] = useState<number|''>('');
  const [prompt, setPrompt] = useState('');
  const [type, setType] = useState<'MC'|'GAP'>('MC');
  const [options, setOptions] = useState<string[]>(['', '', '']);
  const [answer, setAnswer] = useState('');

  // media directa (opcional si no uso itemId)
  const [media, setMedia] = useState<'none'|'image'|'embed'>('none');
  const [imageUrl, setImageUrl] = useState('');
  const [embedUrl, setEmbedUrl] = useState('');

  // NUEVO: item reutilizable
  const [itemId, setItemId] = useState<string|undefined>(undefined);
  const [itemPickOpen, setItemPickOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [itemSearch, setItemSearch] = useState('');
  const [itemsLoading, setItemsLoading] = useState(false);
  const [quickItemTitle, setQuickItemTitle] = useState('');
  const [quickItemEmbed, setQuickItemEmbed] = useState('');
  const [quickItemImage, setQuickItemImage] = useState('');

  // listado/edición de preguntas
  const [questions, setQuestions] = useState<Q[]>([]);
  const [loadingQs, setLoadingQs] = useState(false);
  const [editingQId, setEditingQId] = useState<string|null>(null);

  // Carga masiva (modal simple)
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');

  async function loadSets() {
    const r = await api.practice.listSets();
    setSets(r.rows);
    if (!sel && r.rows[0]) setSel(r.rows[0]._id);
  }
  useEffect(()=>{ loadSets(); }, []);

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

  // =================== SETS ===================
  async function createSet() {
    const payload:any = { title: title.trim() };
    if (units) payload.units = Number(units);
    if (tags.trim()) payload.tags = tags.split(',').map((t:string)=>t.trim()).filter(Boolean);
    if (!payload.title) return alert('Título requerido');
    await api.practice.createSet(payload);
    setTitle(''); setUnits(''); setTags('');
    flash('Set creado');
    await loadSets();
  }

  async function saveSetChanges() {
    if (!sel) return;
    const patch:any = {
      title: editTitle.trim(),
      units: editUnits ? Number(editUnits) : undefined,
      tags: editTags.trim() ? editTags.split(',').map(t=>t.trim()).filter(Boolean) : [],
    };
    if (!patch.title) return alert('El set necesita título.');
    await api.practice.updateSet(sel, patch);
    flash('Set actualizado');
    await loadSets();
  }

  async function deleteSet() {
    if (!sel) return;
    if (!confirm('¿Eliminar este set y todas sus preguntas? Esta acción no se puede deshacer.')) return;
    await api.practice.deleteSet(sel);
    flash('Set eliminado');
    await loadSets();
    setQuestions([]);
    setSel('');
  }

  // =================== PREGUNTAS ===================
  async function createQuestion() {
    if (!sel) return alert('Elegí un Set');

    const body:any = {
      setId: sel,
      unit: unit ? Number(unit) : undefined,
      prompt: prompt.trim(),
      type,
      options: type==='MC' ? options.filter(Boolean) : undefined,
      answer: answer.trim(),
      // media directa (opcional)
      imageUrl: media==='image' ? imageUrl.trim() : undefined,
      embedUrl: media==='embed' ? (normalizeEmbedUrl(embedUrl.trim()) || embedUrl.trim()) : undefined,
      // NUEVO: itemId (tiene prioridad si lo enviás)
      itemId: itemId || undefined,
    };

    if (!body.prompt) return alert('Falta el enunciado');
    if (!body.answer) return alert('Falta la respuesta');
    if (type==='MC' && (!body.options || body.options.length<2)) return alert('Mínimo 2 opciones en MC');

    await api.practice.createQuestion(body);
    await afterSaveQuestion('Pregunta creada');
  }

  async function updateQuestion() {
    if (!editingQId) return;

    const body:any = {
      unit: unit ? Number(unit) : undefined,
      prompt: prompt.trim(),
      type,
      options: type==='MC' ? options.filter(Boolean) : undefined,
      answer: answer.trim(),
      // media directa
      imageUrl: media==='image' ? imageUrl.trim() : (media==='none' ? '' : undefined),
      embedUrl: media==='embed'
        ? (normalizeEmbedUrl(embedUrl.trim()) || embedUrl.trim())
        : (media==='none' ? '' : undefined),
      // NUEVO: itemId (null para desvincular)
      itemId: itemId === undefined ? undefined : (itemId || null),
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
    setItemId(undefined);
    setEditingQId(null);
    flash(okMsg);
    if (sel) await loadQuestionsBySet(sel);
  }

  async function loadQuestionsBySet(setId: string) {
    try {
      setLoadingQs(true);
      const r = await api.practice.listQuestionsBySet(setId);
      setQuestions(r.questions || []);
    } finally {
      setLoadingQs(false);
    }
  }

  function startEditQuestion(q: Q) {
    setEditingQId(q._id);
    setUnit(typeof q.unit==='number' ? q.unit : '');
    setPrompt(q.prompt || '');
    setType(q.type);
    setOptions(Array.isArray(q.options) ? (q.options.length ? q.options : ['','','']) : ['','','']);
    setAnswer(q.answer || '');
    // prioridad: si tiene itemId, limpiamos media directa
    if (q.itemId) {
      setItemId(q.itemId);
      setMedia('none'); setImageUrl(''); setEmbedUrl('');
    } else {
      setItemId(undefined);
      if (q.imageUrl) { setMedia('image'); setImageUrl(q.imageUrl || ''); setEmbedUrl(''); }
      else if (q.embedUrl) { setMedia('embed'); setEmbedUrl(q.embedUrl || ''); setImageUrl(''); }
      else { setMedia('none'); setImageUrl(''); setEmbedUrl(''); }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function removeQuestion(id: string) {
    if (!confirm('¿Eliminar esta pregunta?')) return;
    setQuestions(qs => qs.filter(q => q._id !== id));
    try {
      await api.practice.deleteQuestion(id);
      flash('Pregunta eliminada');
    } catch (e) {
      flash('Eliminada localmente (verificando)', 1500);
      try { if (sel) await loadQuestionsBySet(sel); } catch {}
    }
  }

  function duplicateCurrentToForm() {
    setEditingQId(null);
    flash('Copiá, editá y guardá como nueva', 1200);
  }

  // =================== ITEMS (Picker) ===================
  async function loadItems() {
    setItemsLoading(true);
    try {
      const r = await api.practice.itemsList({ setId: sel || undefined, search: itemSearch || undefined });
      setItems(r.rows || []);
    } finally {
      setItemsLoading(false);
    }
  }

  function openItemPicker() {
    setItemPickOpen(true);
    loadItems();
  }

  function selectItem(it: Item) {
    setItemId(it._id);
    // limpiar media directa
    setMedia('none'); setImageUrl(''); setEmbedUrl('');
    setItemPickOpen(false);
  }

  async function quickCreateItem() {
    const payload:any = {
      title: (quickItemTitle || 'Item sin título').trim(),
      setId: sel || undefined,
      unit: unit ? Number(unit) : undefined,
      imageUrl: quickItemImage.trim() || undefined,
      embedUrl: quickItemEmbed.trim() ? (normalizeEmbedUrl(quickItemEmbed.trim()) || quickItemEmbed.trim()) : undefined,
    };
    const r = await api.practice.itemsCreate(payload);
    setQuickItemTitle(''); setQuickItemImage(''); setQuickItemEmbed('');
    selectItem(r.item);
    flash('Item creado y vinculado');
  }

  // =================== BULK ===================
  async function submitBulk() {
    if (!sel) return alert('Elegí un set');
    if (!bulkText.trim()) return;
    // Soporta CSV simple "prompt;type;answer;option1|option2;embedUrl;imageUrl"
    // o JSON [{ prompt, type, answer, options, embedUrl, imageUrl }]
    let rows: any[] = [];
    try {
      if (bulkText.trim().startsWith('[')) {
        rows = JSON.parse(bulkText.trim());
      } else {
        rows = bulkText
          .split('\n')
          .map(l => l.trim())
          .filter(Boolean)
          .map(line => {
            const [prompt, type, answer, options, embedUrl, imageUrl] = line.split(';').map(s => (s ?? '').trim());
            return {
              prompt, type: (type as any) || 'MC', answer,
              options: options ? options.split('|').map(o=>o.trim()).filter(Boolean) : undefined,
              embedUrl: embedUrl || undefined,
              imageUrl: imageUrl || undefined,
            };
          });
      }
    } catch (e) {
      return alert('Formato inválido (JSON o CSV simple).');
    }

    await api.practice.questionsBulk({
      setId: sel,
      unit: unit ? Number(unit) : undefined,
      rows
    });

    setBulkText('');
    setBulkOpen(false);
    flash('Preguntas cargadas');
    await loadQuestionsBySet(sel);
  }

  // =================== UI helpers ===================
  const preview = useMemo(() => {
    // si hay itemId seleccionado, buscamos el item para mostrar su media
    const it = itemId ? items.find(i => i._id === itemId) : undefined;
    const effImage = it?.imageUrl || imageUrl;
    const rawEmbed = it?.embedUrl || embedUrl;
    const norm = rawEmbed ? (normalizeEmbedUrl(rawEmbed) || rawEmbed) : '';
    return {
      hasItem: !!itemId,
      showImg: !!effImage?.trim(),
      imgSrc: effImage?.trim() || '',
      showEmbed: !!norm,
      embedSrc: norm,
      isAudio: rawEmbed ? isAudio(rawEmbed) : false,
    };
  }, [itemId, items, imageUrl, embedUrl]);

  function flash(text: string, ms=1200) {
    setMsg(text); setTimeout(()=>setMsg(null), ms);
  }

  // =================== RENDER ===================
  return (
    <div style={{ padding:16, maxWidth:1200, margin:'0 auto' }}>
      <h1>Prácticas — Sets, Items y preguntas</h1>

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
          <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:8, flexWrap:'wrap' }}>
            <div style={{ fontWeight:700 }}>Set seleccionado:</div>
            <select value={sel} onChange={e=>setSel(e.target.value)}>
              <option value="" disabled>Elegí un set…</option>
              {sets.map(s=> <option key={s._id} value={s._id}>{s.title}{s.units?` — ${s.units}u`:''}</option>)}
            </select>

            <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
              <button onClick={()=>setBulkOpen(true)} disabled={!sel}>Carga masiva</button>
            </div>
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
          <div style={{ fontWeight:700, marginBottom:8 }}>{editingQId ? 'Editar pregunta' : 'Nueva pregunta'}</div>
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

              {/* VINCULAR ITEM */}
              <label>Media</label>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                <button type="button" onClick={openItemPicker} disabled={!sel}>
                  {itemId ? 'Cambiar item' : 'Elegir item'}
                </button>
                {itemId && <button type="button" onClick={()=>setItemId(undefined)}>Quitar item</button>}

                <span style={{ opacity:.6 }}>o media directa:</span>
                <label><input type="radio" checked={media==='none'} onChange={()=>setMedia('none')} /> Sin media</label>
                <label><input type="radio" checked={media==='image'} onChange={()=>setMedia('image')} /> Imagen (URL)</label>
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
                <div style={{ display:'flex', gap:8, marginBottom:8, flexWrap:'wrap' }}>
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
                <div style={{ fontWeight:700, marginBottom:6 }}>
                  Preview {preview.hasItem ? 'del item' : 'directa'}
                </div>
                {preview.showImg && <img src={preview.imgSrc} alt="" style={{ maxWidth:'100%', borderRadius:12 }} />}
                {preview.showEmbed && (
                  preview.isAudio
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

            <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
              {!editingQId ? (
                <>
                  <button onClick={createQuestion} disabled={!sel}>Guardar pregunta</button>
                  <button onClick={()=>{
                    // flujo rápido para crear varias sobre el mismo item/media
                    setPrompt(''); setAnswer('');
                    if (type==='MC') setOptions(['','','']);
                  }}>Guardar y nueva (mismo item)</button>
                </>
              ) : (
                <>
                  <button onClick={updateQuestion}>Actualizar pregunta</button>
                  <button onClick={()=>{
                    setEditingQId(null);
                    flash('Edición cancelada');
                  }}>Cancelar</button>
                  <button onClick={duplicateCurrentToForm}>Duplicar en formulario</button>
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
                    <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:4, flexWrap:'wrap' }}>
                      <span style={{ fontWeight:600 }}>
                        {q.type==='MC' ? 'MC' : 'GAP'} · {q.unit ? `Unidad ${q.unit}` : 'Sin unidad'}
                      </span>
                      {q.itemId && <span style={{ fontSize:12, background:'#e0e7ff', padding:'2px 6px', borderRadius:999 }}>Item</span>}
                      {q.imageUrl && <span style={{ fontSize:12, background:'#fee2e2', padding:'2px 6px', borderRadius:999 }}>IMG</span>}
                      {q.embedUrl && <span style={{ fontSize:12, background:'#dcfce7', padding:'2px 6px', borderRadius:999 }}>EMBED</span>}
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

      {/* ===== Modal Items (Picker) ===== */}
      {itemPickOpen && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.35)', display:'grid', placeItems:'center', zIndex:50 }}>
          <div style={{ background:'#fff', borderRadius:12, padding:16, width:720, maxWidth:'94vw', maxHeight:'88vh', overflow:'auto' }}>
            <div style={{ fontWeight:700, marginBottom:8 }}>Elegir / crear Item</div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:8, alignItems:'center', marginBottom:10 }}>
              <input placeholder="Buscar en items (título o filtra por set actual)" value={itemSearch} onChange={e=>setItemSearch(e.target.value)} />
              <button onClick={loadItems}>Buscar</button>
            </div>

            <div style={{ border:'1px solid #f1f5f9', borderRadius:10, padding:10, background:'#fafafa', marginBottom:12 }}>
              <div style={{ fontWeight:600, marginBottom:6 }}>Crear rápido</div>
              <div style={{ display:'grid', gridTemplateColumns:'2fr 2fr 2fr auto', gap:8 }}>
                <input placeholder="Título" value={quickItemTitle} onChange={e=>setQuickItemTitle(e.target.value)} />
                <input placeholder="Embed (YouTube/Drive/MP3)" value={quickItemEmbed} onChange={e=>setQuickItemEmbed(e.target.value)} />
                <input placeholder="Imagen (URL)" value={quickItemImage} onChange={e=>setQuickItemImage(e.target.value)} />
                <button onClick={quickCreateItem} disabled={!sel}>Crear y usar</button>
              </div>
            </div>

            <div style={{ marginBottom:10, opacity:.7 }}>Resultados</div>
            {itemsLoading ? (
              <div>Cargando…</div>
            ) : items.length===0 ? (
              <div>No hay items para mostrar.</div>
            ) : (
              <div style={{ display:'grid', gap:8 }}>
                {items.map(it=>(
                  <label key={it._id} style={{
                    display:'grid', gridTemplateColumns:'auto 1fr auto', gap:10,
                    border:'1px solid #e5e7eb', borderRadius:10, padding:10, alignItems:'center'
                  }}>
                    <input
                      type="radio"
                      name="pickItem"
                      checked={itemId===it._id}
                      onChange={()=>setItemId(it._id)}
                    />
                    <div>
                      <div style={{ fontWeight:600 }}>{it.title}</div>
                      <div style={{ fontSize:12, opacity:.75 }}>
                        {it.unit ? `Unidad ${it.unit} · `: ''}{new Date(it.updatedAt).toLocaleString()}
                      </div>
                      {(it.imageUrl || it.embedUrl) && (
                        <div style={{ marginTop:6, fontSize:12, opacity:.85 }}>
                          {it.imageUrl ? `IMG: ${it.imageUrl}` : `EMBED: ${it.embedUrl}`}
                        </div>
                      )}
                    </div>
                    <button onClick={()=>selectItem(it)}>Usar</button>
                  </label>
                ))}
              </div>
            )}

            <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:14 }}>
              <button onClick={()=>setItemPickOpen(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Modal Carga Masiva ===== */}
      {bulkOpen && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.35)', display:'grid', placeItems:'center', zIndex:50 }}>
          <div style={{ background:'#fff', borderRadius:12, padding:16, width:720, maxWidth:'94vw', maxHeight:'88vh', overflow:'auto' }}>
            <div style={{ fontWeight:700, marginBottom:8 }}>Carga masiva</div>
            <div style={{ fontSize:13, opacity:.8, marginBottom:10 }}>
              Pegá JSON (array) o CSV simple con campos:<br/>
              <code>prompt;type;answer;options(separadas por |);embedUrl;imageUrl</code>
            </div>
            <textarea
              placeholder='[
  {"prompt":"Q1","type":"MC","answer":"A","options":["A","B"],"embedUrl":"https://youtube.com/watch?v=..."},
  {"prompt":"Q2","type":"GAP","answer":"are"}
]'
              value={bulkText}
              onChange={e=>setBulkText(e.target.value)}
              style={{ width:'100%', minHeight:240 }}
            />
            <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:12 }}>
              <button onClick={()=>setBulkOpen(false)}>Cancelar</button>
              <button onClick={submitBulk} disabled={!sel}>Subir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


