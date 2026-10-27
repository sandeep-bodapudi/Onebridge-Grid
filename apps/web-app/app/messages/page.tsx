'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import { MemberPageShell } from '../../src/features/profile';
import { MessagesApp, type NewConversationTarget } from '../../src/features/messages';

/** ?to=member:<personId> or company:<tenantId>, with &name= and optional &card=<seatId>. */
function parseTarget(params: URLSearchParams): NewConversationTarget | undefined {
  const [type, ...rest] = (params.get('to') ?? '').split(':');
  const id = rest.join(':');
  if ((type !== 'member' && type !== 'company') || !id) return undefined;
  return { type, id, name: (params.get('name') ?? '').slice(0, 120) || (type === 'company' ? 'this company' : 'this member'), viaCardSeatId: params.get('card') || undefined };
}

function MessagesPageBody() {
  const params = useSearchParams();
  return (
    <MemberPageShell light>
      {(session) => (
        <MessagesApp
          session={session}
          initialInbox={params.get('inbox') === 'company' ? 'company' : 'personal'}
          initialConversationId={params.get('c') ?? undefined}
          target={parseTarget(params)}
        />
      )}
    </MemberPageShell>
  );
}

/** N08: real-time messages (personal inbox and company inbox). */
export default function MessagesPage() {
  return (
    <React.Suspense fallback={null}>
      <MessagesPageBody />
    </React.Suspense>
  );
}
