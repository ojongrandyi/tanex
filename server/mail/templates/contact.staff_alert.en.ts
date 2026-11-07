// contact.staff_alert, English (CONTENT §14, owner to confirm): new contact message, to MAIL_STAFF_ALERTS_TO.
// The visitor's message is not copied into the email (it is read in the console).
import { renderEmail, type RenderedEmail } from '../layout.js';

export default function render(vars: { name: string; ref: string; subject: string; url: string }): RenderedEmail {
  return renderEmail('en', `New message from ${vars.name} (${vars.ref})`, [
    [`${vars.name} sent a message through the website (topic: ${vars.subject}). Read and answer it in the console: `, { url: vars.url }]
  ]);
}
