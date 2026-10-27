import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Check,
  Globe,
  Inbox,
  QrCode,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'OneBridge Grid | Business cards your company owns',
  description:
    'Verified digital business cards for every employee, a public company page, and leads that stay with your business when people move on.',
};

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

const WEB_PUBLIC_URL = process.env.NEXT_PUBLIC_WEB_PUBLIC_URL ?? 'http://localhost:3001';
const DEMO_COMPANY_URL = `${WEB_PUBLIC_URL}/sahyadri-steel-works`;

const FEATURES = [
  {
    icon: Building2,
    title: 'Cards belong to the seat',
    body: 'Each card lives on a seat in your company, not on a person’s phone. When someone moves on, the seat, the card link and every lead stay with you.',
  },
  {
    icon: BadgeCheck,
    title: 'Verified Business ID',
    body: 'Every company gets a permanent Business ID. Verified companies show a badge on every card, so visitors know the card is genuine.',
  },
  {
    icon: Inbox,
    title: 'Leads that stay',
    body: 'Visitors share their details from a card or the company page. Phone numbers are encrypted, and each lead is routed to the right person.',
  },
  {
    icon: Globe,
    title: 'A company page that sells',
    body: 'Products with prices, services, past work, branches with directions, your team and brochures. Every product has its own enquiry button.',
  },
  {
    icon: QrCode,
    title: 'QR codes and standees',
    body: 'Print a QR standee for every branch and event. Each code tells you where the visitor came from.',
  },
  {
    icon: ShieldCheck,
    title: 'Brand control',
    body: 'Set the logo, colours and template once. Lock the fields employees should not change, and see every change in the audit log.',
  },
];

const STEPS = [
  { icon: Users, title: 'Add your people', body: 'Create a seat for each role and branch. Invite people by phone number.' },
  { icon: UserPlus, title: 'Publish their cards', body: 'Pick a template, approve the details and share the link, QR code or NFC tap.' },
  { icon: Inbox, title: 'Watch the results', body: 'See views, saved contacts and new leads for each card and branch, every day.' },
];

const PLANS = [
  {
    name: 'Starter',
    price: '₹199',
    annual: '₹159 a month billed yearly',
    points: ['1 to 25 seats', '1 branch', 'Company page with 50 catalogue items', 'Leads and QR codes'],
  },
  {
    name: 'Business',
    price: '₹349',
    annual: '₹279 a month billed yearly',
    points: ['10 to 1,000 seats', 'Unlimited branches', 'Unlimited catalogue items', 'Enquiry routing by branch'],
    featured: true,
  },
];

