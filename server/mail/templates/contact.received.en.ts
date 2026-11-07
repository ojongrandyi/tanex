// contact.received, English (CONTENT §14).
import { renderEmail, type RenderedEmail } from '../layout.js';

export default function render(vars: { name: string; ref: string }): RenderedEmail {
  return renderEmail('en', `We've received your message (${vars.ref})`, [
    [`Thank you, ${vars.name}. We'll get back to you as soon as possible.`]
  ]);
}
