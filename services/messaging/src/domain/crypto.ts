import crypto from 'node:crypto';
import type { KeyVaultProvider } from '@onebridge/shared';

/** AES-256-GCM ciphertext of a message or note (ADR-0002 style). */
export interface EncryptedText {
  kid: string;
  iv: string;
  tag: string;
  ct: string;
}

/**
 * Encrypts text at rest. `scope` picks the key: the company's tenant key for
 * company conversations, a per-conversation key otherwise. `aad` binds the
 * ciphertext to its record so it cannot be moved to another message.
 */
export async function encryptText(vault: KeyVaultProvider, scope: string, aad: string, text: string): Promise<EncryptedText> {
  const { kid, key } = await vault.getTenantKey(scope);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const ct = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return { kid, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ct: ct.toString('base64') };
}

export async function decryptText(vault: KeyVaultProvider, enc: EncryptedText, aad: string): Promise<string> {
  const key = await vault.getKeyByKid(enc.kid);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(enc.iv, 'base64'));
  decipher.setAAD(Buffer.from(aad, 'utf8'));
  decipher.setAuthTag(Buffer.from(enc.tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(enc.ct, 'base64')), decipher.final()]).toString('utf8');
}
