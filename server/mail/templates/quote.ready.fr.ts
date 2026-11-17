// quote.ready, French (CONTENT_FR §14).
import { COMPANY_SHORT } from '../../../src/config/brand.js';
import { renderEmail, type RenderedEmail } from '../layout.js';

export default function render(vars: { ref: string; url: string }): RenderedEmail {
  return renderEmail('fr', `Votre devis ${COMPANY_SHORT} ${vars.ref} est prêt`, [
    ['Votre prix est prêt à être consulté et accepté : ', { url: vars.url }],
  ]);
}
