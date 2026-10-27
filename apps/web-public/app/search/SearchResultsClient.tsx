'use client';

import React from 'react';
import { SearchResultsList, type SearchResultItem } from '@onebridge/ui-kit';

/** Client wrapper (the ui-kit barrel is client-only). Companies open their page, members their profile. */
export function SearchResultsClient({ items, total, emptyHint }: { items: SearchResultItem[]; total?: number; emptyHint?: string }) {
  return (
    <SearchResultsList
      items={items}
      total={total}
      emptyHint={emptyHint}
      hrefFor={(item) => (item.actor.type === 'company' ? `/${item.actor.handle}` : `/in/${item.actor.handle}`)}
    />
  );
}
