import { EmailMessage } from './email-sender.js';

/** D-AUTH-EMAIL: sign-in emails. Plain layout, the code large, expiry stated, no sign-in links. */
export type EmailTemplate =
  | 'verification_code'
  | 'login_code'
  | 'password_reset_code'
  | 'link_code'
  | 'signup_on_existing_account'
  | 'new_device_sign_in'
  | 'password_changed'
  | 'google_linked'
  | 'seat_invite';

export type EmailLanguage = 'en' | 'hi';

export interface TemplateVars {
  code?: string;
  minutes?: number;
  name?: string;
  device?: string;
  /** seat_invite only: the one link these emails ever carry. */
  url?: string;
  companyName?: string;
  seatTitle?: string;
  days?: number;
}

interface Copy {
  subject: string;
  intro: string;
  /** Shown under the code, or alone when there is no code. */
  note: string;
}

type Strings = Record<EmailTemplate, (v: TemplateVars) => Copy> & { hello: (name?: string) => string; notYou: string; brand: string };

const en: Strings = {
  brand: 'OneBridge',
  hello: (name) => (name ? `Hello ${name},` : 'Hello,'),
  notYou: "If this wasn't you, ignore this email. Your account stays safe.",
  verification_code: (v) => ({
    subject: `${v.code} is your OneBridge verification code`,
    intro: 'Enter this code to finish creating your OneBridge account.',
    note: `The code works for ${v.minutes} minutes.`,
  }),
  login_code: (v) => ({
    subject: `${v.code} is your OneBridge sign-in code`,
    intro: 'Someone is signing in to your OneBridge account from a new device. Enter this code to continue.',
    note: `The code works for ${v.minutes} minutes. OneBridge never asks for it by phone or chat.`,
  }),
  password_reset_code: (v) => ({
    subject: `${v.code} is your OneBridge password reset code`,
    intro: 'Enter this code to choose a new password.',
    note: `The code works for ${v.minutes} minutes.`,
  }),
  link_code: (v) => ({
    subject: `${v.code} is your code to connect Google to OneBridge`,
    intro: 'Enter this code to connect your Google account to your OneBridge account.',
    note: `The code works for ${v.minutes} minutes.`,
  }),
  signup_on_existing_account: () => ({
    subject: 'You already have a OneBridge account',
    intro: 'Someone tried to create a OneBridge account with this email, but you already have one.',
    note: 'To get in, sign in with your password or with Google. If you forgot your password, choose "Forgot password?" on the sign-in page.',
  }),
  new_device_sign_in: (v) => ({
    subject: 'New sign-in to your OneBridge account',
    intro: `Your account was just signed in on a new device${v.device ? `: ${v.device}` : ''}.`,
    note: "If this was you, there's nothing to do. If not, change your password now.",
  }),
  password_changed: () => ({
    subject: 'Your OneBridge password was changed',
    intro: 'The password for your OneBridge account was just changed, and other devices were signed out.',
    note: "If you didn't do this, reset your password now from the sign-in page and contact support.",
  }),
  google_linked: () => ({
    subject: 'Google is now connected to your OneBridge account',
    intro: 'You can now sign in to OneBridge with Google as well as your password.',
    note: "If you didn't do this, change your password now and contact support.",
  }),
  seat_invite: (v) => ({
    subject: `${v.companyName} invited you to your OneBridge card`,
    intro: `${v.companyName} has set up a digital business card for you as ${v.seatTitle}. Open the invite to claim it, signing in with this email address.`,
    note: `The invite works for ${v.days} days.`,
  }),
};

