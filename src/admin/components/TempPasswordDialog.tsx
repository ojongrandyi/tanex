// Shows a temporary password once (new account or reset), with Copy and "Send on WhatsApp"
// (CONTENT §10.1, §14 auth.temp_password). The password lives only in this component's props
// and is gone when the dialog closes.
import React, { useState } from 'react';
import { Copy, Check, MessageCircle } from 'lucide-react';
import { IamDialog } from './IamDialog';
import { IAM_TEXT } from '../../auth/strings';
import { buildWhatsAppLink } from '../../shared/whatsapp';
import { ADMIN_URL } from '../../config/brand';
import type { StaffUser } from '../../services/api';

const T = IAM_TEXT.temp;

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers / insecure context: fall back to a hidden textarea.
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(area);
      return ok;
    } catch {
      return false;
    }
  }
}

export const TempPasswordDialog: React.FC<{
  user: StaffUser;
  tempPassword: string;
  onClose: () => void;
}> = ({ user, tempPassword, onClose }) => {
  const [copied, setCopied] = useState(false);
  const identifier = user.email || user.phone || '';
  // The message goes to the account's own phone, in the account's language.
  const link = buildWhatsAppLink(
    user.phone,
    'auth.temp_password',
    { url: ADMIN_URL, identifier, password: tempPassword },
    user.locale === 'fr' ? 'fr' : 'en'
  );

  return (
    <IamDialog title={T.title} onClose={onClose}>
      <div className="tx-iam-form">
        <p className="tx-iam-muted" style={{ margin: 0 }}>{T.intro}</p>
        <p className="tx-iam-muted" style={{ margin: 0 }}>
          <strong>{user.displayName}</strong> · {T.signInWith} <span style={{ overflowWrap: 'anywhere' }}>{identifier}</span>
        </p>
        <div className="tx-iam-secret">
          <output aria-label={T.title}>{tempPassword}</output>
          <button
            type="button"
            className="tx-iam-btn small"
            onClick={async () => setCopied(await copyText(tempPassword))}
          >
            {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
            <span>{copied ? T.copied : T.copy}</span>
          </button>
        </div>
        <span className="tx-iam-hint" role="status" aria-live="polite">{copied ? T.copied : ''}</span>
        <div>
          {link ? (
            <a className="tx-iam-btn" href={link} target="_blank" rel="noopener noreferrer">
              <MessageCircle size={15} aria-hidden="true" />
              <span>{T.whatsapp}</span>
            </a>
          ) : (
            <button type="button" className="tx-iam-btn" disabled aria-describedby="tx-temp-wa-hint">
              <MessageCircle size={15} aria-hidden="true" />
              <span>{T.whatsapp}</span>
            </button>
          )}
          <p id="tx-temp-wa-hint" className="tx-iam-hint" style={{ margin: '0.35rem 0 0' }}>
            {link ? T.whatsappHint : T.whatsappNoPhone}
          </p>
        </div>
        <div className="tx-iam-dialog-actions">
          <button type="button" className="tx-iam-btn primary" onClick={onClose}>{T.done}</button>
        </div>
      </div>
    </IamDialog>
  );
};
