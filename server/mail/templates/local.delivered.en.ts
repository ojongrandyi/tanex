// local.delivered, English (CONTENT §14; email subject added with G.8, owner to confirm).
import { COMPANY_SHORT } from '../../../src/config/brand.js';
import { renderEmail, type RenderedEmail } from '../layout.js';

export default function render(vars: { id: string; masked: string; time: string; link: string }): RenderedEmail {
  return renderEmail('en', `Delivered: ${vars.id}`, [
    [`Delivered: ${vars.id} was received by ${vars.masked} at ${vars.time}. Thank you for choosing ${COMPANY_SHORT}.`],
    ['Details: ', { url: vars.link }],
  ]);
}
