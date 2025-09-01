// server/src/routes/board.ts
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, allowRoles } from '../middlewares/rbac';
import { BoardPost } from '../models/boardPost';
import { Course } from '../models/course';
import { User } from '../models/user';

const router = Router();

/**
 * GET /api/courses/:id/board?before=&limit=
 * - Accesible para alumno/docente/coord/admin
 * - Paginación por fecha (createdAt) descendente
 */
router.get(
  '/courses/:id/board',
  requireAuth,
  allowRoles('student', 'teacher', 'coordinator', 'admin'),
  async (req: any, res, next) => {
    try {
      const { id } = req.params;

      const q = z
        .object({
          before: z.string().optional(),
          limit: z.coerce.number().int().min(1).max(100).default(30),
        })
        .parse(req.query || {});
      const course = await Course.findById(id).lean();
      if (!course) return res.status(404).json({ error: 'Curso no encontrado' });

      const where: any = { course: id };
      if (q.before) {
        const d = new Date(q.before);
        if (!isNaN(d.getTime())) where.createdAt = { $lt: d };
      }

      const rows = await BoardPost.find(where)
        .sort({ createdAt: -1 })
        .limit(q.limit)
        .populate('author', 'name role photoUrl')
        .lean();

      res.json({ rows });
    } catch (e) {
      next(e);
    }
  }
);

/**
 * POST /api/courses/:id/board
 * - Publicar (docente/coord/admin)
 */
router.post(
  '/courses/:id/board',
  requireAuth,
  allowRoles('teacher', 'coordinator', 'admin'),
  async (req: any, res, next) => {
    try {
      const { id } = req.params;
      const payload = z
        .object({
          title: z.string().trim().max(200).optional(),
          body: z.string().trim().max(5000).optional(),
          links: z
            .array(
              z.object({
                url: z.string().url(),
                meta: z
                  .object({
                    title: z.string().optional(),
                    description: z.string().optional(),
                    image: z.string().url().optional(),
                    provider: z.string().optional(),
                    type: z.string().optional(),
                  })
                  .optional(),
              })
            )
            .max(10)
            .optional(),
        })
        .parse(req.body || {});

      const course = await Course.findById(id).lean();
      if (!course) return res.status(404).json({ error: 'Curso no encontrado' });

      const doc = await BoardPost.create({
        course: id,
        author: req.userId,
        title: payload.title || '',
        body: payload.body || '',
        links: payload.links || [],
      });

      const post = await BoardPost.findById(doc._id)
        .populate('author', 'name role photoUrl')
        .lean();

      res.status(201).json({ ok: true, post });
    } catch (e) {
      next(e);
    }
  }
);

/**
 * DELETE /api/board/:postId
 * - Coord/Admin o autor del post
 */
router.delete(
  '/board/:postId',
  requireAuth,
  allowRoles('teacher', 'coordinator', 'admin'),
  async (req: any, res, next) => {
    try {
      const { postId } = req.params;
      const post = await BoardPost.findById(postId).lean();
      if (!post) return res.status(404).json({ error: 'Post no encontrado' });

      const me = await User.findById(req.userId).lean();
      const isOwner = String(post.author) === String(req.userId);
      const isAdmin = me && (me.role === 'coordinator' || me.role === 'admin');

      if (!isOwner && !isAdmin) return res.status(403).json({ error: 'No autorizado' });

      await BoardPost.deleteOne({ _id: postId });
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
