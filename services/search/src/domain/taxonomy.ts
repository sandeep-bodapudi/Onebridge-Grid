/**
 * N03 industry taxonomy, starting with the Hyderabad launch set
 * (manufacturing and business services, D-NETWORK). Ops will manage it in
 * the console (N09); until then it lives here. IDs are stable URL slugs.
 */
export interface Industry {
  id: string;
  name: string;
  nameHi: string;
  /** Words that map a company's free-text industry to this entry. */
  aliases: string[];
  subCategories: Array<{ id: string; name: string; nameHi: string }>;
}

export const INDUSTRIES: Industry[] = [
  {
    id: 'manufacturing',
    name: 'Manufacturing',
    nameHi: 'विनिर्माण',
    aliases: ['manufacturing', 'manufacturer', 'factory', 'industrial', 'steel', 'fabrication', 'machining', 'plastics', 'chemicals', 'pharma', 'textiles', 'packaging'],
    subCategories: [
      { id: 'steel-metals', name: 'Steel and metals', nameHi: 'इस्पात और धातु' },
      { id: 'machining-fabrication', name: 'Machining and fabrication', nameHi: 'मशीनिंग और फ़ैब्रिकेशन' },
      { id: 'auto-components', name: 'Auto components', nameHi: 'ऑटो कंपोनेंट' },
      { id: 'electrical-electronics', name: 'Electrical and electronics', nameHi: 'इलेक्ट्रिकल और इलेक्ट्रॉनिक्स' },
      { id: 'pharma-chemicals', name: 'Pharma and chemicals', nameHi: 'फ़ार्मा और रसायन' },
      { id: 'plastics-packaging', name: 'Plastics and packaging', nameHi: 'प्लास्टिक और पैकेजिंग' },
      { id: 'food-processing', name: 'Food processing', nameHi: 'खाद्य प्रसंस्करण' },
      { id: 'textiles', name: 'Textiles and garments', nameHi: 'वस्त्र और परिधान' },
    ],
  },
  {
    id: 'business-services',
    name: 'Business services',
    nameHi: 'व्यावसायिक सेवाएँ',
    aliases: ['services', 'consulting', 'it', 'software', 'technology', 'logistics', 'staffing', 'marketing', 'finance', 'facility'],
    subCategories: [
      { id: 'it-software', name: 'IT and software', nameHi: 'आईटी और सॉफ़्टवेयर' },
      { id: 'logistics', name: 'Logistics and transport', nameHi: 'लॉजिस्टिक्स और परिवहन' },
      { id: 'consulting', name: 'Consulting and audit', nameHi: 'परामर्श और ऑडिट' },
      { id: 'staffing', name: 'Staffing and HR', nameHi: 'स्टाफ़िंग और एचआर' },
      { id: 'marketing', name: 'Marketing and design', nameHi: 'मार्केटिंग और डिज़ाइन' },
      { id: 'facility', name: 'Facility management', nameHi: 'फ़ैसिलिटी मैनेजमेंट' },
    ],
  },
  {
    id: 'construction',
    name: 'Construction and infrastructure',
    nameHi: 'निर्माण और इन्फ्रास्ट्रक्चर',
    aliases: ['construction', 'infrastructure', 'real estate', 'builders', 'epc', 'civil'],
    subCategories: [
      { id: 'builders', name: 'Builders and developers', nameHi: 'बिल्डर और डेवलपर' },
      { id: 'epc', name: 'EPC contractors', nameHi: 'ईपीसी ठेकेदार' },
      { id: 'building-materials', name: 'Building materials', nameHi: 'निर्माण सामग्री' },
    ],
  },
  {
    id: 'trading',
    name: 'Trading and distribution',
    nameHi: 'व्यापार और वितरण',
    aliases: ['trading', 'trader', 'distribution', 'distributor', 'wholesale', 'dealer'],
    subCategories: [],
  },
  {
    id: 'retail',
    name: 'Retail',
    nameHi: 'खुदरा',
    aliases: ['retail', 'shop', 'store'],
    subCategories: [],
  },
  {
    id: 'healthcare',
    name: 'Healthcare',
    nameHi: 'स्वास्थ्य सेवा',
    aliases: ['healthcare', 'hospital', 'clinic', 'diagnostics'],
    subCategories: [],
  },
  {
    id: 'education',
    name: 'Education and training',
    nameHi: 'शिक्षा और प्रशिक्षण',
    aliases: ['education', 'training', 'school', 'college', 'institute'],
    subCategories: [],
  },
  {
    id: 'hospitality',
    name: 'Hospitality and food',
    nameHi: 'आतिथ्य और भोजन',
    aliases: ['hospitality', 'hotel', 'restaurant', 'catering'],
    subCategories: [],
  },
];

/** Maps a company's free-text industry (from onboarding) to taxonomy IDs. */
export function industriesFor(text: string | undefined): string[] {
  if (!text) return [];
  const t = text.toLowerCase();
  const exact = INDUSTRIES.find((i) => i.name.toLowerCase() === t || i.id === t);
  if (exact) return [exact.id];
  return INDUSTRIES.filter((i) => i.aliases.some((a) => t.includes(a))).map((i) => i.id).slice(0, 3);
}

export function citySlug(city: string | undefined): string | undefined {
  if (!city) return undefined;
  const slug = city.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return slug || undefined;
}
