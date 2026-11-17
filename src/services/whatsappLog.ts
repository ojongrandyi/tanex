// Tells the server a WhatsApp click-to-chat link was opened (NOTIFICATIONS_SPEC §2), so it can write
// a notification_log row. Fire-and-forget: the link opens whatever happens here, and keepalive lets
// the request finish while the browser switches to WhatsApp. Never throws.
import { fetchApi } from './api';

export type WhatsAppTap =
  | { jobId: string; template: string; to: 'sender' | 'recipient' }
  | { userId: string; template: 'auth.temp_password' };

function post(url: string, body: unknown): void {
  try {
    void fetchApi(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      keepalive: true,
      body: JSON.stringify(body),
    }).catch(() => {});
  } catch {
    // Logging must never stop the link from opening.
  }
}

/** Console and courier app (signed in). */
export const logWhatsAppTap = (tap: WhatsAppTap) => post('/api/notifications/whatsapp', tap);

/** Booking success page (public): the recipient share link of a booking just made. */
export const logBookingShareTap = (trackingNumber: string) => post('/api/local-delivery/whatsapp-opened', { trackingNumber });
