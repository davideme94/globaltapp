import { Router } from 'express';
import pkg from '../../package.json'; // gracias a resolveJsonModule

const router = Router();

router.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'globalt-server',
    version: (pkg as any).version ?? 'dev',
    timestamp: new Date().toISOString()
  });
});

export default router;
