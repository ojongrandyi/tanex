// Settings → Email (docs/NOTIFICATIONS_SPEC.md §3): mail status, test email, failed messages.
// Reading needs settings.view; sending a test or retrying needs settings.manage. Message bodies
// and the SMTP password are never returned.
import { Router, Request, Response } from 'express';
import { requirePermission } from '../middleware/auth.js';
import { audit, audited, param } from '../audit.js';
import { getRequestAuth } from '../auth/permissions.js';
import { mailConfig, mailEnabled } from '../mail/mailer.js';
import { deliverNow, isDeliverableAddress, listOutbox, outboxSummary, queueEmail, retryFailed } from '../mail/outbox.js';

export const mailRouter = Router();

// GET /api/mail/status
mailRouter.get('/status', requirePermission('settings.view'), (_req: Request, res: Response) => {
  const cfg = mailConfig();
  res.json({
    success: true,
    data: {
      enabled: mailEnabled(),
      host: cfg?.host ?? null,
      port: cfg?.port ?? null,
      secure: cfg?.secure ?? null,
      user: cfg?.user ?? null,
      from: cfg?.from || null,
      replyTo: cfg?.replyTo ?? null,
      summary: outboxSummary(),
      failed: listOutbox('FAILED', 50),
      recent: listOutbox(null, 20)
    }
  });
});

// POST /api/mail/test  { to? }: sends the test email now (default: the signed-in user's email).
mailRouter.post('/test', requirePermission('settings.manage'), async (req: Request, res: Response) => {
  try {
    if (!mailEnabled()) {
      return res.status(409).json({ success: false, code: 'MAIL_OFF', error: 'Email is off: SMTP_HOST is not set on the server.' });
    }
    const auth = getRequestAuth(req)!;
    const raw = typeof req.body?.to === 'string' && req.body.to.trim() ? req.body.to.trim() : auth.user.email || '';
    const to = raw.toLowerCase();
    if (!isDeliverableAddress(to)) {
      return res.status(400).json({ success: false, code: 'INVALID_EMAIL', error: 'Enter a valid email address.' });
    }
    const id = queueEmail({
      to,
      template: 'mail.test',
      locale: auth.user.locale === 'fr' ? 'fr' : 'en',
      vars: {},
      related: { type: 'user', id: auth.user.id }
    });
    if (!id) return res.status(500).json({ success: false, error: 'The test email could not be queued.' });
    const result = await deliverNow(id);
    audit(req, 'mail.test', 'email', id, result.sent ? `Test email sent to ${to}` : `Test email to ${to} failed`);
    res.json({ success: true, data: { id, sent: result.sent, error: result.error } });
  } catch (err) {
    console.error('[mail] test failed:', err);
    res.status(500).json({ success: false, error: 'The test email could not be sent.' });
  }
});

// POST /api/mail/outbox/:id/retry: a FAILED message goes back in the queue.
mailRouter.post('/outbox/:id/retry', requirePermission('settings.manage'),
  audited('mail.retry', 'email', param('id'), 'Failed email queued again'), (req: Request, res: Response) => {
  const ok = retryFailed(String(req.params.id));
  if (!ok) {
    return res.status(409).json({ success: false, code: 'NOT_RETRYABLE', error: 'This email can no longer be retried.' });
  }
  res.json({ success: true });
});
