// mail.test, English (CONTENT §14, owner to confirm): Settings → Email "Send test email".
import { renderEmail, type RenderedEmail } from '../layout.js';

export default function render(_vars: Record<string, never>): RenderedEmail {
  return renderEmail('en', 'TanEx test email', [
    ['This is a test email from the TanEx Operations Console. If you can read it, email sending works.']
  ]);
}
