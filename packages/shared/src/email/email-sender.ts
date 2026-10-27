/** One outgoing email. `tag` names the template, for logs and metrics; it never holds personal data. */
export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
  tag: string;
}

/** D-AUTH-EMAIL D1: the port every service sends email through. */
export interface EmailSender {
  send(msg: EmailMessage): Promise<{ id: string }>;
}

/** "meera@example.com" -> "m•••@example.com", safe for logs and screens. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at < 1) return '•••';
  return `${email[0]}•••${email.slice(at)}`;
}
