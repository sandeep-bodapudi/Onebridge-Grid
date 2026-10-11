import crypto from 'node:crypto';

export class KeyService {
  private key: Buffer;

  constructor(secretKeyHex?: string) {
    if (secretKeyHex) {
      this.key = Buffer.from(secretKeyHex, 'hex');
      if (this.key.length !== 32) {
        // Derive 32 bytes via sha256 if not 32 bytes
        this.key = crypto.createHash('sha256').update(secretKeyHex).digest();
      }
    } else {
      // Default fallback for dev/test environment
      this.key = crypto.createHash('sha256').update('onebridge-default-encryption-key-for-dev').digest();
    }
  }

  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  decrypt(ciphertext: string): string {
    const parts = ciphertext.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid ciphertext format. Expected iv:authTag:content');
    }
    const [ivHex, authTagHex, contentHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(contentHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}