/** A static preview of a visitor card, drawn with the same shapes as the real one. */
function CardPreview() {
  return (
    <div aria-hidden="true" className="relative mx-auto w-[300px] sm:w-[320px]">
      <div className="absolute -inset-8 rounded-[48px] bg-bridge-orange/20 blur-3xl" />
      <div className="relative rounded-[36px] border border-white/10 bg-[#141213] p-3 shadow-[0_30px_80px_rgba(0,0,0,0.5)]">
        <div className="overflow-hidden rounded-[26px] bg-warm-paper text-charcoal">
          <div className="relative bg-[#1F3A5F] px-5 pt-5 pb-6 text-[#FAF7F2]">
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] opacity-80">Sahyadri Steel Works</p>
            <div className="mt-4 flex h-16 w-16 items-center justify-center rounded-[18px] bg-[#9FC3E8] text-xl font-extrabold text-[#241A10]">RD</div>
            <p className="mt-3 text-2xl font-bold tracking-[-0.03em]">Rohit Deshmukh</p>
            <p className="text-sm opacity-90">Head of sales</p>
            <div className="mt-3 flex items-center gap-2 text-xs font-semibold">
              <span className="rounded bg-bridge-orange px-1.5 py-0.5 text-[10px] font-bold text-[#241A10]">Verified</span>
              <span className="opacity-90">Pune head office</span>
            </div>
            <span className="absolute inset-x-0 bottom-0 h-[5px] bg-bridge-orange" />
          </div>
          <div className="grid grid-cols-4 gap-1.5 bg-white p-3">
            {['Call', 'WhatsApp', 'Email', 'Website'].map((label) => (
              <div key={label} className="flex h-12 items-center justify-center rounded-lg bg-[#F4EFE6] text-[10px] font-bold">
                {label}
              </div>
            ))}
          </div>
          <div className="space-y-2 px-3 pb-3">
            <div className="rounded-xl bg-[#2A2627] p-3 text-[11px] font-bold text-warm-paper">Share your details with Rohit</div>
            <div className="flex h-11 items-center justify-center rounded-xl bg-bridge-orange text-sm font-extrabold text-charcoal">Save contact</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-charcoal-deep text-warm-paper">
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-charcoal-deep/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="flex min-h-[44px] items-center gap-2.5 font-bold">
            <SpanMark />
            OneBridge Grid
          </Link>
          <nav aria-label="Main" className="hidden items-center gap-1 text-sm font-semibold text-warm-paper/70 md:flex">
            <a href="#features" className="flex min-h-[44px] items-center px-3 hover:text-warm-paper">
              Features
            </a>
            <a href="#how" className="flex min-h-[44px] items-center px-3 hover:text-warm-paper">
              How it works
            </a>
            <a href="#pricing" className="flex min-h-[44px] items-center px-3 hover:text-warm-paper">
              Pricing
            </a>
            <a href={`${WEB_PUBLIC_URL}/search`} className="flex min-h-[44px] items-center px-3 hover:text-warm-paper">
              Find companies
            </a>
          </nav>
          <Link
            href="/login"
            data-testid="home-sign-in"
            className="flex min-h-[44px] items-center rounded-[10px] border border-white/15 px-4 text-sm font-bold hover:bg-white/10"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-14 pb-20 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pt-20">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-warm-paper/80">
                <span className="h-1.5 w-1.5 rounded-full bg-bridge-orange" />
                Made for Indian businesses
              </p>
              <h1 className="mt-5 text-[40px] font-bold leading-[1.02] tracking-[-0.04em] sm:text-[56px] lg:text-[64px]">
                Business cards your company owns.
              </h1>
              <p className="mt-5 max-w-[54ch] text-lg leading-relaxed text-warm-paper/70">
                Give every employee a verified digital card and your company a page that brings in enquiries. When people move on, the card, the contacts and the
                leads stay with you.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/login"
                  data-testid="home-open-demo"
                  className="inline-flex min-h-[52px] items-center gap-2 rounded-[14px] bg-bridge-orange px-6 text-[15px] font-extrabold text-charcoal shadow-[0_8px_24px_rgba(246,135,19,0.35)] hover:bg-[#E5790C]"
                >
                  Open the demo
                  <ArrowRight className="h-5 w-5" aria-hidden="true" />
                </Link>
                <a
                  href={DEMO_COMPANY_URL}
                  className="inline-flex min-h-[52px] items-center gap-2 rounded-[14px] border border-white/15 px-6 text-[15px] font-bold hover:bg-white/10"
                >
                  See a company page
                </a>
              </div>
              <dl className="mt-10 grid max-w-md grid-cols-3 gap-6 border-t border-white/10 pt-6">
                {[
                  ['1 seat', 'per role, not per person'],
                  ['8', 'card templates'],
                  ['2', 'languages: English and Hindi'],
                ].map(([value, text]) => (
                  <div key={text} className="flex flex-col">
                    <dt className="order-2 mt-1 text-xs leading-snug text-warm-paper/60">{text}</dt>
                    <dd className="order-1 text-2xl font-bold tracking-tight">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <CardPreview />
          </div>
        </section>

        <section id="features" aria-labelledby="features-title" className="scroll-mt-16 border-t border-white/[0.06] bg-[#1E1B1C]">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <h2 id="features-title" className="max-w-[20ch] text-3xl font-bold tracking-[-0.03em] sm:text-4xl">
              Everything a sales team hands out, in one place.
            </h2>
            <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <li key={title} className="rounded-[18px] border border-white/[0.08] bg-charcoal p-6">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-bridge-orange">
                    <Icon className="h-5 w-5 text-[#241A10]" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-lg font-bold">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-warm-paper/65">{body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="how" aria-labelledby="how-title" className="scroll-mt-16 border-t border-white/[0.06]">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <h2 id="how-title" className="text-3xl font-bold tracking-[-0.03em] sm:text-4xl">
              Live in an afternoon.
            </h2>
            <ol className="mt-10 grid gap-4 md:grid-cols-3">
              {STEPS.map(({ icon: Icon, title, body }, i) => (
                <li key={title} className="relative rounded-[18px] border border-white/[0.08] bg-charcoal p-6">
                  <span className="font-mono text-xs font-bold text-warm-paper/50">Step {i + 1}</span>
                  <Icon className="mt-3 h-6 w-6" aria-hidden="true" />
                  <h3 className="mt-3 text-lg font-bold">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-warm-paper/65">{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="pricing" aria-labelledby="pricing-title" className="scroll-mt-16 border-t border-white/[0.06] bg-[#1E1B1C]">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <h2 id="pricing-title" className="text-3xl font-bold tracking-[-0.03em] sm:text-4xl">
              Simple pricing per seat.
            </h2>
            <p className="mt-3 text-warm-paper/65">Prices are per seat per month and exclude 18% GST. Enterprise plans from 100 seats: talk to us.</p>
            <ul className="mt-10 grid max-w-4xl gap-4 md:grid-cols-2">
              {PLANS.map((plan) => (
                <li
                  key={plan.name}
                  className={`rounded-[18px] p-6 ${plan.featured ? 'border-2 border-bridge-orange bg-charcoal' : 'border border-white/[0.08] bg-charcoal'}`}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold">{plan.name}</h3>
                    {plan.featured ? (
                      <span className="rounded-full bg-bridge-orange px-2.5 py-1 text-xs font-bold text-[#241A10]">Most teams</span>
                    ) : null}
                  </div>
                  <p className="mt-4">
                    <span className="text-4xl font-bold tracking-tight">{plan.price}</span>
                    <span className="text-sm text-warm-paper/60"> per seat a month</span>
                  </p>
                  <p className="mt-1 text-xs text-warm-paper/55">{plan.annual}</p>
                  <ul className="mt-5 space-y-2.5 text-sm">
                    {plan.points.map((point) => (
                      <li key={point} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                        {point}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-t border-white/[0.06]">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 py-16 sm:px-6 md:flex-row md:items-center">
            <div>
              <h2 className="text-2xl font-bold tracking-[-0.03em] sm:text-3xl">See it with a real company.</h2>
              <p className="mt-2 text-warm-paper/65">The demo opens Sahyadri Steel Works, a fictional steel trader with three branches and seven cards.</p>
            </div>
            <Link
              href="/login"
              className="inline-flex min-h-[52px] shrink-0 items-center gap-2 rounded-[14px] bg-bridge-orange px-6 text-[15px] font-extrabold text-charcoal hover:bg-[#E5790C]"
            >
              Open the demo
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-warm-paper/55 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span className="flex items-center gap-2">
            <SpanMark className="h-6 w-6" />
            OneBridge Grid
          </span>
          <span>Company-owned digital business cards</span>
        </div>
      </footer>
    </div>
  );
}
