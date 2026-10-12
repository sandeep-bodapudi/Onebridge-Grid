import { GlobalRepository, MongoConnectionHandle } from '@onebridge/shared';
import { Person } from '../../domain/person.js';
import { KeyService } from '../../application/key.service.js';
import { IPersonRepository } from '../../application/auth.service.js';

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

export function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class MongoPersonRepository implements IPersonRepository {
  private repo: GlobalRepository<MongoPersonDoc>;

  constructor(
    dbOrHandle: MongoConnectionHandle | unknown,
    private keyService: KeyService
  ) {
    this.repo = new GlobalRepository<MongoPersonDoc>(dbOrHandle as MongoConnectionHandle, 'persons');
  }

  async ensureIndexes(): Promise<void> {
    await this.repo.createIndex({ phone: 1 }, { unique: true, sparse: true });
    await this.repo.createIndex({ email: 1 }, { unique: true, sparse: true });
  }

  private toDomain(doc: MongoPersonDoc): Person {
    const person: Person = {
      userId: doc.userId,
      phone: doc.phone,
      email: doc.email,
      name: doc.name,
      authProviders: (doc.authProviders as ('otp' | 'google' | 'microsoft')[]) || [],
      mfa: {
        enabled: doc.mfa?.enabled || false,
        secret: doc.mfa?.secret ? this.keyService.decrypt(doc.mfa.secret) : undefined,
      },
      roles: doc.roles || [],
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
    return person;
  }

  private toDoc(person: Person): MongoPersonDoc {
    return {
      userId: person.userId,
      phone: person.phone,
      email: person.email,
      name: person.name,
      authProviders: person.authProviders,
      mfa: {
        enabled: person.mfa?.enabled || false,
        secret: person.mfa?.secret ? this.keyService.encrypt(person.mfa.secret) : undefined,
      },
      roles: person.roles,
      createdAt: person.createdAt,
      updatedAt: person.updatedAt,
    };
  }

  async create(person: Omit<Person, 'createdAt' | 'updatedAt'>): Promise<Person> {
    const now = new Date().toISOString();
    const fullPerson: Person = {
      ...person,
      createdAt: now,
      updatedAt: now,
    };
    const doc = this.toDoc(fullPerson);
    await this.repo.insertOne(doc);
    return fullPerson;
  }

  async createPerson(personData: Omit<Person, 'userId' | 'createdAt' | 'updatedAt'>, idGenerator?: () => string): Promise<Person> {
    const userId = idGenerator ? idGenerator() : `usr_${Math.random().toString(36).substring(2, 9)}`;
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
    const escaped = escapeRegExp(email);
    const doc = await this.repo.findOne({ email: new RegExp(`^${escaped}$`, 'i') });
    return doc ? this.toDomain(doc) : undefined;
  }

  async update(person: Person): Promise<void> {
    person.updatedAt = new Date().toISOString();
    const doc = this.toDoc(person);
    await this.repo.replaceOne({ userId: person.userId }, doc, { upsert: true });
  }
}
