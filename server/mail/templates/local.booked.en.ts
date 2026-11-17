// local.booked, English (CONTENT §14; added with G.6, owner to confirm).
import { renderEmail, type RenderedEmail } from '../layout.js';

export default function render(vars: { name: string; id: string; link: string }): RenderedEmail {
  return renderEmail('en', `We've received your delivery booking ${vars.id}`, [
    [`Thank you, ${vars.name}. Your tracking ID is ${vars.id}. Follow your delivery here: `, { url: vars.link }],
  ]);
}
