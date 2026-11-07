// quote.received, English (CONTENT §14).
import { renderEmail, type RenderedEmail } from '../layout.js';

export default function render(vars: { name: string; ref: string; url: string }): RenderedEmail {
  return renderEmail('en', `We've received your quote request ${vars.ref}`, [
    [`Thank you, ${vars.name}. Our team will review your request and send you a price. View it any time: `, { url: vars.url }]
  ]);
}
