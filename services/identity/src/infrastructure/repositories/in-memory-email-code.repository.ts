import { EmailCode, IEmailCodeRepository, IKnownDeviceRepository, KnownDevice } from '../../domain/email-code.js';

export class InMemoryEmailCodeRepository implements IEmailCodeRepository {
  readonly codes = new Map<string, EmailCode>();

  async insert(code: EmailCode): Promise<void> {
    this.codes.set(code.ticketHash, { ...code });
  }

  async findByTicketHash(ticketHash: string): Promise<EmailCode | undefined> {
    const code = this.codes.get(ticketHash);
    return code ? { ...code } : undefined;
  }

  async update(code: EmailCode): Promise<void> {
    this.codes.set(code.ticketHash, { ...code });
  }
}

export class InMemoryKnownDeviceRepository implements IKnownDeviceRepository {
  readonly devices = new Map<string, KnownDevice>();

  async find(personId: string, deviceIdHash: string): Promise<KnownDevice | undefined> {
    const device = this.devices.get(`${personId}|${deviceIdHash}`);
    return device ? { ...device } : undefined;
  }

  async upsert(device: KnownDevice): Promise<void> {
    this.devices.set(`${device.personId}|${device.deviceIdHash}`, { ...device });
  }
}
