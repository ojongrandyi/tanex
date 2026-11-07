// mail.test, French (CONTENT_FR §14, à confirmer par le propriétaire).
import { renderEmail, type RenderedEmail } from '../layout.js';

export default function render(_vars: Record<string, never>): RenderedEmail {
  return renderEmail('fr', 'E-mail de test TanEx', [
    ["Ceci est un e-mail de test envoyé depuis la console TanEx. Si vous pouvez le lire, l'envoi d'e-mails fonctionne."]
  ]);
}
