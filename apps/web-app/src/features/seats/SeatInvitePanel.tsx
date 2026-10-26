'use client';

import React, { useId, useState } from 'react';
import { Check, Copy, Mail, MessageCircle, Send, Smartphone } from 'lucide-react';
import { Button, Input, type SeatItem } from '@onebridge/ui-kit';
import type { InviteChannel, InviteSummary } from '@onebridge/api-contracts';

const CHANNELS: Array<{ id: InviteChannel; label: string; icon: React.ReactNode }> = [
  { id: 'whatsapp', label: 'WhatsApp', icon: <MessageCircle className="w-4 h-4" aria-hidden="true" /> },
  { id: 'sms', label: 'SMS', icon: <Smartphone className="w-4 h-4" aria-hidden="true" /> },
  { id: 'email', label: 'Email', icon: <Mail className="w-4 h-4" aria-hidden="true" /> },
];

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

export interface SeatInvitePanelProps {
  seat: SeatItem;
  invite?: InviteSummary;
  /** Phone or email already on the seat's card, offered as the default contact. */
  suggestedPhone?: string;
  suggestedEmail?: string;
  onSend: (channel: InviteChannel, contact: string) => Promise<InviteSummary>;
  onResend: () => Promise<InviteSummary>;
  onRevoke: () => Promise<void>;
}

/**
 * F14: invite a person into a seat, then resend or cancel. While invites are
 * not delivered for real (demo, D-INVITE-DEV-LINK) the link is shown to copy.
 */
export const SeatInvitePanel: React.FC<SeatInvitePanelProps> = ({ seat, invite, suggestedPhone, suggestedEmail, onSend, onResend, onRevoke }) => {
  const [channel, setChannel] = useState<InviteChannel>('whatsapp');
  const [contact, setContact] = useState(suggestedPhone ?? '');
  const [busy, setBusy] = useState<'send' | 'resend' | 'revoke' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const contactId = useId();

  if (seat.status === 'active' || seat.status === 'offboarded' || seat.status === 'inactive') return null;

  const run = async (kind: 'send' | 'resend' | 'revoke', action: () => Promise<InviteSummary | void>) => {
    setBusy(kind);
    setError(null);
    setCopied(false);
    try {
      const result = await action();
      setLink(result && 'inviteUrl' in result && result.inviteUrl ? result.inviteUrl : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(null);
    }
  };

  const linkBox = link ? (
    <div className="rounded-[12px] border border-white/10 bg-charcoal-deep p-3 space-y-2" data-testid="invite-link">
      <p className="text-xs text-warm-paper/60">Messages are not sent in this demo. Share this link with the person instead. It works once and expires in 7 days.</p>
      <div className="flex gap-2">
        <input readOnly value={link} aria-label="Invite link" className="flex-1 min-w-0 h-11 px-3 rounded-control bg-charcoal border border-white/10 text-xs font-mono text-warm-paper" onFocus={(e) => e.currentTarget.select()} />
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard?.writeText(link).catch(() => undefined);
            setCopied(true);
          }}
          className="h-11 px-3 rounded-[10px] border border-white/15 text-sm font-bold inline-flex items-center gap-1.5 hover:bg-white/10 shrink-0"
        >
          {copied ? <Check className="w-4 h-4" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  ) : null;

  const errorBox = error ? (
    <p role="alert" className="text-sm px-3 py-2.5 rounded-[10px] bg-error/15 border border-error/40">
      {error}
    </p>
  ) : null;

  if (seat.status === 'invited' && invite) {
    const expired = invite.status === 'expired' || new Date(invite.expiresAt).getTime() <= Date.now();
    const via = CHANNELS.find((c) => c.id === invite.channel)?.label ?? invite.channel;
    return (
      <section aria-label="Invite" className="space-y-3 pt-1" data-testid="invite-status">
        <div className="rounded-[12px] border border-white/[0.08] bg-charcoal-deep p-3.5 text-sm">
          <p className="font-semibold">{expired ? 'Invite expired' : 'Invite sent'}</p>
          <p className="text-warm-paper/65 mt-0.5">
            {via} to {invite.contactMasked} · {expired ? `expired ${formatDate(invite.expiresAt)}` : `expires ${formatDate(invite.expiresAt)}`}
            {invite.sentCount > 1 ? ` · sent ${invite.sentCount} times` : ''}
          </p>
        </div>
        {errorBox}
        {linkBox}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" isLoading={busy === 'resend'} onClick={() => run('resend', onResend)}>
            {expired ? 'Send again' : 'Resend'}
          </Button>
          <Button variant="ghost" isLoading={busy === 'revoke'} onClick={() => run('revoke', onRevoke)} className="border border-white/15">
            Cancel invite
          </Button>
        </div>
      </section>
    );
  }

  return (
    <form
      aria-label="Invite someone to this seat"
      className="space-y-3 pt-1"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!contact.trim()) {
          setError(channel === 'email' ? 'Enter an email address.' : 'Enter a mobile number.');
          return;
        }
        void run('send', () => onSend(channel, contact.trim()));
      }}
    >
      <p className="text-sm font-semibold">Invite someone to this seat</p>
      <div role="radiogroup" aria-label="Send the invite by" className="grid grid-cols-3 gap-1.5">
        {CHANNELS.map((c) => (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={channel === c.id}
            onClick={() => {
              setChannel(c.id);
              setError(null);
              setContact(c.id === 'email' ? suggestedEmail ?? '' : suggestedPhone ?? '');
            }}
            className={`min-h-[44px] rounded-[10px] text-xs font-bold inline-flex items-center justify-center gap-1.5 border ${
              channel === c.id ? 'bg-warm-paper text-charcoal border-warm-paper' : 'border-white/15 text-warm-paper/80 hover:bg-white/10'
            }`}
          >
            {c.icon}
            {c.label}
          </button>
        ))}
      </div>
      <div>
        <label htmlFor={contactId} className="block text-[13px] font-semibold text-warm-paper/80 mb-1">
          {channel === 'email' ? 'Email address' : 'Mobile number'}
        </label>
        <Input
          id={contactId}
          type={channel === 'email' ? 'email' : 'tel'}
          inputMode={channel === 'email' ? 'email' : 'tel'}
          placeholder={channel === 'email' ? 'name@company.com' : '98765 43210'}
          value={contact}
          hasError={Boolean(error)}
          onChange={(e) => {
            setContact(e.target.value);
            if (error) setError(null);
          }}
        />
      </div>
      {errorBox}
      {linkBox}
      <Button type="submit" variant="primary" isFullWidth isLoading={busy === 'send'}>
        <Send className="w-4 h-4" aria-hidden="true" />
        Send invite
      </Button>
      <p className="text-xs text-warm-paper/55">They confirm their number, accept the privacy notice and the card becomes theirs. The seat, card link and leads stay with the company.</p>
    </form>
  );
};
