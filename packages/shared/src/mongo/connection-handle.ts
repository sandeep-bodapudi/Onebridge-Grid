import { MongoClient, Db } from 'mongodb';

export class MongoConnectionHandle {
  readonly #client: MongoClient;
  readonly #db: Db;

  constructor(client: MongoClient, db: Db) {
    this.#client = client;
    this.#db = db;
  }

  get isConnected(): boolean {
    return true;
  }

  async close(): Promise<void> {
    await this.#client.close();
  }

  /**
   * Protected internal database accessor strictly reserved for repository base classes
   * within @onebridge/shared. Never exposed directly to services or application code.
   * @internal
   */
  _getInternalDb(): Db {
    return this.#db;
  }
}
