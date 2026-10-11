import { Db, GlobalRepository } from '@onebridge/shared';
import { Person } from '../../domain/person.js';
import { KeyService } from '../../application/key.service.js';

interface MongoPersonDoc {
  userId: string;
  phone?: string;
  email?: string;
  name?: string;
  authProviders?: string[];
  mfa?: {
    enabled: boolean;
    secret?: string; // Encrypted at rest via KeyService
  };
  roles?: { tenantId: string; role: 'Owner' | 'Admin' | 'Member'; plan: string }[];
  createdAt: string;
  updatedAt: string;
}

export class MongoPersonRepository {
  private repo: GlobalRepository<MongoPersonDoc>;

  constructor(
    db: Db,
    private keyService: KeyService
  ) {
    this.repo = new GlobalRepository<MongoPersonDoc>(db, 'persons');
  }

  private toDomain(doc: MongoPersonDoc): Person {
    const person: Person = {
      userId: doc.userId,
      phone: doc.phone,
      email: doc.email,
      name: doc.name,
      authProviders: (doc.authProviders as any) || [],
      mfa: {
        enabled: doc.mfa?.enabled || false,
        secret: doc.mfa?.secret ? this.keyService.decrypt(doc.mfa.secret) : undefined,
      },
      roles: (doc.roles as any) || [],
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
    return person;
  }

  private toDoc(person: Partial<Person> & { userId: string }): MongoPersonDoc {
    const now = new Date().toISOString();
    return {
      userId: person.userId,
      phone: person.phone,
      email: person.email,
      name: person.name,
      authProviders: person.authProviders || [],
      mfa: {
        enabled: person.mfa?.enabled || false,
        // Encrypt TOTP secret at rest
        secret: person.mfa?.secret ? this.keyService.encrypt(person.mfa.secret) : undefined,
      },
      roles: person.roles || [],
      createdAt: person.createdAt || now,
      updatedAt: person.updatedAt || now,
    };
  }

  async create(personData: Partial<Person> & { userId: string }): Promise<Person> {
    const doc = this.toDoc(personData);
    await this.repo.replaceOne({ userId: doc.userId }, doc, { upsert: true });
    return this.toDomain(doc);
  }

  async save(personData: Partial<Person> & { id?: string; userId?: string }): Promise<Person> {
    const userId = personData.userId || personData.id || `person-${Math.random().toString(36).substring(2, 9)}`;
    return this.create({ ...personData, userId });
  }

  async findById(userId: string): Promise<Person | undefined> {
    const doc = await this.repo.findOne({ userId });
    return doc ? this.toDomain(doc) : undefined;
  }

  async findByPhone(phone: string): Promise<Person | undefined> {
    const doc = await this.repo.findOne({ phone });
    return doc ? this.toDomain(doc) : undefined;
  }

  async findByEmail(email: string): Promise<Person | undefined> {
    const doc = await this.repo.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } as any });
    return doc ? this.toDomain(doc) : undefined;
  }

  async update(person: Person): Promise<void> {
    person.updatedAt = new Date().toISOString();
    const doc = this.toDoc(person);
    await this.repo.replaceOne({ userId: person.userId }, doc, { upsert: true });
  }
}
