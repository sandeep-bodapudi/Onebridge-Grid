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
const PROFILES = process.env.PROFILES_URL || 'http://localhost:4004';
const SOCIAL = process.env.SOCIAL_URL || 'http://localhost:4005';
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

// F26 public company page content. Images are left out so the demo needs no external hosts.
const COMPANY_PAGE = {
  about:
    'Sahyadri Steel Works supplies TMT rebars, structural steel and cut-and-bend services to builders and EPC contractors across Maharashtra. Three locations, same-week delivery.',
  website: 'https://sahyadristeel.example',
  socialLinks: { linkedin: 'https://www.linkedin.com/company/sahyadri-steel-example' },
  products: [
    { id: 'tmt-550d', name: 'FE 550D TMT rebars', category: 'Rebars', description: '8 mm to 32 mm, IS 1786 certified. Mill test certificate with every load.', price: '₹54,000 / MT' },
    { id: 'tmt-500d', name: 'FE 500D TMT rebars', category: 'Rebars', description: 'For residential projects up to G+12.', price: '₹52,500 / MT' },
    { id: 'angles', name: 'Structural angles and channels', category: 'Structural steel', description: 'Mild steel, cut to length at our Chakan works.', price: '₹58,500 / MT' },
    { id: 'beams', name: 'ISMB beams', category: 'Structural steel', description: '100 mm to 600 mm, IS 2062 grade E250.', priceOnRequest: true },
    { id: 'binding-wire', name: 'Binding wire', category: 'Accessories', description: '18 and 20 gauge, 25 kg coils.', price: '₹72 / kg' },
    { id: 'couplers', name: 'Rebar couplers', category: 'Accessories', description: 'Threaded couplers for 16 mm to 40 mm bars.', priceOnRequest: true },
  ],
  services: [
    { id: 'delivery', name: 'Site delivery across Maharashtra', description: 'Same-week dispatch for orders above 10 MT.' },
    { id: 'bbs', name: 'Bar bending schedules', description: 'Cut and bend to drawing at our Chakan works.' },
    { id: 'testing', name: 'Third-party testing', description: 'NABL lab reports arranged on request.' },
  ],
  portfolio: [
    { id: 'metro', title: 'Pune Metro, Line 3 viaduct', client: 'Infrastructure EPC contractor', description: 'Supplied 2,400 MT of FE 550D rebars over 14 months with cut-and-bend at our works.' },
    { id: 'hinjewadi', title: 'Hinjewadi IT park, Phase 2', client: 'Commercial developer', description: 'Structural steel and rebars for four G+10 towers.' },
  ],
  clientLogos: [
    { id: 'c1', name: 'Mehta Builders' },
    { id: 'c2', name: 'Shaikh Infra Projects' },
    { id: 'c3', name: 'Wagh Constructions' },
    { id: 'c4', name: 'Jadhav Developers' },
  ],
  documents: [{ id: 'brochure', title: 'Product brochure 2026', url: 'https://sahyadristeel.example/brochure-2026.pdf', sizeBytes: 2_400_000 }],
};

/** Fills the public company page (F26) through the APIs, if it is still empty. */
async function seedCompanyPage(T, orgId) {
  const current = await call('GET', `${CARDS}/company-profile`, T);
  if (current.products.length > 0) return false;
  await call('PATCH', `${ORGANIZATION}/orgs/${orgId}`, {
    ...T,
    body: { about: COMPANY_PAGE.about, website: COMPANY_PAGE.website, socialLinks: COMPANY_PAGE.socialLinks },
  });
  const [summaries, branches] = await Promise.all([
    call('GET', `${CARDS}/cards`, T).then((r) => r.items || []),
    call('GET', `${ORGANIZATION}/orgs/${orgId}/branches`, T).then((r) => (Array.isArray(r) ? r : r.items || [])),
  ]);
  const seatOf = (name) => {
    const c = summaries.find((x) => x.name === name);
    return c ? c.seatId || c.id : undefined;
  };
  const branchSeats = {};
  const chakan = branches.find((b) => /chakan/i.test(b.name));
  const nashik = branches.find((b) => /nashik/i.test(b.name));
  if (chakan && seatOf('Meera Iyer')) branchSeats[chakan.id] = seatOf('Meera Iyer');
  if (nashik && seatOf('Vikas Shinde')) branchSeats[nashik.id] = seatOf('Vikas Shinde');
  await call('PUT', `${CARDS}/company-profile`, {
    ...T,
    body: {
      seoIndexable: true,
      products: COMPANY_PAGE.products,
      services: COMPANY_PAGE.services,
      portfolio: COMPANY_PAGE.portfolio,
      clientLogos: COMPANY_PAGE.clientLogos,
      documents: COMPANY_PAGE.documents,
      directory: { enabled: true, seatIds: [] },
      enquiryRouting: { defaultSeatId: seatOf('Rohit Deshmukh'), branchSeats },
    },
  });
  return true;
}

