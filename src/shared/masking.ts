// Masking of personal details on public pages (tracking, quote look-up). Shared by the server
// and the browser; DOM-free. A masked value lets the owner recognise their own details without
// showing them to someone who only has the reference.

/** "Ada Obi" → "A** O**". Empty → "Customer". */
export function maskName(name: string | null | undefined): string {
  const clean = (name || '').trim();
  if (!clean) return 'Customer';
  return clean
    .split(/\s+/)
    .map((p) => (p.length > 1 ? `${p[0]}${'*'.repeat(Math.min(p.length - 1, 5))}` : p))
    .join(' ');
}

/**
 * Keeps the formatting and the last 3 digits, hides every other digit:
 * "+237 651 05 93 45" → "+••• ••• •• •3 45", "(310) 555-0892" → "(•••) •••-•892".
 * Undefined when there is no phone (no row on the page rather than a fake placeholder).
 */
export function maskPhone(phone: string | null | undefined): string | undefined {
  if (!phone) return undefined;
  const total = (phone.match(/\d/g) || []).length;
  if (total === 0) return undefined;
  let seen = 0;
  return phone.replace(/\d/g, (d) => (++seen > total - 3 ? d : '•'));
}

/** "daniel@example.com" → "da****@example.com". Undefined when it isn't an address. */
export function maskEmail(email: string | null | undefined): string | undefined {
  if (!email || !email.includes('@')) return undefined;
  const at = email.lastIndexOf('@');
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${'*'.repeat(Math.max(local.length - visible.length, 3))}@${domain}`;
}
