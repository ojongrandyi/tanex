// Every /api router and where it is mounted. Used by server/index.ts and by the permission
// tests, so the tests exercise the real mounts.
import type { Express, Request, Response } from 'express';
import { authRouter } from './routes/auth.js';
import { shipmentsRouter } from './routes/shipments.js';
import { shipmentImagesRouter } from './routes/shipmentImages.js';
import { shipmentPaymentsRouter } from './routes/shipmentPayments.js';
import { quotesRouter } from './routes/quotes.js';
import { documentsRouter } from './routes/documents.js';
import { settingsRouter } from './routes/settings.js';
import { trackRouter } from './routes/track.js';
import { trackProofRouter } from './routes/trackProof.js';
import { paymentsRouter } from './routes/paymentProofs.js';
import { statsRouter } from './routes/stats.js';
import { messagesRouter } from './routes/messages.js';
import { mediaRouter } from './routes/media.js';
import { usersRouter } from './routes/users.js';
import { rolesRouter, permissionsRouter } from './routes/roles.js';
import { auditRouter } from './routes/auditLog.js';
import { mailRouter } from './routes/mail.js';
import { blogAdminRouter } from './routes/blog.js';
import { publicBlogRouter } from './routes/publicBlog.js';
import { tariffsRouter } from './routes/tariffs.js';
import { couriersRouter } from './routes/couriers.js';
import { dispatchRouter } from './routes/dispatch.js';
import { courierRouter } from './routes/courier.js';
import { localDeliveryRouter } from './routes/localDelivery.js';
import { cashRouter } from './routes/cash.js';
import { notificationsRouter } from './routes/notifications.js';
import { requirePermission } from './middleware/auth.js';
import { addErrorCodes } from './middleware/errorCodes.js';

/**
 * Mounts the API. Every console route checks its own permission with requirePermission
 * (IAM_RBAC_SPEC §7); public routes (booking, quotes, tracking, contact, sign-in) stay open.
 * Ends with a JSON 404 for unknown /api paths.
 */
export function registerApiRoutes(app: Express): void {
  // Error answers without a specific `code` get the general one for their status (I18N_SPEC §5).
  app.use('/api', addErrorCodes);
  app.use('/api/auth', authRouter);
  // Staff accounts, roles, permission catalogue and audit log (IAM_RBAC_SPEC §6); gated per route.
  app.use('/api/users', usersRouter);
  app.use('/api/roles', rolesRouter);
  app.use('/api/permissions', permissionsRouter);
  app.use('/api/audit', auditRouter);
  // Settings → Email: status and failed list (settings.view), test and retry (settings.manage).
  app.use('/api/mail', mailRouter);
  // Package images (/api/shipments/:id/images) and the payment request per shipment
  // (/api/shipments/:id/payment), each route gated individually.
  app.use('/api/shipments', shipmentImagesRouter);
  app.use('/api/shipments', shipmentPaymentsRouter);
  // POST is the public booking; everything else is gated per route.
  app.use('/api/shipments', shipmentsRouter);
  // GET /:id, POST and customer accept/decline are public; the rest is gated per route.
  app.use('/api/quotes', quotesRouter);
  // POST /generate is public (the booking flow creates a bill of lading); the rest is gated.
  app.use('/api/documents', documentsRouter);
  // GET is public but returns only the public fields to visitors; PUT needs settings.manage.
  app.use('/api/settings', settingsRouter);
  // Proof of payment from the track page (public, its own rate limit), then the track lookup.
  app.use('/api/track', trackProofRouter);
  app.use('/api/track', trackRouter);
  // Contact form: POST is public (rate-limited); list and status changes are gated per route.
  app.use('/api/messages', messagesRouter);
  // Blog (BLOG_SPEC §5): the studio API, each route gated with a blog.* permission, and the
  // public API, which only ever returns published posts.
  app.use('/api/admin/blog', blogAdminRouter);
  app.use('/api/blog', publicBlogRouter);
  // Dispatch (DISPATCH_SPEC §11): tariffs (tariffs.manage; GET /areas is public) and couriers
  // (couriers.view / couriers.manage), gated per route.
  app.use('/api/tariffs', tariffsRouter);
  app.use('/api/couriers', couriersRouter);
  // Delivery jobs for the console (dispatch.view / dispatch.manage, per route) and the courier
  // app's own-jobs API (courier.app, and the job must be the signed-in courier's).
  app.use('/api/dispatch', dispatchRouter);
  app.use('/api/courier', courierRouter);
  // Public local-delivery booking and its price look-up (DISPATCH_SPEC §8, G.6): rate-limited, no session.
  app.use('/api/local-delivery', localDeliveryRouter);
  // Cash & Mobile Money (DISPATCH_SPEC §9, G.8): cash.view to read, cash.confirm to confirm, reject and adjust.
  app.use('/api/cash', cashRouter);
  // WhatsApp click-to-chat taps (NOTIFICATIONS_SPEC §2, G.8): signed in; the job or account decides the permission.
  app.use('/api/notifications', notificationsRouter);
  // Public package and blog images (/media/<id>.<ext>, /media/blog/<id>.<ext>); outside /api
  // so they can be cached.
  app.use(mediaRouter);
  app.use('/api/stats', requirePermission('dashboard.view'), statsRouter);
  // Admin Payments page: proofs of payment and their private screenshots (update F.5). Each
  // route also checks payments.view or payments.manage.
  app.use('/api/payments', requirePermission('payments.view', 'payments.manage'), paymentsRouter);

  // 404 for anything under /api that didn't match a route above.
  app.use('/api', (req: Request, res: Response) => {
    res.status(404).json({ success: false, code: 'NOT_FOUND', error: 'Not found.' });
  });
}
