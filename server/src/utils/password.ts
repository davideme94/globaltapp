import * as bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

/**
 * Genera un hash para la contraseña en texto plano.
 */
export async function hashPassword(plain: string): Promise<string> {
  if (typeof plain !== 'string' || plain.length === 0) {
    throw new Error('plain password is required');
  }
  return bcrypt.hash(plain, SALT_ROUNDS);
}

/**
 * Compara una contraseña en texto plano contra su hash.
 * Devuelve true si coincide, false si no.
 */
export async function comparePassword(plain: string, hash: string): Promise<boolean> {
  if (!plain || !hash) return false;
  return bcrypt.compare(plain, hash);
}
