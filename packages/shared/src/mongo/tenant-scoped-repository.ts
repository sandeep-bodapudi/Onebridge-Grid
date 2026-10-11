import {
  Collection,
  Db,
  Document,
  Filter,
  FindOptions,
  OptionalUnlessRequiredId,
  UpdateFilter,
  UpdateOptions,
  FindOneAndUpdateOptions,
  ReplaceOptions,
  CountDocumentsOptions,
  DistinctOptions,
  AggregateOptions,
  IndexSpecification,
  CreateIndexesOptions,
} from 'mongodb';
import { TenantContext, TenantIsolationError } from '../tenant.js';
import { getCollectionClassification, KNOWN_COLLECTIONS } from './collection-registry.js';
import { MongoConnectionHandle } from './connection-handle.js';

export class TenantScopedRepository<T extends Document> {
  protected readonly collection: Collection<T>;
  public readonly collectionName: string;

  constructor(dbOrHandle: Db | MongoConnectionHandle, collectionName: string) {
    const classification = getCollectionClassification(collectionName);
    if (classification !== 'tenant-scoped') {
      throw new Error(
        `Collection "${collectionName}" is classified as "${classification}", not "tenant-scoped". Use GlobalRepository for global collections.`
      );
    }
    this.collectionName = collectionName;
    const db = dbOrHandle instanceof MongoConnectionHandle ? dbOrHandle._getInternalDb() : dbOrHandle;
    this.collection = db.collection<T>(collectionName);
  }

