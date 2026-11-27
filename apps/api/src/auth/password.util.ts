import * as argon2 from 'argon2';

/**
 * Hashes a plain-text password using Argon2id.
 */
export async function hashPassword(plainPassword: string): Promise<string> {
  return argon2.hash(plainPassword);
}

/**
 * Verifies a plain-text password against a stored Argon2 hash.
 */
export async function verifyPassword(
  storedHash: string,
  plainPassword: string,
): Promise<boolean> {
  return argon2.verify(storedHash, plainPassword);
}
