import { Person } from '../../domain/person.js';

export class InMemoryPersonRepository {
  private persons = new Map<string, Person>();

  async create(personData: Partial<Person> & { userId: string }): Promise<Person> {
    const now = new Date().toISOString();
    const person: Person = {
      userId: personData.userId,
      phone: personData.phone,
      email: personData.email?.trim().toLowerCase() || undefined,
      name: personData.name,
      authProviders: personData.authProviders || [],
      mfa: personData.mfa || { enabled: false },
      roles: personData.roles || [],
      emailVerifiedAt: personData.emailVerifiedAt,
      passwordHash: personData.passwordHash,
      passwordUpdatedAt: personData.passwordUpdatedAt,
      googleSub: personData.googleSub,
      language: personData.language,
      createdAt: now,
      updatedAt: now,
    };
    this.persons.set(person.userId, person);
    return person;
  }

  async save(personData: Partial<Person> & { id?: string; userId?: string }): Promise<Person> {
    const userId = personData.userId || personData.id || `person-${Math.random().toString(36).substring(2, 9)}`;
    return this.create({ ...personData, userId });
  }

  async findById(userId: string): Promise<Person | undefined> {
    return this.persons.get(userId);
  }

  async findByPhone(phone: string): Promise<Person | undefined> {
    return Array.from(this.persons.values()).find(p => p.phone === phone);
  }

  async findByEmail(email: string): Promise<Person | undefined> {
    return Array.from(this.persons.values()).find(p => p.email?.toLowerCase() === email.toLowerCase());
  }

  async findByGoogleSub(googleSub: string): Promise<Person | undefined> {
    return Array.from(this.persons.values()).find(p => p.googleSub === googleSub);
  }

  async update(person: Person): Promise<void> {
    person.updatedAt = new Date().toISOString();
    this.persons.set(person.userId, person);
  }
}
