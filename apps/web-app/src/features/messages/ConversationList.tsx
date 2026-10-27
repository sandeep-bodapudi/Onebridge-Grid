'use client';

import React from 'react';
import type { Conversation } from '@onebridge/api-contracts';
import { initials, otherSide, preview, shortTime } from './chat-state';

export function Avatar({ name, photoUrl, size = 44, online }: { name: string; photoUrl?: string; size?: number; online?: boolean }) {
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      {photoUrl ? (
        <img src={photoUrl} alt="" className="w-full h-full rounded-full object-cover bg-sand-border" />
      ) : (
        <span aria-hidden="true" className="w-full h-full rounded-full bg-charcoal text-warm-paper inline-flex items-center justify-center text-sm font-bold">
          {initials(name) || '?'}
        </span>
      )}
      {online ? <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-success border-2 border-white" aria-hidden="true" /> : null}
    </span>
  );
}

export function ConversationList({
  items,
  selectedId,
  onSelect,
  typingIds,
}: {
  items: Conversation[];
  selectedId?: string;
  onSelect: (id: string) => void;
  typingIds: string[];
}) {
  return (
    <ul className="divide-y divide-sand-border" aria-label="Conversations">
      {items.map((conv) => {
        const other = otherSide(conv);
        const unread = conv.unreadCount > 0;
        const selected = conv.id === selectedId;
        const typing = typingIds.includes(conv.id);
        return (
          <li key={conv.id}>
            <button
              type="button"
              onClick={() => onSelect(conv.id)}
              aria-current={selected ? 'true' : undefined}
              className={`w-full text-left flex gap-3 px-4 py-3 min-h-[72px] items-center hover:bg-warm-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-bridge-orange ${selected ? 'bg-warm-paper' : 'bg-white'}`}
            >
              <Avatar name={other.name} photoUrl={other.photoUrl} online={conv.otherOnline} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className={`truncate ${unread ? 'font-extrabold' : 'font-semibold'}`}>{other.name}</span>
                  {other.verified ? <span className="text-xs font-bold text-charcoal/60">Verified</span> : null}
                  <span className="ml-auto text-xs text-charcoal/60 shrink-0">{shortTime(conv.lastMessage?.createdAt ?? conv.updatedAt)}</span>
                </span>
                <span className="flex items-center gap-2 mt-0.5">
                  <span className={`truncate text-sm ${unread ? 'text-charcoal font-semibold' : 'text-charcoal/65'}`}>
                    {typing ? 'Typing…' : preview(conv)}
                  </span>
                  {conv.requestDirection === 'outgoing' ? <span className="ml-auto shrink-0 text-xs font-semibold text-charcoal/60">Request sent</span> : null}
                  {unread ? (
                    <span className="ml-auto shrink-0 min-w-[22px] h-[22px] px-1.5 rounded-full bg-bridge-orange text-[#241A10] text-xs font-extrabold inline-flex items-center justify-center">
                      <span className="sr-only">Unread messages: </span>
                      {conv.unreadCount}
                    </span>
                  ) : null}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
