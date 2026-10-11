import { MongoClient, Db, type Collection, type Filter, type Document } from 'mongodb';

export { MongoClient, Db, type Collection, type Filter, type Document };

export function redactMongoUri(uri: string): string {
  try {
    const url = new URL(uri.replace(/^mongodb\+srv:\/\//, 'http://').replace(/^mongodb:\/\//, 'http://'));
    if (url.username || url.password) {
      return uri.replace(/\/\/[^@]+@/, '//***:***@');
    }
    return uri;
  } catch {
    return uri.replace(/\/\/[^@]+@/, '//***:***@');
  }
}

export function isLocalMongoUri(uri: string): boolean {
  try {
    const cleaned = uri.replace(/^mongodb\+srv:\/\//, 'http://').replace(/^mongodb:\/\//, 'http://');
    const url = new URL(cleaned);
    const hostname = url.hostname.toLowerCase();
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === '[::1]'
    );
  } catch {
    return uri.includes('localhost') || uri.includes('127.0.0.1') || uri.includes('::1');
  }
}

export function validateMongoUri(
  uri: string | undefined,
  isProduction: boolean,
  allowRemoteSeed = false
): string {
  if (!uri || typeof uri !== 'string' || uri.trim() === '') {
    throw new Error('MONGODB_URI is required and cannot be empty.');
  }

  const trimmed = uri.trim();
  if (!trimmed.startsWith('mongodb://') && !trimmed.startsWith('mongodb+srv://')) {
    throw new Error(`Invalid MONGODB_URI scheme: "${redactMongoUri(trimmed)}". Must start with mongodb:// or mongodb+srv://`);
  }

  if (!isProduction && !allowRemoteSeed && !isLocalMongoUri(trimmed)) {
    throw new Error(
      `Refusing non-local MONGODB_URI "${redactMongoUri(trimmed)}" in non-production environment without ALLOW_REMOTE_SEED=true`
    );
  }

  return trimmed;
}

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

export async function connectMongo(uri: string, dbName?: string): Promise<{ client: MongoClient; db: Db }> {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  cachedClient = client;
  cachedDb = db;
  return { client, db };
}

export async function disconnectMongo(): Promise<void> {
  if (cachedClient) {
    await cachedClient.close();
    cachedClient = null;
    cachedDb = null;
  }
}
