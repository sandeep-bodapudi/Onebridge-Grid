import { GlobalRepository, MongoConnectionHandle } from '@onebridge/shared';
import { EmailCode, IEmailCodeRepository, IKnownDeviceRepository, KnownDevice } from '../../domain/email-code.js';

type Doc<T> = T & { _id?: unknown };

function strip<T>(doc: Doc<T> | null): T | undefined {
  if (!doc) return undefined;
  const { _id, ...rest } = doc;
  void _id;
  return rest as T;
}

/** D-AUTH-EMAIL: `email_codes`, removed by Mongo once `expiresAt` passes. */
export class MongoEmailCodeRepository implements IEmailCodeRepository {
  private repo: GlobalRepository<EmailCode>;

  constructor(handle: MongoConnectionHandle) {
    this.repo = new GlobalRepository<EmailCode>(handle, 'email_codes');
  }

  async ensureIndexes(): Promise<void> {
    await this.repo.createIndex({ ticketHash: 1 }, { unique: true });
    await this.repo.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  }

  async insert(code: EmailCode): Promise<void> {
    await this.repo.insertOne({ ...code });
  }

  async findByTicketHash(ticketHash: string): Promise<EmailCode | undefined> {
    return strip<EmailCode>(await this.repo.findOne({ ticketHash }));
  }

  async update(code: EmailCode): Promise<void> {
    await this.repo.replaceOne({ id: code.id }, { ...code });
  }

  async markConsumed(id: string, at: Date): Promise<boolean> {
    const res = await this.repo.updateOne({ id, consumedAt: { $exists: false } }, { $set: { consumedAt: at } });
    return res.modifiedCount === 1;
  }
}

/** D-AUTH-EMAIL D4: `known_devices`, the devices a person confirmed with an email code. */
export class MongoKnownDeviceRepository implements IKnownDeviceRepository {
  private repo: GlobalRepository<KnownDevice>;

  constructor(handle: MongoConnectionHandle) {
    this.repo = new GlobalRepository<KnownDevice>(handle, 'known_devices');
  }

  async ensureIndexes(): Promise<void> {
    await this.repo.createIndex({ personId: 1, deviceIdHash: 1 }, { unique: true });
  }

  async find(personId: string, deviceIdHash: string): Promise<KnownDevice | undefined> {
    return strip<KnownDevice>(await this.repo.findOne({ personId, deviceIdHash }));
  }

  async upsert(device: KnownDevice): Promise<void> {
    await this.repo.replaceOne({ personId: device.personId, deviceIdHash: device.deviceIdHash }, { ...device }, { upsert: true });
  }
}
