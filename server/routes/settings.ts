import { Router, Request, Response } from 'express';
import { db } from '../db.js';
import { requirePermission } from '../middleware/auth.js';
import { getRequestAuth, isCourierOnly, requestHasPermission } from '../auth/permissions.js';
import { audit } from '../audit.js';

export const settingsRouter = Router();

// Fields any visitor may read: the public site shows the company contact details and quote
// validity and converts prices with the display currency (ContactPage, useCompanyContact,
// PublicQuoteResultPage, useCurrency). Everything else stays off the public API.
export const PUBLIC_SETTINGS_FIELDS = [
  'companyName',
  'supportPhone',
  'dispatchEmail',
  'headquartersAddress',
  'dotNumber',
  'quoteValidityDays',
  'displayCurrency',
  'exchangeRates'
] as const;

// Extra fields the console needs for everyday work by staff without settings.view: the
// signature/stamp on generated documents, pricing defaults for quotes, document automation
// toggles and PII masking in lists.
export const STAFF_SETTINGS_FIELDS = [
  'signatureStampUrl',
  'signatoryName',
  'signatoryTitle',
  'defaultFuelSurchargeRate',
  'oversizeLengthThreshold',
  'autoPublishQuotes',
  'autoGenLabel',
  'autoGenReceipt',
  'piiMaskingEnabled'
] as const;

function pickFields(settings: Record<string, unknown>, fields: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) if (f in settings) out[f] = settings[f];
  return out;
}

function isStaff(req: Request): boolean {
  const auth = getRequestAuth(req);
  return Boolean(auth && auth.permissions.length > 0 && !isCourierOnly(auth.permissions));
}

function readSettings(): Record<string, unknown> {
  const row = db.prepare('SELECT value_json FROM settings WHERE key = ?').get('general') as { value_json: string } | undefined;
  return row ? JSON.parse(row.value_json) : {};
}

// GET /api/settings: everything with settings.view; public + staff fields for other
// console users; public fields only for visitors and courier-only accounts.
settingsRouter.get('/', (req: Request, res: Response) => {
  try {
    const settings = readSettings();
    let data: Record<string, unknown>;
    if (requestHasPermission(req, 'settings.view', 'settings.manage')) data = settings;
    else if (isStaff(req)) data = pickFields(settings, [...PUBLIC_SETTINGS_FIELDS, ...STAFF_SETTINGS_FIELDS]);
    else data = pickFields(settings, PUBLIC_SETTINGS_FIELDS);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/settings: merges the given fields into the stored settings.
settingsRouter.put('/', requirePermission('settings.manage'), (req: Request, res: Response) => {
  try {
    const newSettings = req.body && typeof req.body === 'object' ? req.body : {};
    const current = readSettings();
    const merged = { ...current, ...newSettings };

    db.prepare('INSERT OR REPLACE INTO settings (key, value_json) VALUES (?, ?)').run('general', JSON.stringify(merged));

    // Only the names of fields whose value changed (values can hold large images).
    const changed = Object.keys(newSettings).filter((k) => JSON.stringify(current[k]) !== JSON.stringify(newSettings[k]));
    audit(req, 'settings.update', 'settings', 'general',
      changed.length ? `Settings changed: ${changed.join(', ').slice(0, 300)}` : 'Settings saved (no changes)',
      undefined, changed.length ? { fields: changed } : undefined);
    res.json({ success: true, data: merged });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
