// quote.ready, English (CONTENT §14).
import { COMPANY_SHORT } from '../../../src/config/brand.js';
import { renderEmail, type RenderedEmail } from '../layout.js';

export default function render(vars: { ref: string; url: string }): RenderedEmail {
  return renderEmail('en', `Your ${COMPANY_SHORT} quote ${vars.ref} is ready`, [
    ['Your price is ready to view and accept: ', { url: vars.url }],
  ]);
}
