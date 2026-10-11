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
} from 'mongodb';
import { TenantContext, TenantIsolationError } from '../tenant.js';
import { getCollectionClassification, KNOWN_COLLECTIONS } from './collection-registry.js';

export class TenantScopedRepository<T extends Document> {
  protected readonly collection: Collection<T>;
  public readonly collectionName: string;

  constructor(db: Db, collectionName: string) {
    const classification = getCollectionClassification(collectionName);
    if (classification !== 'tenant-scoped') {
      throw new Error(
        `Collection "${collectionName}" is classified as "${classification}", not "tenant-scoped". Use GlobalRepository for global collections.`
      );
    }
    this.collectionName = collectionName;
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

  private checkFilterTenantId(obj: any, activeTenantId: string): void {
    if (!obj || typeof obj !== 'object') return;

    if ('tenantId' in obj) {
      if (obj.tenantId !== activeTenantId) {
        throw new TenantIsolationError(
          `TenantIsolationError: Filter tenantId "${obj.tenantId}" does not match active tenantId "${activeTenantId}"`
        );
      }
    }

    if (Array.isArray(obj.$or)) {
      for (const branch of obj.$or) {
        this.checkFilterTenantId(branch, activeTenantId);
      }
    }
    if (Array.isArray(obj.$and)) {
      for (const branch of obj.$and) {
        this.checkFilterTenantId(branch, activeTenantId);
      }
    }
  }

  private validateUpdate(update: UpdateFilter<T>): void {
    if (!update || typeof update !== 'object') return;

    const setObj = (update as any).$set;
    if (setObj && typeof setObj === 'object') {
      if ('tenantId' in setObj) {
        throw new TenantIsolationError(
          'TenantIsolationError: Cannot modify tenantId in an update operation'
        );
      }
    }

    const unsetObj = (update as any).$unset;
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
    const docWithTenant = { ...doc } as any;

    if (docWithTenant.tenantId && docWithTenant.tenantId !== activeTenantId) {
      throw new TenantIsolationError(
        `TenantIsolationError: Document tenantId "${docWithTenant.tenantId}" does not match active tenantId "${activeTenantId}"`
      );
    }

    docWithTenant.tenantId = activeTenantId;
    await this.collection.insertOne(docWithTenant);
    return docWithTenant as T;
  }

  async insertMany(docs: Array<OptionalUnlessRequiredId<T>>): Promise<T[]> {
    const activeTenantId = this.getActiveTenantId();
    const scopedDocs: any[] = [];

    for (const doc of docs) {
      const docObj = { ...doc } as any;
      if (docObj.tenantId && docObj.tenantId !== activeTenantId) {
        throw new TenantIsolationError(
          `TenantIsolationError: Mixed or conflicting tenantId "${docObj.tenantId}" in insertMany for active tenant "${activeTenantId}"`
        );
      }
      docObj.tenantId = activeTenantId;
      scopedDocs.push(docObj);
    }

    await this.collection.insertMany(scopedDocs);
    return scopedDocs as T[];
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

    const replObj = { ...replacement } as any;
    if (replObj.tenantId && replObj.tenantId !== activeTenantId) {
      throw new TenantIsolationError(
        `TenantIsolationError: Replacement tenantId "${replObj.tenantId}" does not match active tenantId "${activeTenantId}"`
      );
    }
    replObj.tenantId = activeTenantId;

    const result = await this.collection.replaceOne(scopedFilter, replObj, options);
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

  async aggregate<R = any>(pipeline: any[] = [], options?: AggregateOptions): Promise<R[]> {
    const activeTenantId = this.getActiveTenantId();
    const validatedPipeline = this.validateAndScopePipeline(pipeline, activeTenantId);
    return (await this.collection.aggregate(validatedPipeline, options).toArray()) as R[];
  }

  private validateAndScopePipeline(pipeline: any[], activeTenantId: string): any[] {
    const resultPipeline: any[] = [];

    // Prepend initial $match for tenantId
    resultPipeline.push({ $match: { tenantId: activeTenantId } });

    for (const stage of pipeline) {
      if (stage.$match) {
        this.checkFilterTenantId(stage.$match, activeTenantId);
      }

      if (stage.$lookup) {
        const lookup = stage.$lookup;
        const targetCollection = lookup.from;
        const targetMeta = KNOWN_COLLECTIONS[targetCollection];

        if (targetMeta && targetMeta.classification === 'tenant-scoped') {
          // If looking up another tenant-scoped collection, must ensure tenant isolation
          if (Array.isArray(lookup.pipeline)) {
            // Validate the inner lookup pipeline has tenantId match
            const hasTenantMatch = lookup.pipeline.some(
              (innerStage: any) =>
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
}
