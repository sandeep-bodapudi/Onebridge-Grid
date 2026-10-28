import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { MapPin, MessageCircle, Phone, Search, ShieldCheck } from 'lucide-react';
import { ScanToLead } from '../src/landing/ScanToLead';

export const metadata: Metadata = {
  title: 'OneBridge Grid | Business cards your company owns',
  description:
    'Verified digital business cards that belong to your company, not to the person. When people move on, the card link, the QR codes and every lead stay with you.',
};

/**
 * Landing page (D-UI-REDESIGN). Concept: two sides of one card. Dark sections are the company's
 * side (where you run it); warm paper sections are the visitor's side (what customers see). The
 * hero plays the scan-to-lead story; the seat section shows a card changing hands.
 */

const WEB_PUBLIC_URL = process.env.NEXT_PUBLIC_WEB_PUBLIC_URL ?? 'http://localhost:3001';
const SUPPORT_EMAIL = 'support@onebridgecard.com';

/** Brand mark (same shape as ui-kit SpanMark; the ui-kit barrel is client-only, and this page renders on the server). */
function SpanMark({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`inline-flex items-center justify-center rounded-lg bg-bridge-orange shrink-0 ${className}`}>
      <span className="flex items-center w-[18px]">
        <span className="w-1 h-1 bg-[#241A10]" />
        <span className="flex-1 h-[2px] bg-[#241A10]" />
        <span className="w-1 h-1 bg-[#241A10]" />
      </span>
    </span>
  );
}

/* The hero's single animation: the person on the card changes every few seconds; nothing else moves.
   With reduced motion the second holder is shown, still. */
const HANDOVER_CSS = `
@keyframes ob-first { 0%, 42% { opacity: 1; transform: none; } 50%, 92% { opacity: 0; transform: translateY(-6px); } 100% { opacity: 1; transform: none; } }
@keyframes ob-second { 0%, 42% { opacity: 0; transform: translateY(6px); } 50%, 92% { opacity: 1; transform: none; } 100% { opacity: 0; transform: translateY(6px); } }
.ob-first { animation: ob-first 9s ease-in-out infinite; }
.ob-second { animation: ob-second 9s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .ob-first { animation: none; opacity: 0; }
  .ob-second { animation: none; opacity: 1; transform: none; }
}
`;

const HOLDERS = [
  { initials: 'RD', name: 'Rohit Deshmukh', since: 'Holder since March 2023', tint: 'bg-[#9FC3E8]' },
  { initials: 'MI', name: 'Meera Iyer', since: 'Holder since February 2026', tint: 'bg-[#F2C48D]' },
];

/** The hero card: company, seat and leads are fixed; only the holder swaps. */
function HandoverCard() {
  return (
    <figure className="relative mx-auto w-full max-w-[340px]">
      <style>{HANDOVER_CSS}</style>
      <div className="rounded-[28px] bg-[#141213] p-2.5 shadow-[0_24px_70px_rgba(0,0,0,0.55)] ring-1 ring-white/10">
        <div className="overflow-hidden rounded-[22px] bg-[#FAF7F2] text-[#2B2728]" aria-hidden="true">
          <div className="relative bg-[#1F3A5F] px-5 pb-6 pt-5 text-[#FAF7F2]">
            <div className="flex items-center justify-between text-[11px] font-semibold">
              <span>Sahyadri Steel Works</span>
              <span className="rounded bg-bridge-orange px-1.5 py-0.5 font-bold text-[#241A10]">Verified</span>
            </div>
            <div className="relative mt-5 h-[104px]">
              {HOLDERS.map((h, i) => (
                <div key={h.name} className={`absolute inset-0 ${i === 0 ? 'ob-first' : 'ob-second'}`}>
                  <div className={`flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-bold text-[#241A10] ${h.tint}`}>{h.initials}</div>
                  <p className="mt-2.5 text-[22px] font-bold leading-tight tracking-[-0.02em]">{h.name}</p>
                  <p className="text-xs opacity-80">{h.since}</p>
                </div>
              ))}
            </div>
            <span className="absolute inset-x-0 bottom-0 h-[5px] bg-bridge-orange" />
          </div>
          <dl className="grid grid-cols-2 gap-px bg-[#E3D9C8] text-xs">
            <div className="bg-white px-4 py-3">
              <dt className="text-[#5E5758]">Seat</dt>
              <dd className="mt-0.5 font-bold">Head of sales, Pune</dd>
            </div>
            <div className="bg-white px-4 py-3">
              <dt className="text-[#5E5758]">Leads on this card</dt>
              <dd className="mt-0.5 font-bold">214</dd>
            </div>
            <div className="col-span-2 bg-white px-4 py-3">
              <dt className="text-[#5E5758]">Card link and QR code</dt>
              <dd className="mt-0.5 font-bold">onebridgecard.com/r/7KQ2MX</dd>
            </div>
          </dl>
        </div>
      </div>
      <figcaption className="mt-5 text-center text-sm leading-relaxed text-warm-paper/65">
        People change jobs. The seat, its link, its QR code and its 214 leads stay with the company.
      </figcaption>
    </figure>
  );
}

