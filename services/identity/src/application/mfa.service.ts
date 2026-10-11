import crypto from 'node:crypto';

export class MfaService {
  private base32Alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

  private toBase32(buffer: Buffer): string {
    let bits = 0;
    let value = 0;
    let output = '';

    for (let i = 0; i < buffer.length; i++) {
      value = (value << 8) | buffer[i];
      bits += 8;

      while (bits >= 5) {
        output += this.base32Alphabet[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }

    if (bits > 0) {
      output += this.base32Alphabet[(value << (5 - bits)) & 31];
    }

    return output;
  }

  private fromBase32(base32: string): Buffer {
    let bits = 0;
    let value = 0;
    const output: number[] = [];

    const cleaned = base32.toUpperCase().replace(/=+$/, '');
    for (let i = 0; i < cleaned.length; i++) {
      const idx = this.base32Alphabet.indexOf(cleaned[i]);
      if (idx === -1) continue;

      value = (value << 5) | idx;
      bits += 5;

      if (bits >= 8) {
        output.push((value >>> (bits - 8)) & 255);
        bits -= 8;
      }
    }

    return Buffer.from(output);
  }

  generateSetup(identifier: string): { secret: string; qrUri: string } {
    const randomBytes = crypto.randomBytes(20);
    const secret = this.toBase32(randomBytes);
    const qrUri = `otpauth://totp/OneBridge:${encodeURIComponent(identifier)}?secret=${secret}&issuer=OneBridge&digits=6&period=30`;
    return { secret, qrUri };
  }

  generateCodeForCounter(secret: string, counter: number): string {
    const key = this.fromBase32(secret);
    const buffer = Buffer.alloc(8);
    buffer.writeBigInt64BE(BigInt(counter));

    const hmac = crypto.createHmac('sha1', key).update(buffer).digest();
    const offset = hmac[hmac.length - 1] & 0xf;
    const code =
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff);

    const otp = code % 1000000;
    return otp.toString().padStart(6, '0');
  }

  generateCurrentCode(secret: string): string {
    const counter = Math.floor(Date.now() / 1000 / 30);
    return this.generateCodeForCounter(secret, counter);
  }

  verifyTotp(secret: string, token: string): boolean {
    if (!token || token.length !== 6) return false;
    const currentCounter = Math.floor(Date.now() / 1000 / 30);

    // Allow window of +/- 1 (tolerance of 30 seconds clock drift)
    for (let offset = -1; offset <= 1; offset++) {
      const generated = this.generateCodeForCounter(secret, currentCounter + offset);
      if (generated === token) {
        return true;
      }
    }
    return false;
  }

  isMfaMandatory(context: { role?: string; plan?: string }): boolean {
    const mandatoryRoles = ['Owner', 'Admin'];
    const mandatoryPlans = ['Business', 'Enterprise'];

    if (context.role && mandatoryRoles.includes(context.role)) {
      if (context.plan && mandatoryPlans.includes(context.plan)) {
        return true;
      }
    }
    return false;
  }
}
