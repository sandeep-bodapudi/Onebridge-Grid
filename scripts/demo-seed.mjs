#!/usr/bin/env node
/**
 * Seeds the prototype demo company through the public APIs (never direct DB
 * writes), so events, read models and encryption behave exactly as in use.
 *
 *   node scripts/demo-seed.mjs            # against the local `pnpm dev` stack
 *   IDENTITY_URL=... ORGANIZATION_URL=... CARDS_URL=... WEB_PUBLIC_URL=... node scripts/demo-seed.mjs
 *
 * Idempotent: if the demo owner already has a company, it prints the details and stops.
 * Requires the fake OTP provider (ENABLE_FAKE_OTP=true, code 123456): this is demo data only.
 * All people, phone numbers and companies below are fictional.
 */

const IDENTITY = process.env.IDENTITY_URL || 'http://localhost:4001';
const ORGANIZATION = process.env.ORGANIZATION_URL || 'http://localhost:4002';
const CARDS = process.env.CARDS_URL || 'http://localhost:4003';
const WEB_PUBLIC = process.env.WEB_PUBLIC_URL || 'http://localhost:3001';
const APP_ORIGIN = process.env.APP_URL || 'http://localhost:3000';
const OWNER_PHONE = process.env.DEMO_OWNER_PHONE || '+919988776655';
const OTP = process.env.DEMO_OTP || '123456';

const log = (msg) => console.log(`[demo-seed] ${msg}`);

async function call(method, url, { token, tenantId, body, origin = APP_ORIGIN } = {}) {
  const headers = { Origin: origin };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  if (tenantId) headers['X-Tenant-Id'] = tenantId;
  const res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = text;
  }
  if (!res.ok) {
    throw new Error(`${method} ${url} -> ${res.status} ${typeof data === 'object' ? data?.detail || data?.title || '' : ''}`);
  }
  return data;
}

async function signIn(phone) {
  await call('POST', `${IDENTITY}/auth/otp`, { body: { phone } });
  const verified = await call('POST', `${IDENTITY}/auth/verify`, { body: { phone, code: OTP } });
  if (!verified?.accessToken) throw new Error('Sign-in failed: is ENABLE_FAKE_OTP=true on identity?');
  return verified.accessToken;
}

const BRANCHES = [
  { key: 'pune', name: 'Pune head office', address: { line1: 'Plot 14, Sector 10, Bhosari MIDC', city: 'Pune', state: 'Maharashtra', pincode: '411026' } },
  { key: 'chakan', name: 'Chakan works', address: { line1: 'Gat 212, Chakan Industrial Area Phase II', city: 'Pune', state: 'Maharashtra', pincode: '410501' } },
  { key: 'nashik', name: 'Nashik depot', address: { line1: 'D-41, Ambad MIDC', city: 'Nashik', state: 'Maharashtra', pincode: '422010' } },
];

const PRODUCTS = {
  type: 'products',
  items: [
    { name: 'FE 550D TMT rebars', description: '8 mm to 32 mm, IS 1786 certified', price: '₹54,000 / MT' },
    { name: 'Structural angles and channels', description: 'Mild steel, cut to length', price: '₹58,500 / MT' },
    { name: 'Binding wire', description: '18 and 20 gauge, 25 kg coils', price: '₹72 / kg' },
  ],
};

const SERVICES = {
  items: [
    { name: 'Site delivery across Maharashtra', description: 'Same-week dispatch for orders above 10 MT' },
    { name: 'Bar bending schedules', description: 'Cut and bend to drawing at our Chakan works' },
  ],
};