const TIMELINE = [
  {
    when: 'March 2023',
    title: 'Rohit joins as head of sales',
    body: 'The admin creates the seat and sends an invite by email. Rohit claims his card in a minute.',
  },
  {
    when: '2023 to 2026',
    title: '214 leads come in',
    body: 'From his card, the QR standee at the Pune office and the company page. Each lead is saved to the company, with contact details encrypted.',
  },
  {
    when: 'January 2026',
    title: 'Rohit moves on',
    body: 'His access to the seat ends. The card link keeps working and the leads stay in the company account.',
  },
  {
    when: 'February 2026',
    title: 'Meera takes the seat',
    body: 'Same link, same QR codes, the full lead history. Customers reach the right person and nothing needs reprinting.',
  },
];

const VISITOR_SIDE = [
  {
    title: 'A card they can save in one tap',
    body: 'Name, role, branch and the Verified badge, in English or Hindi. Visitors save the contact or share their own details back.',
  },
  {
    title: 'A company page that answers questions',
    body: 'Products with prices, services, past work, every branch with directions, and an enquiry button on each product that reaches the right branch.',
  },
  {
    title: 'A way to talk without sharing numbers',
    body: 'Customers message the company from its page or a card. Messages land in a shared company inbox, and phone numbers are never shown publicly.',
  },
];

const COMPANY_SIDE = [
  {
    title: 'Your brand on every card',
    body: 'Set the logo, colours and template once. Lock the fields employees should not change.',
  },
  {
    title: 'A Business ID that proves it is you',
    body: 'Every company gets a permanent Business ID. Verified companies show the badge on every card and page.',
  },
  {
    title: 'One inbox for the whole team',
    body: 'Assign conversations to a seat, keep private notes, and mark them done. Assignments follow the seat, not the person.',
  },
  {
    title: 'A record of every change',
    body: 'The audit log shows who changed what and when, across cards, seats, branches and settings.',
  },
];

const NETWORK = [
  { icon: Search, title: 'Find suppliers and buyers', body: 'Search companies and professionals by name, city and industry.' },
  { icon: ShieldCheck, title: 'Profiles with verified work history', body: 'A role confirmed by the company counts for more than a line someone typed.' },
  { icon: MessageCircle, title: 'Message without the spam', body: 'A first message to a stranger arrives as a request; they choose whether to reply.' },
];

const linkMuted = 'flex min-h-[44px] items-center px-3 hover:text-warm-paper';
const primaryButton =
  'inline-flex min-h-[52px] items-center justify-center rounded-[14px] bg-bridge-orange px-6 text-[15px] font-bold text-[#241A10] hover:bg-[#E5790C] focus-visible:outline-offset-4';
