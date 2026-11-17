// booking.confirmed, English (CONTENT §14; email subject added with G.8, owner to confirm).
import { COMPANY_SHORT } from '../../../src/config/brand.js';
import { renderEmail, type RenderedEmail } from '../layout.js';

export default function render(vars: { name: string; id: string; link: string }): RenderedEmail {
  return renderEmail('en', `Your ${COMPANY_SHORT} booking ${vars.id} is confirmed`, [
    [`Hello ${vars.name}, your ${COMPANY_SHORT} booking is confirmed. Tracking ID: ${vars.id}. Follow it here: `, { url: vars.link }],
  ]);
}