const PEOPLE = [
  { title: 'Founder and managing director', name: 'Priya Kulkarni', phone: '9988776655', email: 'priya@sahyadristeel.example', branch: 'pune', template: 'classic-charcoal', owner: true, bio: 'Second-generation steel trader. We supply TMT bars and structural steel to builders and EPC contractors across Maharashtra.', extra: ['products', 'services'] },
  { title: 'Head of sales', name: 'Rohit Deshmukh', phone: '9822012345', email: 'rohit@sahyadristeel.example', branch: 'pune', template: 'bridge-orange', bio: 'Dealer network and project sales for Western Maharashtra. Call me for rates and same-week delivery.', extra: ['products'] },
  { title: 'Key account manager', name: 'Ananya Joshi', phone: '9765432109', email: 'ananya@sahyadristeel.example', branch: 'pune', template: 'arch-minimal', bio: 'Infrastructure and EPC accounts: metro, highway and industrial projects.', extra: ['products'] },
  { title: 'Plant manager', name: 'Sanjay Patil', phone: '9850011223', email: 'sanjay@sahyadristeel.example', branch: 'chakan', template: 'grid-mono', bio: 'Runs our Chakan cutting and bending works. Site visits by appointment.', extra: ['services'] },
  { title: 'Sales executive', name: 'Meera Iyer', phone: '9890123456', email: 'meera@sahyadristeel.example', branch: 'chakan', template: 'paper-light', bio: 'Retail and small builders in Pimpri-Chinchwad and Chakan.', extra: ['products'] },
  { title: 'Depot in charge', name: 'Vikas Shinde', phone: '9823344556', email: 'vikas@sahyadristeel.example', branch: 'nashik', template: 'enterprise-blue', bio: 'Stock and dispatch for Nashik and North Maharashtra.', extra: [] },
  { title: 'Accounts manager', name: 'Kavita Rao', phone: '9821199887', email: 'kavita@sahyadristeel.example', branch: 'pune', template: 'sand-warm', bio: 'Billing, GST invoices and credit terms for dealers.', extra: [] },
  { title: 'Business development', name: 'Arjun Mehta', phone: '9876501234', email: 'arjun@sahyadristeel.example', branch: 'nashik', template: 'keystone-dark', bio: 'New dealers and builders in Nashik, Dhule and Jalgaon.', extra: ['products'], draft: true },
];

const LEADS = [
  { person: 1, name: 'Rahul Mehta', phone: '9822099999', company: 'Mehta Builders', note: 'Need 40 MT of 12 mm for a G+7 project', sourceTag: 'pune_expo_2026' },
  { person: 1, name: 'Sneha Wagh', phone: '9767012345', company: 'Wagh Constructions', sourceTag: 'pune_expo_2026' },
  { person: 2, name: 'Imran Shaikh', phone: '9881234567', company: 'Shaikh Infra Projects', note: 'Metro station package, call after 4 pm' },
  { person: 0, name: 'Deepak Jadhav', phone: '9960011122', company: 'Jadhav Developers' },
];

