// auth.reset, French (CONTENT_FR §14).
import { renderEmail, type RenderedEmail } from '../layout.js';

export default function render(vars: { url: string }): RenderedEmail {
  return renderEmail('fr', 'Réinitialiser votre mot de passe TanEx', [
    ['Une demande de réinitialisation a été faite pour votre compte TanEx. Utilisez ce lien dans les 30 minutes : ', { url: vars.url }, '. Si ce n\'était pas vous, ignorez cet e-mail.']
  ]);
}
