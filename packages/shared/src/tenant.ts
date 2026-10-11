import { AsyncLocalStorage } from 'async_hooks';

export class TenantIsolationError extends Error {
  constructor(message = 'TenantIsolationError: Missing tenantId in query') {
    super(message);
    this.name = 'TenantIsolationError';
  }
}

export class TenantContext {
  private static storage = new AsyncLocalStorage<string>();

  static run<R>(tenantId: string, fn: () => R): R {
    return this.storage.run(tenantId, fn);
  }

  static getTenantId(): string | undefined {
    return this.storage.getStore();
  }
}

export class Repository<T> {
  constructor(protected collection: any[] = []) {}

  protected resolveTenantId(query?: any): string {
    const fromQuery = query?.where?.tenantId;
    const fromContext = TenantContext.getTenantId();
    const tenantId = fromQuery || fromContext;
    if (!tenantId) {
      throw new TenantIsolationError('TenantIsolationError: Missing tenantId in query');
    }
    return tenantId;
  }

  async findMany(query?: any): Promise<T[]> {
    const tenantId = this.resolveTenantId(query);
    return this.collection.filter(item => {
      if (item.tenantId !== tenantId && item.orgId !== tenantId) {
        return false;
      }
      if (query?.where) {
        for (const [key, val] of Object.entries(query.where)) {
          if (key === 'tenantId') continue;
          if (item[key] !== val) return false;
        }
      }
      return true;
    });
  }

  async findOne(query: any): Promise<T | null> {
    const items = await this.findMany(query);
    return items[0] || null;
  }

  async save(item: T): Promise<T> {
    const doc = item as any;
    const tenantId = doc.tenantId || doc.orgId || TenantContext.getTenantId();
    if (!tenantId) {
      throw new TenantIsolationError('TenantIsolationError: Missing tenantId in document');
    }
    const idx = this.collection.findIndex(x => x.id === doc.id);
    if (idx >= 0) {
      this.collection[idx] = { ...doc, tenantId };
    } else {
      this.collection.push({ ...doc, tenantId });
    }
    return item;
  }

  async delete(query: any): Promise<boolean> {
    const tenantId = this.resolveTenantId(query);
    const beforeLen = this.collection.length;
    this.collection = this.collection.filter(x => {
      if (x.tenantId !== tenantId && x.orgId !== tenantId) return true;
      if (query.where?.id && x.id === query.where.id) return false;
      return true;
    });
    return this.collection.length < beforeLen;
  }
}
