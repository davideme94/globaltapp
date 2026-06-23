import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { normalizeEmbedUrl, isAudio } from '../lib/media';

type SetRow = { _id:string; title:string; units?:number; tags?:string[] };

type Item = {
  _id:string; title:string;
  set?:string|null; unit?:number|null;
  imageUrl?:string|null;
  audioUrl?:string|null;
  embedUrl?:string|null;
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
  audioUrl?:string|null;
  embedUrl?:string|null;
  itemId?: string | null;
};

export default function CoordinatorPracticeSets() {
  const [sets, setSets] = useState<SetRow[]>([]);
  const [sel, setSel] = useState<string>('');
  const [msg, setMsg] = useState<string|null>(null);

  // form set
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

  // media directa
  const [media, setMedia] = useState<'none'|'image'|'audio'|'embed'>('none');
  const [imageUrl, setImageUrl] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [embedUrl, setEmbedUrl] = useState('');

  // item reutilizable
  const [itemId, setItemId] = useState<string|undefined>(undefined);
  const [itemPickOpen, setItemPickOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [itemSearch, setItemSearch] = useState('');
  const [itemsLoading, setItemsLoading] = useState(false);
  const [quickItemTitle, setQuickItemTitle] = useState('');
  const [quickItemEmbed, setQuickItemEmbed] = useState('');
  const [quickItemImage, setQuickItemImage] = useState('');
  const [quickItemAudio, setQuickItemAudio] = useState('');

  // listado/edición de preguntas
  const [questions, setQuestions] = useState<Q[]>([]);
  const [loadingQs, setLoadingQs] = useState(false);
  const [editingQId, setEditingQId] = useState<string|null>(null);

  // carga masiva
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
    setTitle('');
    setUnits('');
    setTags('');
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

      imageUrl: media==='image' ? imageUrl.trim() : undefined,
      audioUrl: media==='audio' ? audioUrl.trim() : undefined,
      embedUrl: media==='embed' ? (normalizeEmbedUrl(embedUrl.trim()) || embedUrl.trim()) : undefined,

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

      imageUrl: media==='image' ? imageUrl.trim() : (media==='none' ? '' : undefined),
      audioUrl: media==='audio' ? audioUrl.trim() : (media==='none' ? '' : undefined),
      embedUrl: media==='embed'
        ? (normalizeEmbedUrl(embedUrl.trim()) || embedUrl.trim())
        : (media==='none' ? '' : undefined),

      itemId: itemId === undefined ? undefined : (itemId || null),
    };

    if (!body.prompt) return alert('Falta el enunciado');
    if (!body.answer) return alert('Falta la respuesta');
    if (type==='MC' && (!body.options || body.options.length<2)) return alert('Mínimo 2 opciones en MC');

    await api.practice.updateQuestion(editingQId, body);
    await afterSaveQuestion('Pregunta actualizada');
  }

  async function afterSaveQuestion(okMsg: string) {
    setPrompt('');
    setAnswer('');
    setOptions(['','','']);
    setUnit('');
    setImageUrl('');
    setAudioUrl('');
    setEmbedUrl('');
    setMedia('none');
    setType('MC');
    setItemId(undefined);
    setEditingQId(null);

    flash(okMsg);

    if (sel) await loadQuestionsBySet(sel);
  }

  async function loadQuestionsBySet(setId: string) {
    try {
      setLoadingQs(true);

      const r = await api.practice.listQuestionsBySet(setId);

      const normalized = (r.questions || []).map((q: any) => {
        const rawItem = q.itemId || q.item || null;

        const normalizedItemId =
          rawItem && typeof rawItem === 'object' && rawItem._id
            ? String(rawItem._id)
            : rawItem
              ? String(rawItem)
              : null;

        return {
          ...q,
          itemId: normalizedItemId,
        };
      });

      setQuestions(normalized);
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

    if (q.itemId) {
      setItemId(q.itemId);
      setMedia('none');
      setImageUrl('');
      setAudioUrl('');
      setEmbedUrl('');
    } else {
      setItemId(undefined);

      if (q.imageUrl) {
        setMedia('image');
        setImageUrl(q.imageUrl || '');
        setAudioUrl('');
        setEmbedUrl('');
      } else if (q.audioUrl) {
        setMedia('audio');
        setAudioUrl(q.audioUrl || '');
        setImageUrl('');
        setEmbedUrl('');
      } else if (q.embedUrl) {
        setMedia('embed');
        setEmbedUrl(q.embedUrl || '');
        setImageUrl('');
        setAudioUrl('');
      } else {
        setMedia('none');
        setImageUrl('');
        setAudioUrl('');
        setEmbedUrl('');
      }
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

  // =================== ITEMS ===================
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
    setMedia('none');
    setImageUrl('');
    setAudioUrl('');
    setEmbedUrl('');
    setItemPickOpen(false);
  }

  async function quickCreateItem() {
    const payload:any = {
      title: (quickItemTitle || 'Item sin título').trim(),
      setId: sel || undefined,
      unit: unit ? Number(unit) : undefined,
      imageUrl: quickItemImage.trim() || undefined,
      audioUrl: quickItemAudio.trim() || undefined,
      embedUrl: quickItemEmbed.trim() ? (normalizeEmbedUrl(quickItemEmbed.trim()) || quickItemEmbed.trim()) : undefined,
    };

    const r = await api.practice.itemsCreate(payload);

    setItems(prev => [r.item, ...prev]);

    setQuickItemTitle('');
    setQuickItemImage('');
    setQuickItemAudio('');
    setQuickItemEmbed('');

    selectItem(r.item);
    flash('Item creado y vinculado');
  }

  // =================== BULK ===================
  async function submitBulk() {
    if (!sel) return alert('Elegí un set');
    if (!bulkText.trim()) return;

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
            const [prompt, type, answer, options, embedUrl, imageUrl, audioUrl] = line.split(';').map(s => (s ?? '').trim());

            return {
              prompt,
              type: (type as any) || 'MC',
              answer,
              options: options ? options.split('|').map(o=>o.trim()).filter(Boolean) : undefined,
              embedUrl: embedUrl || undefined,
              imageUrl: imageUrl || undefined,
              audioUrl: audioUrl || undefined,
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
    const it = itemId ? items.find(i => i._id === itemId) : undefined;

    const effImage = it?.imageUrl || imageUrl;
    const effAudio = it?.audioUrl || audioUrl;
    const rawEmbed = it?.embedUrl || embedUrl;
    const norm = rawEmbed ? (normalizeEmbedUrl(rawEmbed) || rawEmbed) : '';

    return {
      hasItem: !!itemId,
      showImg: !!effImage?.trim(),
      imgSrc: effImage?.trim() || '',
      showAudio: !!effAudio?.trim(),
      audioSrc: effAudio?.trim() || '',
      showEmbed: !!norm,
      embedSrc: norm,
      isAudio: rawEmbed ? isAudio(rawEmbed) : false,
    };
  }, [itemId, items, imageUrl, audioUrl, embedUrl]);

  function flash(text: string, ms=1200) {
    setMsg(text);
    setTimeout(()=>setMsg(null), ms);
  }

  // =================== RENDER ===================
  return (
    <div className="practice-admin-inline">
      <style>{`
        .practice-admin-inline {
          max-width: 1180px;
          margin: 0 auto;
          padding: 18px;
          color: #111827;
        }

        .practice-admin-inline * {
          box-sizing: border-box;
        }

        .practice-admin-inline input,
        .practice-admin-inline textarea,
        .practice-admin-inline select {
          width: 100%;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          background: #f8fafc;
          padding: 12px 14px;
          outline: none;
          font: inherit;
          font-size: 15px;
          color: #111827;
          transition: border-color .18s ease, box-shadow .18s ease, background .18s ease;
        }

        .practice-admin-inline textarea {
          min-height: 104px;
          resize: vertical;
        }

        .practice-admin-inline input:focus,
        .practice-admin-inline textarea:focus,
        .practice-admin-inline select:focus {
          border-color: #8b5cf6;
          background: #fff;
          box-shadow: 0 0 0 4px rgba(139, 92, 246, .12);
        }

        .practice-admin-inline label {
          font-size: 14px;
          font-weight: 850;
          color: #374151;
        }

        .practice-admin-inline button {
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          background: #fff;
          color: #111827;
          padding: 11px 15px;
          font: inherit;
          font-size: 14px;
          font-weight: 850;
          cursor: pointer;
          transition: transform .18s ease, box-shadow .18s ease, background .18s ease;
          box-shadow: 0 4px 14px rgba(15, 23, 42, .05);
          white-space: nowrap;
        }

        .practice-admin-inline button:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 10px 24px rgba(15, 23, 42, .10);
          background: #f8fafc;
        }

        .practice-admin-inline button:disabled {
          opacity: .55;
          cursor: not-allowed;
        }

        .pa-hero {
          position: relative;
          overflow: hidden;
          border-radius: 30px;
          padding: 22px;
          background: linear-gradient(135deg, #0ea5e9 0%, #7c3aed 52%, #d946ef 100%);
          color: #fff;
          box-shadow: 0 22px 55px rgba(124, 58, 237, .20);
          margin-bottom: 18px;
        }

        .pa-hero::before,
        .pa-hero::after {
          content: '';
          position: absolute;
          width: 230px;
          height: 230px;
          border-radius: 999px;
          background: rgba(255,255,255,.18);
          filter: blur(12px);
        }

        .pa-hero::before { right: -70px; top: -110px; }
        .pa-hero::after { left: -80px; bottom: -130px; }

        .pa-hero-content {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
        }

        .pa-kicker {
          display: inline-flex;
          width: fit-content;
          align-items: center;
          gap: 8px;
          border-radius: 999px;
          background: rgba(255,255,255,.18);
          border: 1px solid rgba(255,255,255,.25);
          padding: 7px 12px;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: .04em;
          text-transform: uppercase;
          backdrop-filter: blur(10px);
        }

        .pa-title {
          margin: 10px 0 0;
          font-size: clamp(28px, 4vw, 44px);
          line-height: 1;
          font-weight: 950;
          letter-spacing: -0.05em;
        }

        .pa-subtitle {
          margin: 10px 0 0;
          max-width: 700px;
          font-size: 14px;
          line-height: 1.6;
          color: rgba(255,255,255,.86);
        }

        .pa-mascot {
          display: grid;
          place-items: center;
          min-width: 116px;
          height: 116px;
          border-radius: 32px;
          background: rgba(255,255,255,.88);
          border: 1px solid rgba(255,255,255,.65);
          box-shadow: 0 16px 34px rgba(15, 23, 42, .20);
          color: #111827;
          font-size: 64px;
        }

        .pa-shell {
          display: grid;
          gap: 16px;
        }

        .pa-card {
          overflow: hidden;
          border: 1px solid #e5e7eb;
          border-radius: 28px;
          background: rgba(255,255,255,.94);
          box-shadow: 0 14px 35px rgba(15, 23, 42, .06);
        }

        .pa-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 14px;
          padding: 20px 22px 0;
        }

        .pa-card-body {
          padding: 20px 22px 22px;
        }

        .pa-section-title {
          margin: 0;
          font-size: 21px;
          font-weight: 950;
          letter-spacing: -0.04em;
          color: #111827;
        }

        .pa-section-subtitle {
          margin: 5px 0 0;
          font-size: 13px;
          line-height: 1.5;
          color: #6b7280;
        }

        .pa-grid {
          display: grid;
          gap: 12px;
        }

        .pa-grid-create { grid-template-columns: 2fr 1fr 2fr auto; }
        .pa-grid-edit { grid-template-columns: 2fr 1fr 2fr auto; }
        .pa-grid-form { grid-template-columns: 140px 1fr; }
        .pa-grid-quick { grid-template-columns: 1.6fr 1.6fr 1.6fr 1.8fr auto; }
        .pa-grid-search { grid-template-columns: 1fr auto; }
        .pa-grid-answer { grid-template-columns: 140px 1fr; }

        .pa-row {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .pa-spacer { margin-left: auto; }

        .pa-muted-panel {
          border: 1px solid #eef2f7;
          border-radius: 22px;
          background: linear-gradient(180deg, #fafafa, #fff);
          padding: 15px;
        }

        .pa-btn-primary {
          border-color: transparent !important;
          background: linear-gradient(90deg, #0ea5e9 0%, #7c3aed 55%, #d946ef 100%) !important;
          color: white !important;
          box-shadow: 0 12px 26px rgba(124, 58, 237, .20) !important;
        }

        .pa-btn-danger {
          color: #dc2626 !important;
          border-color: #fecdd3 !important;
          background: #fff1f2 !important;
        }

        .pa-btn-soft {
          background: #f8fafc !important;
        }

        .pa-btn-small {
          padding: 8px 12px !important;
          border-radius: 13px !important;
        }

        .pa-radio-group {
          display: flex;
          gap: 10px;
          align-items: center;
          flex-wrap: wrap;
        }

        .pa-radio-pill {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          border: 1px solid #e5e7eb;
          border-radius: 999px;
          background: #fff;
          padding: 8px 11px;
          font-size: 13px;
          font-weight: 850;
          color: #374151;
        }

        .pa-radio-pill input {
          width: auto;
          padding: 0;
        }

        .pa-helper {
          font-size: 13px;
          color: #6b7280;
        }

        .pa-options {
          display: grid;
          gap: 9px;
        }

        .pa-option-row {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 8px;
        }

        .pa-preview {
          border: 1px dashed #c4b5fd;
          border-radius: 24px;
          background: linear-gradient(180deg, #faf5ff 0%, #ffffff 100%);
          padding: 16px;
        }

        .pa-preview-title {
          margin: 0 0 10px;
          font-size: 14px;
          font-weight: 950;
          color: #6d28d9;
        }

        .pa-preview img {
          width: 100%;
          max-height: 420px;
          object-fit: contain;
          border-radius: 18px;
          background: #fff;
        }

        .pa-preview audio { width: 100%; margin-top: 8px; }
        .pa-preview iframe {
          width: 100%;
          height: 360px;
          border: 1px solid #e5e7eb;
          border-radius: 18px;
          margin-top: 8px;
          background: #fff;
        }

        .pa-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          border-radius: 999px;
          padding: 4px 9px;
          font-size: 11px;
          font-weight: 950;
          text-transform: uppercase;
        }

        .pa-badge-item { background: #e0e7ff; color: #4338ca; }
        .pa-badge-img { background: #fee2e2; color: #b91c1c; }
        .pa-badge-audio { background: #dbeafe; color: #1d4ed8; }
        .pa-badge-embed { background: #dcfce7; color: #15803d; }
        .pa-badge-type { background: #f5f3ff; color: #6d28d9; }

        .pa-question-list {
          display: grid;
          gap: 12px;
        }

        .pa-question-item {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 14px;
          border: 1px solid #e5e7eb;
          border-radius: 22px;
          background: #fafafa;
          padding: 15px;
        }

        .pa-question-top {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
          margin-bottom: 8px;
        }

        .pa-question-prompt {
          white-space: pre-wrap;
          color: #111827;
          font-weight: 700;
          line-height: 1.45;
        }

        .pa-question-meta {
          margin-top: 6px;
          font-size: 13px;
          color: #4b5563;
        }

        .pa-question-links {
          margin-top: 8px;
          font-size: 12px;
          color: #6b7280;
          line-height: 1.5;
          word-break: break-all;
        }

        .pa-empty {
          border: 1px dashed #d1d5db;
          border-radius: 24px;
          background: #f9fafb;
          padding: 32px;
          text-align: center;
          color: #6b7280;
          font-weight: 700;
        }

        .pa-flash {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border-radius: 999px;
          background: #ecfdf5;
          border: 1px solid #bbf7d0;
          color: #15803d;
          padding: 7px 12px;
          font-size: 13px;
          font-weight: 900;
        }

        .pa-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 80;
          display: grid;
          place-items: center;
          padding: 18px;
          background: rgba(15, 23, 42, .42);
          backdrop-filter: blur(6px);
        }

        .pa-modal {
          width: min(790px, 96vw);
          max-height: 88vh;
          overflow: auto;
          border-radius: 30px;
          background: #fff;
          box-shadow: 0 25px 60px rgba(15, 23, 42, .25);
          padding: 22px;
        }

        .pa-modal-small { width: min(740px, 96vw); }

        .pa-modal-title {
          margin: 0;
          font-size: 24px;
          font-weight: 950;
          letter-spacing: -0.04em;
          color: #111827;
        }

        .pa-modal-subtitle {
          margin: 6px 0 14px;
          font-size: 13px;
          color: #6b7280;
        }

        .pa-item-list {
          display: grid;
          gap: 9px;
        }

        .pa-item-choice {
          display: grid;
          grid-template-columns: auto 1fr auto;
          gap: 12px;
          align-items: center;
          border: 1px solid #e5e7eb;
          border-radius: 19px;
          background: #fff;
          padding: 13px;
          cursor: pointer;
        }

        .pa-item-choice:hover {
          border-color: #c4b5fd;
          background: #faf5ff;
        }

        .pa-item-choice input {
          width: auto;
        }

        .pa-item-name {
          font-weight: 950;
          color: #111827;
        }

        .pa-item-date,
        .pa-item-links {
          font-size: 12px;
          color: #6b7280;
          line-height: 1.45;
        }

        .pa-code {
          display: inline-block;
          border-radius: 10px;
          background: #f1f5f9;
          padding: 3px 7px;
          font-size: 12px;
        }

        @media (max-width: 900px) {
          .practice-admin-inline { padding: 12px; }
          .pa-hero-content { flex-direction: column; align-items: flex-start; }
          .pa-mascot { width: 100%; min-width: 0; height: 92px; font-size: 48px; }
          .pa-grid-create,
          .pa-grid-edit,
          .pa-grid-form,
          .pa-grid-quick,
          .pa-grid-search,
          .pa-grid-answer,
          .pa-option-row,
          .pa-question-item,
          .pa-item-choice {
            grid-template-columns: 1fr;
          }
          .pa-card-header { flex-direction: column; }
          .pa-spacer { margin-left: 0; }
          .practice-admin-inline button { width: 100%; white-space: normal; }
          .pa-row { align-items: stretch; }
          .pa-radio-group { align-items: stretch; }
          .pa-radio-pill { width: 100%; justify-content: flex-start; }
        }
      `}</style>

      <section className="pa-hero">
        <div className="pa-hero-content">
          <div>
            <div className="pa-kicker">🎮 Practice creator</div>
            <h1 className="pa-title">Prácticas</h1>
            <p className="pa-subtitle">
              Creá sets, items reutilizables y preguntas con imagen, audio o video para que los alumnos practiquen como un juego.
            </p>
          </div>
          <div className="pa-mascot">🐉</div>
        </div>
      </section>

      <div className="pa-shell">
        <section className="pa-card">
          <div className="pa-card-header">
            <div>
              <h2 className="pa-section-title">Crear set</h2>
              <p className="pa-section-subtitle">Un set agrupa preguntas por curso, libro o unidad.</p>
            </div>
            {msg && <span className="pa-flash">✓ {msg}</span>}
          </div>
          <div className="pa-card-body">
            <div className="pa-grid pa-grid-create">
              <input placeholder="Título (ej. Kids 1 - 2025)" value={title} onChange={e=>setTitle(e.target.value)} />
              <input type="number" placeholder="Unidades" value={units} onChange={e=>setUnits(e.target.value ? Number(e.target.value) : '')} />
              <input placeholder="Tags (coma)" value={tags} onChange={e=>setTags(e.target.value)} />
              <button className="pa-btn-primary" onClick={createSet}>Crear</button>
            </div>
          </div>
        </section>

        <section className="pa-card">
          <div className="pa-card-header">
            <div>
              <h2 className="pa-section-title">Set seleccionado</h2>
              <p className="pa-section-subtitle">Elegí el set para editar preguntas y media.</p>
            </div>
            <div className="pa-row">
              <select value={sel} onChange={e=>setSel(e.target.value)}>
                <option value="" disabled>Elegí un set…</option>
                {sets.map(s=> <option key={s._id} value={s._id}>{s.title}{s.units?` — ${s.units}u`:''}</option>)}
              </select>
              <button className="pa-btn-soft" onClick={()=>setBulkOpen(true)} disabled={!sel}>Carga masiva</button>
            </div>
          </div>

          <div className="pa-card-body">
            {selSet && (
              <div className="pa-muted-panel" style={{ marginBottom: 16 }}>
                <div className="pa-row" style={{ marginBottom: 10 }}>
                  <h3 className="pa-section-title" style={{ fontSize: 17 }}>Editar set</h3>
                </div>
                <div className="pa-grid pa-grid-edit">
                  <input placeholder="Título" value={editTitle} onChange={e=>setEditTitle(e.target.value)} />
                  <input type="number" placeholder="Unidades" value={editUnits} onChange={e=>setEditUnits(e.target.value ? Number(e.target.value) : '')} />
                  <input placeholder="Tags (coma)" value={editTags} onChange={e=>setEditTags(e.target.value)} />
                  <div className="pa-row">
                    <button className="pa-btn-primary" onClick={saveSetChanges}>Guardar</button>
                    <button className="pa-btn-danger" onClick={deleteSet}>Eliminar</button>
                  </div>
                </div>
              </div>
            )}

            <div className="pa-card" style={{ boxShadow: 'none', borderRadius: 24 }}>
              <div className="pa-card-header">
                <div>
                  <h2 className="pa-section-title">{editingQId ? 'Editar pregunta' : 'Nueva pregunta'}</h2>
                  <p className="pa-section-subtitle">Escribí la consigna, la respuesta correcta y agregá media si hace falta.</p>
                </div>
              </div>

              <div className="pa-card-body">
                <div className="pa-grid pa-grid-form">
                  <label>Unidad</label>
                  <input
                    type="number"
                    min={1}
                    placeholder="(opcional)"
                    value={unit}
                    onChange={e=>setUnit(e.target.value ? Number(e.target.value) : '')}
                  />

                  <label>Enunciado</label>
                  <textarea value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="Escribí el enunciado..." />

                  <label>Tipo</label>
                  <div className="pa-radio-group">
                    <label className="pa-radio-pill"><input type="radio" checked={type==='MC'} onChange={()=>setType('MC')} /> Múltiple opción</label>
                    <label className="pa-radio-pill"><input type="radio" checked={type==='GAP'} onChange={()=>setType('GAP')} /> Completar</label>
                  </div>

                  <label>Media</label>
                  <div className="pa-radio-group">
                    <button type="button" className="pa-btn-soft" onClick={openItemPicker} disabled={!sel}>
                      {itemId ? 'Cambiar item' : 'Elegir item'}
                    </button>

                    {itemId && <button type="button" className="pa-btn-danger" onClick={()=>setItemId(undefined)}>Quitar item</button>}

                    <span className="pa-helper">o media directa:</span>

                    <label className="pa-radio-pill"><input type="radio" checked={media==='none'} onChange={()=>setMedia('none')} /> Sin media</label>
                    <label className="pa-radio-pill"><input type="radio" checked={media==='image'} onChange={()=>setMedia('image')} /> Imagen</label>
                    <label className="pa-radio-pill"><input type="radio" checked={media==='audio'} onChange={()=>setMedia('audio')} /> Audio</label>
                    <label className="pa-radio-pill"><input type="radio" checked={media==='embed'} onChange={()=>setMedia('embed')} /> Video / Embed</label>
                  </div>

                  {media==='image' && (<>
                    <label>Imagen URL</label>
                    <input placeholder="https://..." value={imageUrl} onChange={e=>setImageUrl(e.target.value)} />
                  </>)}

                  {media==='audio' && (<>
                    <label>Audio URL</label>
                    <input
                      placeholder="https://... MP3 / Drive audio link"
                      value={audioUrl}
                      onChange={e=>setAudioUrl(e.target.value)}
                    />
                  </>)}

                  {media==='embed' && (<>
                    <label>Embed URL</label>
                    <input
                      placeholder="https://... (YouTube/Drive)"
                      value={embedUrl}
                      onChange={e=>setEmbedUrl(e.target.value)}
                      onBlur={()=> setEmbedUrl(prev => (normalizeEmbedUrl(prev) || prev))}
                    />
                  </>)}
                </div>

                {type==='MC' && (
                  <div className="pa-muted-panel" style={{ marginTop: 16 }}>
                    <div className="pa-row" style={{ marginBottom: 10 }}>
                      <h3 className="pa-section-title" style={{ fontSize: 17 }}>Opciones</h3>
                      <span className="pa-helper">mínimo 2 opciones</span>
                    </div>

                    <div className="pa-options">
                      {options.map((op, i)=>(
                        <div key={i} className="pa-option-row">
                          <input placeholder={`Opción ${i+1}`} value={op} onChange={e=>setOpt(i, e.target.value)} />
                          <button className="pa-btn-danger" onClick={()=>setOpt(i, '')}>X</button>
                        </div>
                      ))}
                    </div>

                    <div className="pa-row" style={{ marginTop: 10 }}>
                      <button className="pa-btn-soft" onClick={()=>setOptions(o=>[...o, ''])}>+ opción</button>
                      <button className="pa-btn-soft" onClick={()=>{
                        const first = options.find(o=>o.trim());
                        if (first) setAnswer(first);
                      }}>Usar 1ra como respuesta</button>
                    </div>
                  </div>
                )}

                <div className="pa-grid pa-grid-answer" style={{ marginTop: 16 }}>
                  <label>Respuesta</label>
                  <input placeholder="Correcta (texto exacto)" value={answer} onChange={e=>setAnswer(e.target.value)} />
                </div>

                {(preview.showImg || preview.showAudio || preview.showEmbed) && (
                  <div className="pa-preview" style={{ marginTop: 16 }}>
                    <p className="pa-preview-title">Preview {preview.hasItem ? 'del item' : 'directa'}</p>

                    {preview.showImg && <img src={preview.imgSrc} alt="" />}

                    {preview.showAudio && (
                      <audio controls src={preview.audioSrc} />
                    )}

                    {preview.showEmbed && (
                      preview.isAudio
                        ? <audio controls src={preview.embedSrc} />
                        : <iframe
                            src={preview.embedSrc}
                            title="embed"
                            sandbox="allow-same-origin allow-scripts allow-popups"
                          />
                    )}
                  </div>
                )}

                <div className="pa-row" style={{ marginTop: 18 }}>
                  {!editingQId ? (
                    <>
                      <button className="pa-btn-primary" onClick={createQuestion} disabled={!sel}>Guardar pregunta</button>
                      <button className="pa-btn-soft" onClick={()=>{
                        setPrompt('');
                        setAnswer('');
                        if (type==='MC') setOptions(['','','']);
                      }}>Guardar y nueva (mismo item)</button>
                    </>
                  ) : (
                    <>
                      <button className="pa-btn-primary" onClick={updateQuestion}>Actualizar pregunta</button>
                      <button className="pa-btn-soft" onClick={()=>{
                        setEditingQId(null);
                        flash('Edición cancelada');
                      }}>Cancelar</button>
                      <button className="pa-btn-soft" onClick={duplicateCurrentToForm}>Duplicar en formulario</button>
                    </>
                  )}

                  {msg && <span className="pa-flash">✓ {msg}</span>}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="pa-card">
          <div className="pa-card-header">
            <div>
              <h2 className="pa-section-title">Preguntas del set</h2>
              <p className="pa-section-subtitle">Editá, duplicá o eliminá preguntas ya cargadas.</p>
            </div>
          </div>

          <div className="pa-card-body">
            {!sel && <div className="pa-empty">Elegí un set para ver sus preguntas.</div>}

            {sel && (loadingQs ? (
              <div className="pa-empty">Cargando…</div>
            ) : questions.length === 0 ? (
              <div className="pa-empty">No hay preguntas en este set.</div>
            ) : (
              <div className="pa-question-list">
                {questions.map(q=>(
                  <div key={q._id} className="pa-question-item">
                    <div>
                      <div className="pa-question-top">
                        <span className="pa-badge pa-badge-type">
                          {q.type==='MC' ? 'MC' : 'GAP'} · {q.unit ? `Unidad ${q.unit}` : 'Sin unidad'}
                        </span>

                        {q.itemId && <span className="pa-badge pa-badge-item">Item</span>}
                        {q.imageUrl && <span className="pa-badge pa-badge-img">IMG</span>}
                        {q.audioUrl && <span className="pa-badge pa-badge-audio">Audio</span>}
                        {q.embedUrl && <span className="pa-badge pa-badge-embed">Embed</span>}
                      </div>

                      <div className="pa-question-prompt">{q.prompt}</div>

                      {Array.isArray(q.options) && q.options.length>0 && (
                        <div className="pa-question-meta">
                          Opciones: {q.options.filter(Boolean).join(' · ')}
                        </div>
                      )}

                      <div className="pa-question-meta">
                        Respuesta: <b>{q.answer}</b>
                      </div>

                      {(q.imageUrl || q.audioUrl || q.embedUrl) && (
                        <div className="pa-question-links">
                          {q.imageUrl && <>Imagen: {q.imageUrl}<br /></>}
                          {q.audioUrl && <>Audio: {q.audioUrl}<br /></>}
                          {q.embedUrl && <>Embed: {q.embedUrl}</>}
                        </div>
                      )}
                    </div>

                    <div className="pa-row" style={{ alignItems: 'flex-start' }}>
                      <button className="pa-btn-soft" onClick={()=>startEditQuestion(q)}>Editar</button>
                      <button className="pa-btn-danger" onClick={()=>removeQuestion(q._id)}>Eliminar</button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      </div>

      {itemPickOpen && (
        <div className="pa-modal-overlay">
          <div className="pa-modal">
            <h2 className="pa-modal-title">Elegir / crear item</h2>
            <p className="pa-modal-subtitle">Los items sirven para reutilizar una imagen, audio o video en muchas preguntas.</p>

            <div className="pa-grid pa-grid-search" style={{ marginBottom: 12 }}>
              <input placeholder="Buscar en items" value={itemSearch} onChange={e=>setItemSearch(e.target.value)} />
              <button className="pa-btn-primary" onClick={loadItems}>Buscar</button>
            </div>

            <div className="pa-muted-panel" style={{ marginBottom: 14 }}>
              <h3 className="pa-section-title" style={{ fontSize: 17, marginBottom: 10 }}>Crear rápido</h3>
              <div className="pa-grid pa-grid-quick">
                <input placeholder="Título" value={quickItemTitle} onChange={e=>setQuickItemTitle(e.target.value)} />
                <input placeholder="Imagen (URL)" value={quickItemImage} onChange={e=>setQuickItemImage(e.target.value)} />
                <input placeholder="Audio (URL)" value={quickItemAudio} onChange={e=>setQuickItemAudio(e.target.value)} />
                <input placeholder="Video / Embed" value={quickItemEmbed} onChange={e=>setQuickItemEmbed(e.target.value)} />
                <button className="pa-btn-primary" onClick={quickCreateItem} disabled={!sel}>Crear y usar</button>
              </div>
            </div>

            <p className="pa-section-subtitle" style={{ marginBottom: 10 }}>Resultados</p>

            {itemsLoading ? (
              <div className="pa-empty">Cargando…</div>
            ) : items.length===0 ? (
              <div className="pa-empty">No hay items para mostrar.</div>
            ) : (
              <div className="pa-item-list">
                {items.map(it=>(
                  <label key={it._id} className="pa-item-choice">
                    <input
                      type="radio"
                      name="pickItem"
                      checked={itemId===it._id}
                      onChange={()=>setItemId(it._id)}
                    />

                    <div>
                      <div className="pa-item-name">{it.title}</div>
                      <div className="pa-item-date">
                        {it.unit ? `Unidad ${it.unit} · `: ''}{new Date(it.updatedAt).toLocaleString()}
                      </div>

                      {(it.imageUrl || it.audioUrl || it.embedUrl) && (
                        <div className="pa-item-links">
                          {it.imageUrl && <>IMG: {it.imageUrl}<br /></>}
                          {it.audioUrl && <>AUDIO: {it.audioUrl}<br /></>}
                          {it.embedUrl && <>EMBED: {it.embedUrl}</>}
                        </div>
                      )}
                    </div>

                    <button type="button" className="pa-btn-primary" onClick={()=>selectItem(it)}>Usar</button>
                  </label>
                ))}
              </div>
            )}

            <div className="pa-row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="pa-btn-soft" onClick={()=>setItemPickOpen(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {bulkOpen && (
        <div className="pa-modal-overlay">
          <div className="pa-modal pa-modal-small">
            <h2 className="pa-modal-title">Carga masiva</h2>
            <p className="pa-modal-subtitle">
              Pegá JSON array o CSV simple con campos:<br />
              <code className="pa-code">prompt;type;answer;options(separadas por |);embedUrl;imageUrl;audioUrl</code>
            </p>

            <textarea
              placeholder='[
  {"prompt":"Q1","type":"MC","answer":"A","options":["A","B"],"embedUrl":"https://youtube.com/watch?v=..."},
  {"prompt":"Q2","type":"GAP","answer":"are","audioUrl":"https://..."}
]'
              value={bulkText}
              onChange={e=>setBulkText(e.target.value)}
              style={{ minHeight: 250 }}
            />

            <div className="pa-row" style={{ justifyContent: 'flex-end', marginTop: 14 }}>
              <button className="pa-btn-soft" onClick={()=>setBulkOpen(false)}>Cancelar</button>
              <button className="pa-btn-primary" onClick={submitBulk} disabled={!sel}>Subir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
