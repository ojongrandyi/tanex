// auth.reset, English (CONTENT §14).
import { renderEmail, type RenderedEmail } from '../layout.js';

export default function render(vars: { url: string }): RenderedEmail {
  return renderEmail('en', 'Reset your TanEx password', [
    ['Someone asked to reset the password for your TanEx account. Use this link within 30 minutes: ', { url: vars.url }, '. If it wasn\'t you, ignore this email.']
  ]);
}