const secondaryButton =
  'inline-flex min-h-[52px] items-center justify-center rounded-[14px] border border-white/20 px-6 text-[15px] font-semibold hover:bg-white/10';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-charcoal-deep text-warm-paper">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-warm-paper focus:px-4 focus:py-3 focus:text-[#2B2728]">
        Skip to content
      </a>

      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-charcoal-deep/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/" className="flex min-h-[44px] items-center gap-2.5 font-bold">
            <SpanMark />
            OneBridge Grid
          </Link>
          <nav aria-label="Main" className="hidden items-center text-sm font-semibold text-warm-paper/70 lg:flex">
            <a href="#seat" className={linkMuted}>
              How it works
            </a>
            <a href="#customers" className={linkMuted}>
              What customers see
            </a>
            <a href="#network" className={linkMuted}>
              Business network
            </a>
            <a href={`${WEB_PUBLIC_URL}/search`} className={linkMuted}>
              Find companies
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" data-testid="home-sign-in" className="flex min-h-[44px] items-center rounded-[10px] px-3 text-sm font-semibold hover:bg-white/10">
              Sign in
            </Link>
            <Link
              href="/signup"
              data-testid="home-sign-up-header"
              className="hidden min-h-[44px] items-center rounded-[10px] bg-bridge-orange px-4 text-sm font-bold text-[#241A10] hover:bg-[#E5790C] sm:flex"
            >
              Create free account
            </Link>
          </div>
        </div>
      </header>

      <main id="main">
        {/* Hero: the company's side */}
        <section className="mx-auto grid max-w-7xl items-center gap-10 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-12 lg:pt-20">
          <div className="ob-rise">
            <h1 className="max-w-[11ch] text-[44px] font-bold leading-[0.96] tracking-[-0.05em] sm:text-[64px] lg:text-[72px]">From a scan to a lead in seconds.</h1>
            <p className="mt-6 max-w-[46ch] text-lg leading-relaxed text-warm-paper/75">
              Every employee gets a verified digital card that belongs to your company. Customers scan, save and share their details, and the lead lands with the right
              person, and stays with the company.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/signup" data-testid="home-sign-up" className={primaryButton}>
                Create free account
              </Link>
              <a href={`${WEB_PUBLIC_URL}/search`} className={secondaryButton}>
                Find companies
              </a>
            </div>
            <p className="mt-5 text-sm text-warm-paper/60">Invited by your company? Open the link in your invite email to claim your card.</p>
          </div>
          <ScanToLead />
        </section>

        {/* The seat's history: a real sequence, so it is a dated timeline */}
        <section id="seat" aria-labelledby="seat-title" className="scroll-mt-16 border-t border-white/[0.06] bg-[#171516]">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
            <div className="grid items-center gap-12 lg:grid-cols-[1.2fr_1fr]">
              <div>
                <h2 id="seat-title" className="max-w-[16ch] text-3xl font-bold leading-tight tracking-[-0.03em] sm:text-[44px]">
                  Business cards your company owns.
                </h2>
                <p className="mt-4 max-w-[52ch] text-lg leading-relaxed text-warm-paper/70">
                  Each card lives on a seat in your company: a role at a branch. People are invited into seats and leave them; the seat keeps its link, its QR codes and
                  every lead.
                </p>
              </div>
              <HandoverCard />
            </div>
            <h3 className="mt-16 text-lg font-bold">One seat, two people, nothing lost</h3>
            <ol className="mt-6 grid gap-0 md:grid-cols-4">
              {TIMELINE.map((step, i) => (
                <li key={step.when} className="relative border-l border-white/15 pb-10 pl-6 last:pb-0 md:border-l-0 md:border-t md:pb-0 md:pl-0 md:pr-8 md:pt-6">
                  <span
                    aria-hidden="true"
                    className={`absolute -left-[5px] top-1 h-[9px] w-[9px] rounded-full md:-top-[5px] md:left-0 ${i === 3 ? 'bg-bridge-orange' : 'bg-warm-paper/60'}`}
                  />
                  <p className="text-sm font-semibold text-warm-paper/60">{step.when}</p>
                  <h4 className="mt-1 text-lg font-bold leading-snug">{step.title}</h4>
                  <p className="mt-2 text-sm leading-relaxed text-warm-paper/70">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* The visitor's side: warm paper */}
        <section id="customers" aria-labelledby="customers-title" className="light scroll-mt-16 bg-[#FAF7F2] text-[#2B2728]">
          <div className="mx-auto grid max-w-6xl gap-14 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:py-24">
            <div>
              <h2 id="customers-title" className="max-w-[18ch] text-3xl font-bold leading-tight tracking-[-0.03em] sm:text-[40px]">
                What your customers see.
              </h2>
              <p className="mt-4 max-w-[52ch] text-[#5E5758]">Light, quick and made for a phone, because that is where a card gets opened.</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href={`${WEB_PUBLIC_URL}/search`}
                  className="inline-flex min-h-[48px] items-center justify-center rounded-[12px] bg-[#2B2728] px-5 text-sm font-semibold text-[#FAF7F2] hover:bg-[#1E1E1E]"
                >
                  Browse company pages
                </a>
              </div>
            </div>
            <dl className="divide-y divide-[#E3D9C8] border-y border-[#E3D9C8]">
              {VISITOR_SIDE.map((item) => (
                <div key={item.title} className="py-6">
                  <dt className="text-lg font-bold">{item.title}</dt>
                  <dd className="mt-1.5 leading-relaxed text-[#5E5758]">{item.body}</dd>
                </div>
              ))}
            </dl>
          </div>
          <CompanyPageStrip />
        </section>

        {/* Back to the company's side */}
        <section aria-labelledby="run-title" className="border-t border-white/[0.06]">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
            <h2 id="run-title" className="max-w-[20ch] text-3xl font-bold leading-tight tracking-[-0.03em] sm:text-[40px]">
              Run every card from one place.
            </h2>
            <dl className="mt-12 grid gap-x-12 gap-y-10 md:grid-cols-2">
              {COMPANY_SIDE.map((item) => (
                <div key={item.title} className="border-t border-white/15 pt-5">
                  <dt className="text-lg font-bold">{item.title}</dt>
                  <dd className="mt-2 max-w-[52ch] leading-relaxed text-warm-paper/70">{item.body}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* The network: public, so the visitor's paper again */}
        <section id="network" aria-labelledby="network-title" className="light scroll-mt-16 bg-[#EFE8DC] text-[#2B2728]">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
            <h2 id="network-title" className="max-w-[22ch] text-3xl font-bold leading-tight tracking-[-0.03em] sm:text-[40px]">
              Where businesses find each other.
            </h2>
            <p className="mt-4 max-w-[60ch] text-[#5E5758]">
              Anyone can create a free professional profile, follow companies and people, and start a conversation. Every company page is part of the same directory.
            </p>
            <ul className="mt-12 grid gap-10 md:grid-cols-3">
              {NETWORK.map(({ icon: Icon, title, body }) => (
                <li key={title}>
                  <Icon className="h-6 w-6" aria-hidden="true" />
                  <h3 className="mt-4 text-lg font-bold">{title}</h3>
                  <p className="mt-2 leading-relaxed text-[#5E5758]">{body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Close on the company's side */}
        <section aria-labelledby="start-title" className="border-t border-white/[0.06]">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
            <h2 id="start-title" className="max-w-[16ch] text-[36px] font-bold leading-[1.02] tracking-[-0.04em] sm:text-[56px]">
              Set up your company this afternoon.
            </h2>
            <p className="mt-5 max-w-[52ch] text-lg leading-relaxed text-warm-paper/75">
              Create the company, add seats for your people, pick a template and send the invites. Your first cards can be live today.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/signup" data-testid="home-sign-up-bottom" className={primaryButton}>
                Create free account
              </Link>
              <Link href="/login" className={secondaryButton}>
                Sign in
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/[0.06] bg-[#0F0E0F]">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 text-sm text-warm-paper/65 sm:px-6 md:flex-row md:items-center md:justify-between">
          <span className="flex items-center gap-2.5 font-semibold text-warm-paper">
            <SpanMark className="h-6 w-6" />
            OneBridge Grid
          </span>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-2">
            <a href={`${WEB_PUBLIC_URL}/search`} className="flex min-h-[44px] items-center px-2 hover:text-warm-paper">
              Find companies
            </a>
            <a href={`${WEB_PUBLIC_URL}/terms`} className="flex min-h-[44px] items-center px-2 hover:text-warm-paper">
              Terms of Service
            </a>
            <a href={`${WEB_PUBLIC_URL}/privacy`} className="flex min-h-[44px] items-center px-2 hover:text-warm-paper">
              Privacy Policy
            </a>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="flex min-h-[44px] items-center px-2 hover:text-warm-paper">
              Contact us
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}

/** A slice of a company page as a visitor sees it: branches with directions and per-product enquiries. */
function CompanyPageStrip() {
  const products = [
    { name: 'FE 550D TMT rebars', price: '₹54,000 / MT' },
    { name: 'Structural angles and channels', price: '₹58,500 / MT' },
  ];
  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 lg:pb-24" aria-hidden="true">
      <div className="grid gap-4 rounded-[20px] border border-[#E3D9C8] bg-white p-4 sm:p-6 md:grid-cols-[1.4fr_1fr]">
        <div>
          <p className="text-sm font-semibold text-[#5E5758]">Products</p>
          <ul className="mt-3 divide-y divide-[#EFE8DC]">
            {products.map((p) => (
              <li key={p.name} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-bold">{p.name}</p>
                  <p className="text-sm text-[#5E5758]">{p.price}</p>
                </div>
                <span className="rounded-[10px] bg-bridge-orange px-3.5 py-2 text-sm font-bold text-[#241A10]">Send enquiry</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-[14px] bg-[#FAF7F2] p-4">
          <p className="text-sm font-semibold text-[#5E5758]">Branches</p>
          <ul className="mt-3 space-y-3 text-sm">
            <li className="flex items-start gap-2.5">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <span className="block font-bold">Pune head office</span>
                Bhosari MIDC
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <span className="block font-bold">Chakan works</span>
                Chakan Industrial Area
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <Phone className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Message the company without sharing your number</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
