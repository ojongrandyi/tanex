import rateLimit from 'express-rate-limit';

// Applied to the public write endpoints (quote submission, shipment booking, document
// auto-generation) — none of these need a session, so nothing else stops a script from
// hammering them to spam the quotes/shipments tables. Much higher ceiling than the login
// limiter (server/routes/auth.ts) since real customers legitimately submitting a quote or
// booking a shipment is the normal case here, not something to be suspicious of — this is
// about stopping bulk/scripted abuse, not slowing down a real customer.
export const publicWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, code: 'RATE_LIMITED', error: 'Too many requests. Please try again in a few minutes.' }
});

// Proof-of-payment uploads from the track page (docs/update.md F.2). Each one carries an image
// and moves a payment into review, so the ceiling is much lower than publicWriteLimiter.
// The message is the one the customer sees (CONTENT.md §6.8).
export const paymentProofLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, code: 'RATE_LIMITED', error: 'Too many attempts. Please wait a while and try again.' }
});

// Public look-ups by reference that return a customer's own details (GET /api/quotes/:id).
// Quote references have only 90,000 values per year, so without a limit a script could walk
// through them. Generous for a real customer, slow for enumeration.
export const publicLookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, code: 'RATE_LIMITED', error: 'Too many requests. Please try again in a few minutes.' }
});
