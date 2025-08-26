import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { requireAuth } from '../middlewares/rbac';

const router = Router();
const dir = path.resolve('uploads/avatars');
fs.mkdirSync(dir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, dir),
  filename: (req:any, file, cb) => {
    const ext = path.extname(file.originalname || '.jpg');
    cb(null, `${req.userId}-${Date.now()}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 400 * 1024 } }); // 400KB

router.post('/uploads/avatar', requireAuth, upload.single('file'), (req:any,res)=>{
  const rel = `/uploads/avatars/${req.file.filename}`;
  res.json({ url: rel });
});

export default router;
