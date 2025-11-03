// server/src/routes/practice-items.ts
import { Router } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { requireAuth, allowRoles } from '../middlewares/rbac';
import { PracticeItem, PracticeQuestion } from '../models/practice';

const router = Router();

/* ===== Helpers de media (YouTube/Drive) ===== */
function toYouTubeEmbed(u?: string | null) {
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
      if (parts[0] && parts[1] && (parts[0] === 'shorts' || parts[0] === 'live')) {
        return `https://www.youtube-nocookie.com/embed/${parts[1]}`;
      }
    }
  } catch {}
  return u || undefined;
}

function toDrivePreview(u?: string | null) {
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

function normalizeEmbedUrl(u?: string | null) {
  if (!u) return undefined;
  return toDrivePreview(toYouTubeEmbed(u));
}

/* ========================= Schemas ========================= */
const itemCreateSchema = z.object({
  title: z.string().min(3),
  setId: z.string().optional(),
  unit: z.number().int().min(1).max(99).optional(),
  imageUrl: z.string().url().optional(),
  embedUrl: z.string().url().optional(),
});

const itemPatchSchema = itemCreateSchema.partial();

/* ========================= LIST ========================= */
// GET /practice/items?setId=&search=
router.get(
  '/practice/items',
  requireAuth,
  allowRoles('coordinator', 'admin', 'teacher'),
  async (req, res, next) => {
    try {
      const { setId, search } = req.query as { setId?: string; search?: string };

      const filter: any = {};
      if (setId) filter.set = new mongoose.Types.ObjectId(setId);
      if (search && search.trim()) {
        filter.title = { $regex: search.trim(), $options: 'i' };
      }

      const rows = await PracticeItem
        .find(filter)
        .sort({ updatedAt: -1 })
        .limit(500)
        .lean();

      res.json({ rows });
    } catch (e) { next(e); }
  }
);

/* ========================= CREATE ========================= */
// POST /practice/items
router.post(
  '/practice/items',
  requireAuth,
  allowRoles('coordinator', 'admin', 'teacher'),
  async (req, res, next) => {
    try {
      const b = itemCreateSchema.parse(req.body);
      const uid = (req as any).userId as string;

      const payload: any = {
        title: b.title,
        createdBy: uid,
      };
      if (b.setId)  payload.set  = b.setId;
      if (b.unit)   payload.unit = b.unit;
      if (b.imageUrl) payload.imageUrl = b.imageUrl;
      if (b.embedUrl) payload.embedUrl = normalizeEmbedUrl(b.embedUrl);

      const item = await PracticeItem.create(payload);
      res.json({ ok: true, item });
    } catch (e) { next(e); }
  }
);

/* ========================= UPDATE ========================= */
// PUT /practice/items/:id
router.put(
  '/practice/items/:id',
  requireAuth,
  allowRoles('coordinator', 'admin', 'teacher'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const p = itemPatchSchema.parse(req.body);

      const toSet: any = {};
      if (p.title     !== undefined) toSet.title     = p.title;
      if (p.setId     !== undefined) toSet.set       = p.setId || null;
      if (p.unit      !== undefined) toSet.unit      = p.unit;
      if (p.imageUrl  !== undefined) toSet.imageUrl  = p.imageUrl || null;
      if (p.embedUrl  !== undefined) toSet.embedUrl  = normalizeEmbedUrl(p.embedUrl) || null;

      const item = await PracticeItem.findByIdAndUpdate(id, { $set: toSet }, { new: true }).lean();
      if (!item) return res.status(404).json({ error: 'Item no encontrado' });

      res.json({ ok: true, item });
    } catch (e) { next(e); }
  }
);

/* ========================= DELETE ========================= */
// DELETE /practice/items/:id
// Al borrar un item, limpiamos la referencia desde las preguntas (item -> null).
router.delete(
  '/practice/items/:id',
  requireAuth,
  allowRoles('coordinator', 'admin', 'teacher'),
  async (req, res, next) => {
    try {
      const { id } = req.params;

      // 1) Quitar referencia en preguntas
      await PracticeQuestion.updateMany(
        { item: new mongoose.Types.ObjectId(id) as any },
        { $unset: { item: 1 } }
      );

      // 2) Eliminar item
      await PracticeItem.deleteOne({ _id: id });

      res.json({ ok: true });
    } catch (e) { next(e); }
  }
);

export default router;