// N01 member profiles. All people and numbers are fictional (demo data only).
const MEMBER_NOTICE_VERSION = 'member-notice-2026-10';
const OWNER_PROFILE = {
  name: 'Priya Kulkarni',
  handle: 'priya-kulkarni',
  headline: 'Founder and managing director, Sahyadri Steel Works',
  city: 'Pune',
  about: 'Second-generation steel trader. We supply TMT bars and structural steel to builders and EPC contractors across Maharashtra.',
  skills: ['Structural steel', 'TMT rebars', 'Dealer networks', 'EPC supply'],
  languages: ['English', 'Hindi', 'Marathi'],
  visibility: 'everyone',
  indexable: true,
};
const MEMBERS = [
  {
    phone: '+919700011122',
    profile: {
      name: 'Ravi Teja Reddy',
      handle: 'ravi-teja-reddy',
      headline: 'Procurement manager, infrastructure projects',
      city: 'Hyderabad',
      about: 'I buy structural steel, cement and fabrication services for highway and metro packages in Telangana.',
      skills: ['Procurement', 'Vendor development', 'Structural steel'],
      languages: ['English', 'Telugu', 'Hindi'],
      visibility: 'everyone',
      indexable: false,
    },
    history: [{ companyName: 'Deccan Infra Projects', title: 'Procurement manager', startDate: '2021-04-01' }],
  },
  {
    phone: '+919700033344',
    profile: {
      name: 'Fatima Begum',
      handle: 'fatima-begum',
      headline: 'Quality engineer, precision machining',
      city: 'Hyderabad',
      about: 'Quality systems for CNC machining and fabrication shops. ISO 9001 lead auditor.',
      skills: ['Quality assurance', 'ISO 9001', 'CNC machining'],
      languages: ['English', 'Urdu', 'Telugu'],
      visibility: 'members',
      indexable: false,
    },
    history: [{ companyName: 'Balanagar Precision Works', title: 'Quality engineer', startDate: '2022-07-01' }],
  },
];

/** Creates member profiles through the profiles API, if they do not exist yet. */
async function seedMemberProfiles(ownerToken, orgId, ownerPersonId) {
  const put = (token, body) => call('PUT', `${PROFILES}/me/profile`, { token, body: { ...body, ageConfirmed: true, noticeVersion: MEMBER_NOTICE_VERSION } });
  const exists = (token) => call('GET', `${PROFILES}/me/profile`, { token }).then(() => true, () => false);
  let created = 0;
  if (!(await exists(ownerToken))) {
    await put(ownerToken, OWNER_PROFILE);
    created++;
  }
  for (const m of MEMBERS) {
    const token = await signIn(m.phone);
    if (await exists(token)) continue;
    await put(token, m.profile);
    for (const h of m.history) await call('POST', `${PROFILES}/me/work-history`, { token, body: h });
    // N04: the members follow the demo company, and Ravi follows its founder.
    if (orgId) await call('PUT', `${SOCIAL}/follows/company/${orgId}?source=profile`, { token }).catch(() => undefined);
    if (ownerPersonId && m.profile.handle === 'ravi-teja-reddy') {
      await call('PUT', `${SOCIAL}/follows/member/${ownerPersonId}?source=profile`, { token }).catch(() => undefined);
    }
    created++;
  }
  return created;
}

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
    const filled = await seedCompanyPage({ token, tenantId: existing }, existing).catch((err) => log(`Company page skipped: ${err.message}`));
    await seedMemberProfiles(token, existing, me.person?.id)
      .then((n) => n && log(`Created ${n} member profiles`))
      .catch((err) => log(`Member profiles skipped: ${err.message}`));
    log(`Demo company already exists: ${org.name} (${org.businessId}).${filled ? ' Filled in its company page.' : ' Nothing to do.'}`);
    log(`Company page: ${WEB_PUBLIC}/${org.slug}`);
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

  // Card views and contact saves through the analytics ingestion path, spread over the last
  // four weeks (busier recently) so the dashboard trend and the "vs previous 14 days" change are real.
  const events = [];
  const DAY = 86_400_000;
  const now = Date.now();
  let seed = 42;
  const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  cards
    .filter((c) => !c.draft)
    .forEach((c, i) => {
      const weight = [1.0, 1.35, 0.6, 0.4, 0.3, 0.25, 0.18][i] ?? 0.15;
      for (let day = 27; day >= 0; day--) {
        const recent = day < 14 ? 1.2 : 0.85;
        const weekday = new Date(now - day * DAY).getDay();
        const base = (weekday === 0 ? 0.4 : 1) * 2.6 * weight * recent;
        const views = Math.max(0, Math.round(base + (rand() - 0.5) * 2 * weight));
        for (let v = 0; v < views; v++) {
          const timestamp = new Date(now - day * DAY - Math.floor(rand() * 8) * 3_600_000).toISOString();
          events.push({ eventType: 'card_viewed', cardId: c.id, slug: c.slug, source: rand() < 0.4 ? 'qr' : 'link', timestamp });
          if (rand() < 0.26) events.push({ eventType: 'contact_saved', cardId: c.id, slug: c.slug, timestamp });
        }
      }
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

  await seedCompanyPage(T, org.id)
    .then(() => log('Filled in the company page'))
    .catch((err) => log(`Company page skipped: ${err.message}`));

  await seedMemberProfiles(token, org.id, me.person?.id)
    .then((n) => log(`Created ${n} member profiles and their follows`))
    .catch((err) => log(`Member profiles skipped: ${err.message}`));

  // A company page enquiry about a product, so the company_enquiry source shows up in leads.
  await call('POST', `${CARDS}/public/o/${org.slug}/enquiry`, {
    origin: WEB_PUBLIC,
    body: { name: 'Nikhil Pawar', phone: '9970012345', company: 'Pawar Realty', message: 'Rates for 60 MT, delivery to Wakad', productId: 'tmt-550d', consent: true, turnstileToken: 'demo' },
  }).catch((err) => log(`Company enquiry skipped: ${err.message}`));

  log('Done.');
  log(`Dashboard: sign in with ${OWNER_PHONE} and code ${OTP}`);
  log(`Visitor card: ${WEB_PUBLIC}/c/${cards[1].slug}`);
  log(`Company page: ${WEB_PUBLIC}/${org.slug}`);
  log(`Member profile: ${WEB_PUBLIC}/in/${OWNER_PROFILE.handle}`);
}

main().catch((err) => {
  console.error(`[demo-seed] Failed: ${err.message}`);
  process.exit(1);
});