const hi: Strings = {
  brand: 'OneBridge',
  hello: (name) => (name ? `नमस्ते ${name},` : 'नमस्ते,'),
  notYou: 'अगर यह आपने नहीं किया, तो इस ईमेल को अनदेखा करें। आपका खाता सुरक्षित है।',
  verification_code: (v) => ({
    subject: `${v.code} आपका OneBridge सत्यापन कोड है`,
    intro: 'अपना OneBridge खाता बनाना पूरा करने के लिए यह कोड डालें।',
    note: `यह कोड ${v.minutes} मिनट तक काम करेगा।`,
  }),
  login_code: (v) => ({
    subject: `${v.code} आपका OneBridge साइन-इन कोड है`,
    intro: 'कोई नए डिवाइस से आपके OneBridge खाते में साइन इन कर रहा है। जारी रखने के लिए यह कोड डालें।',
    note: `यह कोड ${v.minutes} मिनट तक काम करेगा। OneBridge यह कोड कभी फ़ोन या चैट पर नहीं माँगता।`,
  }),
  password_reset_code: (v) => ({
    subject: `${v.code} आपका OneBridge पासवर्ड रीसेट कोड है`,
    intro: 'नया पासवर्ड चुनने के लिए यह कोड डालें।',
    note: `यह कोड ${v.minutes} मिनट तक काम करेगा।`,
  }),
  link_code: (v) => ({
    subject: `${v.code} Google को OneBridge से जोड़ने का कोड है`,
    intro: 'अपने Google खाते को OneBridge खाते से जोड़ने के लिए यह कोड डालें।',
    note: `यह कोड ${v.minutes} मिनट तक काम करेगा।`,
  }),
  signup_on_existing_account: () => ({
    subject: 'आपका OneBridge खाता पहले से है',
    intro: 'किसी ने इस ईमेल से OneBridge खाता बनाने की कोशिश की, लेकिन आपका खाता पहले से है।',
    note: 'अपने पासवर्ड या Google से साइन इन करें। पासवर्ड भूल गए हों, तो साइन-इन पेज पर "पासवर्ड भूल गए?" चुनें।',
  }),
  new_device_sign_in: (v) => ({
    subject: 'आपके OneBridge खाते में नया साइन-इन',
    intro: `आपके खाते में अभी एक नए डिवाइस से साइन इन हुआ${v.device ? `: ${v.device}` : ''}।`,
    note: 'अगर यह आप थे, तो कुछ करने की ज़रूरत नहीं। अगर नहीं, तो अभी अपना पासवर्ड बदलें।',
  }),
  password_changed: () => ({
    subject: 'आपका OneBridge पासवर्ड बदल दिया गया',
    intro: 'आपके OneBridge खाते का पासवर्ड अभी बदला गया, और बाकी डिवाइस से साइन आउट कर दिया गया।',
    note: 'अगर यह आपने नहीं किया, तो साइन-इन पेज से अभी पासवर्ड रीसेट करें और सहायता से संपर्क करें।',
  }),
  google_linked: () => ({
    subject: 'Google अब आपके OneBridge खाते से जुड़ गया है',
    intro: 'अब आप पासवर्ड के साथ-साथ Google से भी OneBridge में साइन इन कर सकते हैं।',
    note: 'अगर यह आपने नहीं किया, तो अभी अपना पासवर्ड बदलें और सहायता से संपर्क करें।',
  }),
  seat_invite: (v) => ({
    subject: `${v.companyName} ने आपको OneBridge कार्ड के लिए आमंत्रित किया है`,
    intro: `${v.companyName} ने ${v.seatTitle} के रूप में आपके लिए एक डिजिटल बिज़नेस कार्ड बनाया है। इसे लेने के लिए आमंत्रण खोलें और इसी ईमेल पते से साइन इन करें।`,
    note: `यह आमंत्रण ${v.days} दिन तक काम करेगा।`,
  }),
};

const STRINGS: Record<EmailLanguage, Strings> = { en, hi };

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

/** Renders one template for one recipient. Unknown languages fall back to English. */
export function renderEmail(template: EmailTemplate, to: string, vars: TemplateVars = {}, language: string = 'en'): EmailMessage {
  const s = STRINGS[(language === 'hi' ? 'hi' : 'en') as EmailLanguage];
  const v: TemplateVars = { minutes: 10, ...vars };
  const copy = s[template](v);
  const hello = s.hello(v.name);

  const text = [hello, '', copy.intro, '', ...(v.code ? [v.code, ''] : []), ...(v.url ? [v.url, ''] : []), copy.note, '', s.notYou, '', `— ${s.brand}`].join('\n');

  const e = escapeHtml;
  const codeBlock = v.code
    ? `<p style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:32px;letter-spacing:6px;font-weight:700;margin:24px 0;color:#111827">${e(v.code)}</p>`
    : '';
  const linkLabel = language === 'hi' ? 'आमंत्रण खोलें' : 'Open the invite';
  const linkBlock = v.url
    ? `<p style="margin:24px 0"><a href="${e(v.url)}" style="display:inline-block;padding:12px 20px;background:#111827;color:#ffffff;border-radius:6px;text-decoration:none;font-weight:700">${e(linkLabel)}</a></p>`
    : '';
  const html = `<!doctype html><html><body style="margin:0;background:#f5f5f4;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#1f2937">
<div style="max-width:480px;margin:0 auto;padding:32px 24px;background:#ffffff">
<p style="font-weight:700;font-size:18px;margin:0 0 24px">${e(s.brand)}</p>
<p style="margin:0 0 12px">${e(hello)}</p>
<p style="margin:0 0 12px;line-height:1.5">${e(copy.intro)}</p>
${codeBlock}
${linkBlock}
<p style="margin:0 0 12px;line-height:1.5">${e(copy.note)}</p>
<p style="margin:24px 0 0;font-size:13px;color:#6b7280;line-height:1.5">${e(s.notYou)}</p>
</div></body></html>`;

  return { to, subject: copy.subject, text, html, tag: template };
}
