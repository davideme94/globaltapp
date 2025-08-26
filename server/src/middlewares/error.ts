import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    console.error('[zod]', err.flatten());
    return res.status(400).json({ error: 'ValidationError', details: err.flatten() });
  }
  const status = (err as any)?.statusCode ?? 500;
  const message = err instanceof Error ? err.message : 'Unknown error';
  if (err instanceof Error && err.stack) console.error('[error]', message, '\n', err.stack);
  else console.error('[error]', err);
  return res.status(status).json({ error: message });
}
