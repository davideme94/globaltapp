import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

const candidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '.env.local'),
  path.resolve(__dirname, '../.env'),
  path.resolve(__dirname, '../.env.local')
];
for (const p of candidates) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    break;
  }
}

function num(v: string | undefined, def: number) {
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) ? n : def;
}

const rawOrigins =
  process.env.CLIENT_ORIGINS ??
  process.env.CLIENT_ORIGIN ?? // compatibilidad con tu .env viejo
  'http://localhost:5173,http://127.0.0.1:5173';

export const CLIENT_ORIGINS = rawOrigins
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: num(process.env.PORT, 4000),
  HOST: process.env.HOST ?? '0.0.0.0', // <- importante para Render/Railway
  CLIENT_ORIGINS,
  JWT_SECRET: process.env.JWT_SECRET ?? 'change-me',
  MONGODB_URI: process.env.MONGODB_URI ?? ''
};

export default env;
