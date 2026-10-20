import { ShortLinkProps } from '../domain/short-link.js';

export interface EdgeShortLinkNotifier {
  syncShortLink(link: ShortLinkProps): Promise<void>;
}

export class FakeEdgeShortLinkNotifier implements EdgeShortLinkNotifier {
  public syncedLinks = new Map<string, ShortLinkProps>();

  async syncShortLink(link: ShortLinkProps): Promise<void> {
    this.syncedLinks.set(link.code, link);
  }

  getSynced(code: string): ShortLinkProps | undefined {
    return this.syncedLinks.get(code);
  }

  clear(): void {
    this.syncedLinks.clear();
  }
}
