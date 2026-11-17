// payment.confirmed, English (CONTENT §14).
import { renderEmail, type RenderedEmail } from '../layout.js';

export default function render(vars: { id: string; reason: string }): RenderedEmail {
  return renderEmail('en', `Payment received for ${vars.id}`, [
    [`Thank you. We've confirmed your payment for ${vars.reason}.`],
  ]);
}
