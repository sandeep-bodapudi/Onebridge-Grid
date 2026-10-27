import { GlobalRepository, MongoConnectionHandle } from '@onebridge/shared';
import type { Filter } from 'mongodb';
import { SearchDoc } from '../domain/search-doc.js';

export interface IndexQuery {
  kind?: 'company' | 'member';
  industry?: string;
  citySlug?: string;
  verified?: boolean;
  hasCatalogue?: boolean;
  sizeBand?: string;
  /** Members-only documents are excluded unless the searcher is signed in. */
  includeMembersOnly: boolean;
  /** Directory pages: only companies whose page allows search engines. */
  indexableOnly?: boolean;
  /** Lowercase words; candidates must match at least one somewhere (scoring decides the rest). */
  words: string[];
}

/**
 * N03 search index behind an interface (Q-NET-4 chose Meilisearch). The
 * MongoDB adapter needs no extra infrastructure and serves the demo and
 * launch scale; a Meilisearch adapter replaces it when hosted (D-N03).
 */
export interface SearchIndex {
  upsert(doc: SearchDoc): Promise<void>;
  patch(id: string, fields: Partial<SearchDoc>): Promise<void>;
  get(id: string): Promise<SearchDoc | null>;
  remove(id: string): Promise<void>;
  candidates(query: IndexQuery, limit: number): Promise<SearchDoc[]>;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export class MongoSearchIndex extends GlobalRepository<SearchDoc> implements SearchIndex {
  constructor(handle: MongoConnectionHandle) {
    super(handle, 'search_documents');
  }

  async upsert(doc: SearchDoc): Promise<void> {
    await this.collection.replaceOne({ id: doc.id } as Filter<SearchDoc>, doc, { upsert: true });
  }

  async patch(id: string, fields: Partial<SearchDoc>): Promise<void> {
    await this.collection.updateOne({ id } as Filter<SearchDoc>, { $set: fields });
  }

  async get(id: string): Promise<SearchDoc | null> {
    const doc = await this.findOne({ id } as Filter<SearchDoc>);
    if (!doc) return null;
    const { _id: _i, ...rest } = doc as SearchDoc & { _id?: unknown };
    return rest as SearchDoc;
  }

  async remove(id: string): Promise<void> {
    await this.deleteOne({ id } as Filter<SearchDoc>);
  }

  async candidates(q: IndexQuery, limit: number): Promise<SearchDoc[]> {
    const filter: Record<string, unknown> = {};
    if (q.kind) filter.kind = q.kind;
    if (q.industry) filter.industries = q.industry;
    if (q.citySlug) filter.citySlug = q.citySlug;
    if (q.verified) filter.verified = true;
    if (q.hasCatalogue) filter.hasCatalogue = true;
    if (q.sizeBand) filter.sizeBand = q.sizeBand;
    if (!q.includeMembersOnly) filter.visibility = 'everyone';
    if (q.indexableOnly) filter.indexable = true;
    if (q.words.length) {
      // Word starts on the searchable fields; words of 4+ letters match anywhere (scoring weighs them lower).
      const ors = q.words.flatMap((w) => {
        const re = w.length >= 4 ? new RegExp(escape(w), 'i') : new RegExp(`(^|[^\\p{L}\\p{N}])${escape(w)}`, 'iu');
        return [{ name: re }, { tags: re }, { headline: re }, { city: re }, { body: re }];
      });
      filter.$or = ors;
    }
    const docs = await this.collection.find(filter as Filter<SearchDoc>).limit(limit).toArray();
    return docs.map((d) => {
      const { _id: _i, ...rest } = d as SearchDoc & { _id?: unknown };
      return rest as SearchDoc;
    });
  }

  async createIndexes(): Promise<void> {
    await this.createIndex({ id: 1 }, { unique: true });
    await this.createIndex({ kind: 1, citySlug: 1, industries: 1 });
    await this.createIndex({ name: 1 });
  }
}
