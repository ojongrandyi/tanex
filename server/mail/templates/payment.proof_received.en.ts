// payment.proof_received, English (CONTENT §14, owner to confirm): to MAIL_STAFF_ALERTS_TO.
import { renderEmail, type RenderedEmail } from '../layout.js';

export default function render(vars: { id: string; url: string }): RenderedEmail {
  return renderEmail('en', `Proof of payment received for ${vars.id}`, [
    [`A customer uploaded a proof of payment for ${vars.id}. Check it in the console under Payments: `, { url: vars.url }]
  ]);
}
