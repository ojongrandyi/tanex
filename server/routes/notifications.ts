// WhatsApp click-to-chat taps (docs/NOTIFICATIONS_SPEC.md §2; DISPATCH_SPEC §10). The browser
// opens the wa.me link itself; it then tells the server, which writes one notification_log row
// (channel WHATSAPP_LINK, status OPENED). The phone number comes from the job or the account on
// the server, never from the request, and is stored masked; the message text is never sent here.
//
// POST /api/notifications/whatsapp
//   { jobId, template, to: 'sender' | 'recipient' }  dispatch.view / dispatch.manage, or the courier of that job
//   { userId, template: 'auth.temp_password' }       users.manage or couriers.manage (temporary password dialog)
import { Router, Request, Response } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { getRequestAuth, requestHasPermission } from '../auth/permissions.js';
import { serverError } from '../errors.js';
import { logNotification } from '../notifications/log.js';
import { loadJob, parsePlace } from '../dispatch/jobs.js';
import { isJobMessageTemplate } from '../../src/shared/jobMessages.js';

export const notificationsRouter = Router();

const fail = (res: Response, status: number, code: string, error: string) => res.status(status).json({ success: false, code, error });

notificationsRouter.post('/whatsapp', requireAuth, (req: Request, res: Response) => {
  try {
    const auth = getRequestAuth(req)!;
    if (auth.user.mustChangePassword) return fail(res, 403, 'PASSWORD_CHANGE_REQUIRED', 'Change your temporary password first.');
    const b = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;

    if (typeof b.jobId === 'string') {
      const job = loadJob(db, b.jobId);
      if (!job) return fail(res, 404, 'NOT_FOUND', 'Job not found.');
      const staff = requestHasPermission(req, 'dispatch.view', 'dispatch.manage');
      const ownCourier = requestHasPermission(req, 'courier.app') && job.courier_user_id === auth.user.id;
      if (!staff && !ownCourier) return fail(res, 403, 'FORBIDDEN', 'You do not have permission to do this.');
      if (!isJobMessageTemplate(b.template) || (b.to !== 'sender' && b.to !== 'recipient')) {
        return fail(res, 400, 'INVALID_TEMPLATE', 'Unknown message.');
      }
      const place = parsePlace(b.to === 'sender' ? job.pickup_json : job.dropoff_json);
      const id = logNotification(db, {
        channel: 'WHATSAPP_LINK', templateKey: b.template, locale: job.notify_locale === 'fr' ? 'fr' : 'en',
        phone: place.contactPhone || null, related: { type: 'dispatch_job', id: job.id }, userId: auth.user.id,
      });
      return res.json({ success: true, data: { id } });
    }

    if (typeof b.userId === 'string') {
      if (!requestHasPermission(req, 'users.manage', 'couriers.manage')) return fail(res, 403, 'FORBIDDEN', 'You do not have permission to do this.');
      if (b.template !== 'auth.temp_password') return fail(res, 400, 'INVALID_TEMPLATE', 'Unknown message.');
      const user = db.prepare('SELECT id, phone, locale FROM users WHERE id = ?').get(b.userId) as
        { id: string; phone: string | null; locale: string | null } | undefined;
      if (!user) return fail(res, 404, 'NOT_FOUND', 'Account not found.');
      const id = logNotification(db, {
        channel: 'WHATSAPP_LINK', templateKey: 'auth.temp_password', locale: user.locale === 'fr' ? 'fr' : 'en',
        phone: user.phone, related: { type: 'user', id: user.id }, userId: auth.user.id,
      });
      return res.json({ success: true, data: { id } });
    }

    return fail(res, 400, 'INVALID_INPUT', 'Say which job or account the message is about.');
  } catch (err) {
    serverError(res, err);
  }
});
