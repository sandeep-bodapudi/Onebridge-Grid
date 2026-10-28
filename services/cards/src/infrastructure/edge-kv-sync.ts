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

/** D-VPS-DEPLOY B1: on the VPS, web-public serves /r/<code> itself; there is no edge cache to update. */
export class NoopEdgeShortLinkNotifier implements EdgeShortLinkNotifier {
  async syncShortLink(_link: ShortLinkProps): Promise<void> {}
}