async function main() {
  log(`Signing in the demo owner ${OWNER_PHONE.replace(/\d(?=\d{4})/g, '•')}`);
  const token = await signIn(OWNER_PHONE);
  const me = await call('GET', `${IDENTITY}/me`, { token });
  const existing = me.activeTenant?.tenantId || me.activeTenant?.id;
  if (existing) {
    const org = await call('GET', `${ORGANIZATION}/orgs/${existing}`, { token, tenantId: existing });
    log(`Demo company already exists: ${org.name} (${org.businessId}). Nothing to do.`);
    return;
  }

  const org = await call('POST', `${ORGANIZATION}/orgs`, {
    token,
    body: { name: 'Sahyadri Steel Works', industry: 'Manufacturing', size: '51-200', city: 'Pune', plan: 'business' },
  });
  const T = { token, tenantId: org.id };
  log(`Created ${org.name} (${org.businessId})`);

  await call('PATCH', `${ORGANIZATION}/orgs/${org.id}/brand`, {
    ...T,
    body: { brandColours: { band: '#1F3A5F', accent: '#F68713', text: '#FAF7F2' } },
  }).catch((err) => log(`Brand colours skipped: ${err.message}`));

  const branchIds = {};
  for (const b of BRANCHES) {
    const branch = await call('POST', `${ORGANIZATION}/orgs/${org.id}/branches`, { ...T, body: { name: b.name, address: b.address } });
    branchIds[b.key] = branch.id;
  }
  log(`Added ${BRANCHES.length} branches`);

  const departments = await call('POST', `${ORGANIZATION}/orgs/${org.id}/departments/defaults`, T).catch(() => []);
  const sales = (Array.isArray(departments) ? departments : []).find((d) => /sales/i.test(d.name));
  if (sales) {
    for (const name of ['Dealer sales', 'Project sales']) {
      await call('POST', `${ORGANIZATION}/orgs/${org.id}/teams`, { ...T, body: { name, departmentId: sales.id } }).catch(() => undefined);
    }
  }
  log('Added departments and sales teams');

  const cards = [];
  for (const p of PEOPLE) {
    const seat = await call('POST', `${ORGANIZATION}/orgs/${org.id}/seats`, {
      ...T,
      body: { title: p.title, branchId: branchIds[p.branch], personId: p.owner ? me.person.id : undefined },
    });
    // The cards service creates the draft card from seat.created.
    let card;
    for (let attempt = 0; attempt < 10 && !card; attempt++) {
      card = await call('GET', `${CARDS}/cards/${seat.id}`, T).catch(() => undefined);
      if (!card) await new Promise((r) => setTimeout(r, 300));
    }
    if (!card) throw new Error(`No card was created for seat ${seat.id}`);
    const sections = card.sections.map((s) => {
      if (s.type === 'about') return { ...s, content: { name: p.name, designation: p.title, phone: p.phone, email: p.email, bio: p.bio } };
      if (s.type === 'products' && p.extra.includes('products')) return { ...s, enabled: true, content: { items: PRODUCTS.items } };
      if (s.type === 'services' && p.extra.includes('services')) return { ...s, enabled: true, content: { items: SERVICES.items } };
      if (s.type === 'company_info') return { ...s, content: { gstin: '27AABCS1429B1Z8' } };
      return s;
    });
    await call('PATCH', `${CARDS}/cards/${card.id}`, { ...T, body: { templateId: p.template, sections } });
    const final = p.draft ? card : await call('POST', `${CARDS}/cards/${card.id}/publish`, T);
    cards.push({ ...p, id: card.id, slug: final.slug || card.slug });
  }
  log(`Created ${PEOPLE.length} seats with cards (${PEOPLE.filter((p) => !p.draft).length} published)`);

  // An event QR for the sales head, so lead sources show up in the demo.
  await call('POST', `${CARDS}/cards/${cards[1].id}/qr`, { ...T, body: { source: 'pune_expo_2026', label: 'Pune builders expo 2026, stall B12' } }).catch(
    (err) => log(`Event QR skipped: ${err.message}`)
  );

  // Card views and contact saves through the analytics ingestion path.
  const events = [];
  cards
    .filter((c) => !c.draft)
    .forEach((c, i) => {
      const views = [42, 31, 18, 12, 9, 7, 5][i] ?? 3;
      for (let v = 0; v < views; v++) events.push({ eventType: 'card_viewed', cardId: c.id, slug: c.slug, source: v % 3 === 0 ? 'qr' : 'link' });
      for (let s = 0; s < Math.round(views / 4); s++) events.push({ eventType: 'contact_saved', cardId: c.id, slug: c.slug });
    });
  for (let i = 0; i < events.length; i += 100) {
    await call('POST', `${CARDS}/analytics/events`, { body: events.slice(i, i + 100) });
  }
  log(`Recorded ${events.length} analytics events`);

  let leadCount = 0;
  for (const lead of LEADS) {
    const card = cards[lead.person];
    const qs = lead.sourceTag ? `?source=qr&sourceTag=${encodeURIComponent(lead.sourceTag)}` : '';
    try {
      await call('POST', `${CARDS}/public/c/${card.slug}/shareback${qs}`, {
        origin: WEB_PUBLIC,
        body: { name: lead.name, phone: lead.phone, company: lead.company, note: lead.note, consent: true, turnstileToken: 'demo' },
      });
      leadCount++;
    } catch (err) {
      log(`Lead for ${card.name} skipped: ${err.message}`);
    }
  }
  log(`Created ${leadCount} share-back leads`);

  log('Done.');
  log(`Dashboard: sign in with ${OWNER_PHONE} and code ${OTP}`);
  log(`Visitor card: ${WEB_PUBLIC}/c/${cards[1].slug}`);
}

main().catch((err) => {
  console.error(`[demo-seed] Failed: ${err.message}`);
  process.exit(1);
});
