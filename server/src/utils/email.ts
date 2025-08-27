// server/src/utils/email.ts
export const DEFAULT_EMAIL_DOMAIN =
  process.env.DEFAULT_EMAIL_DOMAIN?.trim() || 'inst.test';

function slugifyName(name: string) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita acentos
    .replace(/[^a-z0-9]+/g, '.')     // espacios/punct -> .
    .replace(/(^\.)|(\.$)/g, '')     // sin punto al inicio/fin
    .slice(0, 32);                    // acota largo
}

export function buildDefaultEmail(name: string) {
  const slug = slugifyName(name || 'user');
  const uniq = Math.random().toString(36).slice(-6);
  return `${slug}.${uniq}@${DEFAULT_EMAIL_DOMAIN}`;
}