  protected getActiveTenantId(): string {
    const tenantId = TenantContext.getTenantId();
    if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
      throw new TenantIsolationError(
        `TenantIsolationError: Missing active tenantId in context for collection "${this.collectionName}"`
      );
    }
    return tenantId;
  }

  private validateAndScopeFilter(filter: Filter<T> = {}): Filter<T> {
    const activeTenantId = this.getActiveTenantId();
    this.checkFilterTenantId(filter, activeTenantId);
    return {
      ...filter,
      tenantId: activeTenantId,
    } as Filter<T>;
  }

  private checkFilterTenantId(obj: Record<string, unknown> | null | undefined, activeTenantId: string): void {
    if (!obj || typeof obj !== 'object') return;

    if ('tenantId' in obj) {
      if (obj.tenantId !== activeTenantId) {
        throw new TenantIsolationError(
          `TenantIsolationError: Filter tenantId "${String(obj.tenantId)}" does not match active tenantId "${activeTenantId}"`
        );
      }
    }

    if (Array.isArray(obj.$or)) {
      for (const branch of obj.$or) {
        this.checkFilterTenantId(branch as Record<string, unknown>, activeTenantId);
      }
    }
    if (Array.isArray(obj.$and)) {
      for (const branch of obj.$and) {
        this.checkFilterTenantId(branch as Record<string, unknown>, activeTenantId);
      }
    }
  }

  private validateUpdate(update: UpdateFilter<T>): void {
    if (!update || typeof update !== 'object') return;

    const updateObj = update as Record<string, unknown>;
    const setObj = updateObj.$set as Record<string, unknown> | undefined;
    if (setObj && typeof setObj === 'object') {
      if ('tenantId' in setObj) {
        throw new TenantIsolationError(
          'TenantIsolationError: Cannot modify tenantId in an update operation'
        );
      }
    }

    const unsetObj = updateObj.$unset as Record<string, unknown> | undefined;
    if (unsetObj && typeof unsetObj === 'object') {
      if ('tenantId' in unsetObj) {
        throw new TenantIsolationError(
          'TenantIsolationError: Cannot unset tenantId in an update operation'
        );
      }
    }
  }

  async find(filter: Filter<T> = {}, options?: FindOptions): Promise<T[]> {
    const scopedFilter = this.validateAndScopeFilter(filter);
    return (await this.collection.find(scopedFilter, options).toArray()) as T[];
  }

  async findOne(filter: Filter<T> = {}, options?: FindOptions): Promise<T | null> {
    const scopedFilter = this.validateAndScopeFilter(filter);
    return (await this.collection.findOne(scopedFilter, options)) as T | null;
  }

  async countDocuments(
    filter: Filter<T> = {},
    options?: CountDocumentsOptions
  ): Promise<number> {
    const scopedFilter = this.validateAndScopeFilter(filter);
    return this.collection.countDocuments(scopedFilter, options);
  }

  async distinct<Key extends keyof T>(
    key: Key,
    filter: Filter<T> = {},
    options?: DistinctOptions
  ): Promise<Array<T[Key]>> {
    const scopedFilter = this.validateAndScopeFilter(filter);
    if (options) {
      return this.collection.distinct(key as string, scopedFilter, options) as Promise<Array<T[Key]>>;
    }
    return this.collection.distinct(key as string, scopedFilter) as Promise<Array<T[Key]>>;
  }

  async insertOne(doc: OptionalUnlessRequiredId<T>): Promise<T> {
    const activeTenantId = this.getActiveTenantId();
    const docWithTenant = { ...doc } as Record<string, unknown>;

    if (docWithTenant.tenantId && docWithTenant.tenantId !== activeTenantId) {
      throw new TenantIsolationError(
        `TenantIsolationError: Document tenantId "${String(docWithTenant.tenantId)}" does not match active tenantId "${activeTenantId}"`
      );
    }

    docWithTenant.tenantId = activeTenantId;
    await this.collection.insertOne(docWithTenant as unknown as OptionalUnlessRequiredId<T>);
    return docWithTenant as unknown as T;
  }

  async insertMany(docs: Array<OptionalUnlessRequiredId<T>>): Promise<T[]> {
    const activeTenantId = this.getActiveTenantId();
    const scopedDocs: Array<OptionalUnlessRequiredId<T>> = [];

    for (const doc of docs) {
      const docObj = { ...doc } as Record<string, unknown>;
      if (docObj.tenantId && docObj.tenantId !== activeTenantId) {
        throw new TenantIsolationError(
          `TenantIsolationError: Mixed or conflicting tenantId "${String(docObj.tenantId)}" in insertMany for active tenant "${activeTenantId}"`
        );
      }
      docObj.tenantId = activeTenantId;
      scopedDocs.push(docObj as unknown as OptionalUnlessRequiredId<T>);
    }

    await this.collection.insertMany(scopedDocs);
    return scopedDocs as unknown as T[];
  }

  async updateOne(
    filter: Filter<T>,
    update: UpdateFilter<T>,
    options?: UpdateOptions
  ): Promise<{ matchedCount: number; modifiedCount: number }> {
    const scopedFilter = this.validateAndScopeFilter(filter);
    this.validateUpdate(update);
    const result = await this.collection.updateOne(scopedFilter, update, options);
    return { matchedCount: result.matchedCount, modifiedCount: result.modifiedCount };
  }

  async updateMany(
    filter: Filter<T>,
    update: UpdateFilter<T>,
    options?: UpdateOptions
  ): Promise<{ matchedCount: number; modifiedCount: number }> {
    const scopedFilter = this.validateAndScopeFilter(filter);
    this.validateUpdate(update);
    const result = await this.collection.updateMany(scopedFilter, update, options);
    return { matchedCount: result.matchedCount, modifiedCount: result.modifiedCount };
  }

  async findOneAndUpdate(
    filter: Filter<T>,
    update: UpdateFilter<T>,
    options?: FindOneAndUpdateOptions
  ): Promise<T | null> {
    const scopedFilter = this.validateAndScopeFilter(filter);
    this.validateUpdate(update);
    const result = options
      ? await this.collection.findOneAndUpdate(scopedFilter, update, options)
      : await this.collection.findOneAndUpdate(scopedFilter, update);
    return result as T | null;
  }

  async replaceOne(
    filter: Filter<T>,
    replacement: T,
    options?: ReplaceOptions
  ): Promise<{ matchedCount: number; modifiedCount: number }> {
    const activeTenantId = this.getActiveTenantId();
    const scopedFilter = this.validateAndScopeFilter(filter);

    const replObj = { ...replacement } as Record<string, unknown>;
    if (replObj.tenantId && replObj.tenantId !== activeTenantId) {
      throw new TenantIsolationError(
        `TenantIsolationError: Replacement tenantId "${String(replObj.tenantId)}" does not match active tenantId "${activeTenantId}"`
      );
    }
    replObj.tenantId = activeTenantId;

    const result = await this.collection.replaceOne(scopedFilter, replObj as unknown as T, options);
    return { matchedCount: result.matchedCount, modifiedCount: result.modifiedCount };
  }

  async deleteOne(filter: Filter<T>): Promise<{ deletedCount: number }> {
    const scopedFilter = this.validateAndScopeFilter(filter);
    const result = await this.collection.deleteOne(scopedFilter);
    return { deletedCount: result.deletedCount };
  }

  async deleteMany(filter: Filter<T>): Promise<{ deletedCount: number }> {
    const scopedFilter = this.validateAndScopeFilter(filter);
    const result = await this.collection.deleteMany(scopedFilter);
    return { deletedCount: result.deletedCount };
  }

  async aggregate<R = Document>(pipeline: Document[] = [], options?: AggregateOptions): Promise<R[]> {
    const activeTenantId = this.getActiveTenantId();
    const validatedPipeline = this.validateAndScopePipeline(pipeline, activeTenantId);
    return (await this.collection.aggregate(validatedPipeline, options).toArray()) as R[];
  }

  private validateAndScopePipeline(pipeline: Document[], activeTenantId: string): Document[] {
    const resultPipeline: Document[] = [];

    // Prepend initial $match for tenantId
    resultPipeline.push({ $match: { tenantId: activeTenantId } });

    for (const stage of pipeline) {
      if (stage.$match) {
        this.checkFilterTenantId(stage.$match as Record<string, unknown>, activeTenantId);
      }

      if (stage.$lookup) {
        const lookup = stage.$lookup as Record<string, unknown>;
        const targetCollection = String(lookup.from || '');
        const targetMeta = KNOWN_COLLECTIONS[targetCollection];

        if (targetMeta && targetMeta.classification === 'tenant-scoped') {
          // If looking up another tenant-scoped collection, must ensure tenant isolation
          if (Array.isArray(lookup.pipeline)) {
            // Validate the inner lookup pipeline has tenantId match
            const hasTenantMatch = (lookup.pipeline as Document[]).some(
              (innerStage: Document) =>
                innerStage.$match && innerStage.$match.tenantId === activeTenantId
            );
            if (!hasTenantMatch) {
              // Inject tenant match into inner lookup pipeline
              lookup.pipeline = [
                { $match: { tenantId: activeTenantId } },
                ...lookup.pipeline,
              ];
            }
          } else {
            // Standard lookup without pipeline:
            // To prevent cross-tenant joining, require pipeline syntax or reject unscoped $lookup
            throw new TenantIsolationError(
              `TenantIsolationError: $lookup to tenant-scoped collection "${targetCollection}" must provide a scoped pipeline matching tenantId`
            );
          }
        }
      }

      resultPipeline.push(stage);
    }

    return resultPipeline;
  }

  async createIndex(indexSpec: IndexSpecification, options?: CreateIndexesOptions): Promise<string> {
    return this.collection.createIndex(indexSpec, options);
  }

  async findUnscopedByPerson(personId: string): Promise<T[]> {
    return (await this.collection.find({ personId } as unknown as Filter<T>).toArray()) as T[];
  }
}


