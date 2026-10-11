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
import { getCollectionClassification } from './collection-registry.js';
import { MongoConnectionHandle } from './connection-handle.js';

export class GlobalRepository<T extends Document> {
  protected readonly collection: Collection<T>;
  public readonly collectionName: string;

  constructor(dbOrHandle: Db | MongoConnectionHandle, collectionName: string) {
    const classification = getCollectionClassification(collectionName);
    if (classification !== 'global') {
      throw new Error(
        `Collection "${collectionName}" is classified as "${classification}". GlobalRepository can only be used for allowlisted global collections.`
      );
    }
    this.collectionName = collectionName;
    const db = dbOrHandle instanceof MongoConnectionHandle ? dbOrHandle._getInternalDb() : dbOrHandle;
    this.collection = db.collection<T>(collectionName);
  }

  async find(filter: Filter<T> = {}, options?: FindOptions): Promise<T[]> {
    return (await this.collection.find(filter, options).toArray()) as T[];
  }

  async findOne(filter: Filter<T> = {}, options?: FindOptions): Promise<T | null> {
    return (await this.collection.findOne(filter, options)) as T | null;
  }

  async countDocuments(
    filter: Filter<T> = {},
    options?: CountDocumentsOptions
  ): Promise<number> {
    return this.collection.countDocuments(filter, options);
  }

  async distinct<Key extends keyof T>(
    key: Key,
    filter: Filter<T> = {},
    options?: DistinctOptions
  ): Promise<Array<T[Key]>> {
    if (options) {
      return this.collection.distinct(key as string, filter, options) as Promise<Array<T[Key]>>;
    }
    return this.collection.distinct(key as string, filter) as Promise<Array<T[Key]>>;
  }

  async insertOne(doc: OptionalUnlessRequiredId<T>): Promise<T> {
    await this.collection.insertOne(doc);
    return doc as T;
  }

  async insertMany(docs: Array<OptionalUnlessRequiredId<T>>): Promise<T[]> {
    await this.collection.insertMany(docs);
    return docs as T[];
  }

  async updateOne(
    filter: Filter<T>,
    update: UpdateFilter<T>,
    options?: UpdateOptions
  ): Promise<{ matchedCount: number; modifiedCount: number }> {
    const result = await this.collection.updateOne(filter, update, options);
    return { matchedCount: result.matchedCount, modifiedCount: result.modifiedCount };
  }

  async updateMany(
    filter: Filter<T>,
    update: UpdateFilter<T>,
    options?: UpdateOptions
  ): Promise<{ matchedCount: number; modifiedCount: number }> {
    const result = await this.collection.updateMany(filter, update, options);
    return { matchedCount: result.matchedCount, modifiedCount: result.modifiedCount };
  }

  async findOneAndUpdate(
    filter: Filter<T>,
    update: UpdateFilter<T>,
    options?: FindOneAndUpdateOptions
  ): Promise<T | null> {
    const result = options
      ? await this.collection.findOneAndUpdate(filter, update, options)
      : await this.collection.findOneAndUpdate(filter, update);
    return result as T | null;
  }

  async replaceOne(
    filter: Filter<T>,
    replacement: T,
    options?: ReplaceOptions
  ): Promise<{ matchedCount: number; modifiedCount: number }> {
    const result = await this.collection.replaceOne(filter, replacement, options);
    return { matchedCount: result.matchedCount, modifiedCount: result.modifiedCount };
  }

  async deleteOne(filter: Filter<T>): Promise<{ deletedCount: number }> {
    const result = await this.collection.deleteOne(filter);
    return { deletedCount: result.deletedCount };
  }

  async deleteMany(filter: Filter<T>): Promise<{ deletedCount: number }> {
    const result = await this.collection.deleteMany(filter);
    return { deletedCount: result.deletedCount };
  }

  async aggregate<R = any>(pipeline: any[] = [], options?: AggregateOptions): Promise<R[]> {
    return (await this.collection.aggregate(pipeline, options).toArray()) as R[];
  }

  async createIndex(indexSpec: IndexSpecification, options?: CreateIndexesOptions): Promise<string> {
    return this.collection.createIndex(indexSpec, options);
  }
}
