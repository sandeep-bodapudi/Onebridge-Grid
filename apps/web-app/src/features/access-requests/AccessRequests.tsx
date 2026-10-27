'use client';

import React, { useEffect, useState } from 'react';
import { Send, UserPlus } from 'lucide-react';
import { Button, Input } from '@onebridge/ui-kit';
import type { AccessRequest } from '@onebridge/api-contracts';
import { apiClient } from '../../api-client';

const panel = 'rounded-[14px] bg-charcoal border border-white/[0.08]';

/**
 * N02: the owner sees people asking to join the company and approves them
 * as an admin or employee, or declines. Shown only while requests are open.
 */
export const AccessRequestsPanel: React.FC<{ tenantId: string }> = ({ tenantId }) => {
  const [items, setItems] = useState<AccessRequest[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [roles, setRoles] = useState<Record<string, 'admin' | 'employee'>>({});

  useEffect(() => {
    apiClient.listAccessRequests(tenantId).then(setItems).catch(() => setItems([]));
  }, [tenantId]);

  if (items.length === 0) return null;

  const decide = async (r: AccessRequest, decision: 'approve' | 'decline') => {
    setBusy(r.id);
    setError(null);
    try {
      await apiClient.decideAccessRequest(tenantId, r.id, decision, roles[r.id] ?? 'employee');
      setItems((list) => list.filter((x) => x.id !== r.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the decision.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className={`${panel} p-5 mb-6`} aria-labelledby="access-requests-title" data-testid="access-requests">
      <h2 id="access-requests-title" className="text-base font-bold flex items-center gap-2">
        <UserPlus className="w-4 h-4" aria-hidden="true" />
        {items.length === 1 ? '1 person asked to join' : `${items.length} people asked to join`}
      </h2>
      <p className="text-sm text-warm-paper/60 mt-1">They found your company by its GSTIN. Their phone and email are not shared with you.</p>
      {error ? (
        <p role="alert" className="mt-3 text-sm px-3 py-2.5 rounded-[10px] bg-error/15 border border-error/40">
          {error}
        </p>
      ) : null}
      <ul className="mt-4 space-y-2">
        {items.map((r) => (
          <li key={r.id} className="rounded-xl bg-charcoal-deep border border-white/[0.08] p-3.5 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{r.requester.name}</p>
              {r.message ? <p className="text-sm text-warm-paper/70 mt-0.5">“{r.message}”</p> : null}
              <p className="text-xs text-warm-paper/45 mt-1">{new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <label className="sr-only" htmlFor={`role-${r.id}`}>
                Role for {r.requester.name}
              </label>
              <select
                id={`role-${r.id}`}
                value={roles[r.id] ?? 'employee'}
                onChange={(e) => setRoles({ ...roles, [r.id]: e.target.value as 'admin' | 'employee' })}
                className="min-h-[44px] px-3 rounded-control bg-charcoal border border-white/15 text-sm text-warm-paper"
              >
                <option value="employee">As employee</option>
                <option value="admin">As admin</option>
              </select>
              <Button variant="primary" isLoading={busy === r.id} onClick={() => decide(r, 'approve')}>
                Approve
              </Button>
              <Button variant="ghost" disabled={busy === r.id} onClick={() => decide(r, 'decline')} className="border border-white/15">
                Decline
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
};

/**
 * N02: shown when a GSTIN is already registered. The person asks the owner
 * for access; the answer is the same whether or not the company exists.
 */
export const RequestAccessForm: React.FC<{ gstin: string; suggestedName?: string; onBack: () => void }> = ({ gstin, suggestedName, onBack }) => {
  const [name, setName] = useState(suggestedName ?? '');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (sent) {
    return (
      <div className={`${panel} p-6 space-y-3`} role="status" data-testid="access-request-sent">
        <h2 className="text-lg font-bold">Request sent</h2>
        <p className="text-sm text-warm-paper/70">If this company is on OneBridge Grid, its owner will see your request. You will get access when they approve it.</p>
        <a href="/profile" className="inline-flex min-h-[44px] items-center text-sm font-bold underline underline-offset-4">
          Set up your personal profile meanwhile
        </a>
      </div>
    );
  }

  return (
    <form
      noValidate
      className={`${panel} p-6 space-y-4`}
      data-testid="request-access-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        if (!name.trim()) return setError('Enter the name the owner should see.');
        setBusy(true);
        try {
          await apiClient.requestCompanyAccess({ gstin, name: name.trim(), message: message.trim() || undefined });
          setSent(true);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Could not send the request.');
        } finally {
          setBusy(false);
        }
      }}
    >
      <div>
        <h2 className="text-lg font-bold">This company is already on OneBridge Grid</h2>
        <p className="text-sm text-warm-paper/70 mt-1">
          A company with GSTIN <span className="font-mono">{gstin}</span> already has a profile. Ask its owner to add you.
        </p>
      </div>
      <div>
        <label htmlFor="ra-name" className="block text-[13px] font-semibold text-warm-paper/80 mb-1">
          Your name, as the owner should see it
        </label>
        <Input id="ra-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label htmlFor="ra-message" className="block text-[13px] font-semibold text-warm-paper/80 mb-1">
          Message (optional)
        </label>
        <textarea
          id="ra-message"
          rows={3}
          maxLength={500}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="For example: I run purchasing at the Balanagar works."
          className="w-full px-3 py-2.5 text-sm rounded-control bg-charcoal text-warm-paper border border-sand-border/30 focus:outline-none focus:border-bridge-orange focus:ring-1 focus:ring-bridge-orange"
        />
      </div>
      <p className="text-xs text-warm-paper/55">Your phone number and email are not shared with the owner.</p>
      {error ? (
        <p role="alert" className="text-sm px-3 py-2.5 rounded-[10px] bg-error/15 border border-error/40">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary" isLoading={busy}>
          <Send className="w-4 h-4" aria-hidden="true" />
          Ask for access
        </Button>
        <Button type="button" variant="ghost" onClick={onBack} className="border border-white/15">
          Use a different GSTIN
        </Button>
      </div>
    </form>
  );
};
