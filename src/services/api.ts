import { AdminShipmentImage, Shipment, ShipmentStatus, TrackingEvent } from '../types/shipment';
import { QuoteRequest, QuoteRequestPricing, QuoteRequestStatus, AdminSettings, AdminDocument, DocumentStatus, ContactMessage, ContactMessageStatus } from '../types/admin';
import type { ShipmentPayment } from '../shared/paymentRequest';
import type { AdminPaymentProof, ProofStatus } from '../shared/paymentProof';

/** Body for PUT /api/shipments/:id/payment (validated by validatePaymentRequest on the server). */
export interface PaymentRequestBody {
  amount: number | string;
  currency: string;
  chargeReason: string;
  dueDate?: string;
  invoiceDocumentId?: string;
  customerNote?: string;
  methods: { id?: string; type: string; label?: string; details: Record<string, string>; instructions?: string }[];
}

/** Body for POST /api/track/:id/payment-proof (validated by validateProofSubmission on the server). */
export interface PaymentProofBody {
  methodId: string;
  payerName: string;
  amountSent: number | string;
  reference?: string;
  image: string;
}

/** GET /api/auth/session `user` (docs/IAM_RBAC_SPEC.md §6). permissions may hold '*'. */
export interface SessionUser {
  id: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  locale: string;
  roles: { id: string; name: string }[];
  permissions: string[];
  mustChangePassword: boolean;
}

/** One signed-in device (GET /api/auth/sessions, GET /api/users/:id/sessions). */
export interface UserSession {
  createdAt: number;
  lastSeenAt: number | null;
  expiresAt: number;
  ip: string | null;
  userAgent: string | null;
  /** The session making the request. */
  current: boolean;
}

/** A staff account as the Users screen sees it (GET /api/users). */
export interface StaffUser {
  id: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  status: 'ACTIVE' | 'DISABLED';
  locale: 'en' | 'fr';
  mustChangePassword: boolean;
  locked: boolean;
  lastLoginAt: number | null;
  createdAt: number;
  updatedAt: number;
  roles: { id: string; name: string }[];
}

/** Body for POST/PATCH /api/users. Empty email/phone clears it. */
export interface StaffUserInput {
  displayName?: string;
  email?: string;
  phone?: string;
  locale?: 'en' | 'fr';
  roleIds?: string[];
  status?: 'ACTIVE' | 'DISABLED';
}

export interface StaffRole {
  id: string;
  name: string;
  description: string;
  isSystem: boolean;
  /** The Super Admin role: read-only. */
  isLocked: boolean;
  /** Catalogue keys, or ['*'] for Super Admin. */
  permissions: string[];
  userCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface AuditEntry {
  id: string;
  at: number;
  actorUserId: string | null;
  actorName: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  summary: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
}

export interface AuditQuery {
  actor?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  /** Epoch ms, inclusive. */
  from?: number;
  /** Epoch ms, exclusive. */
  to?: number;
  page?: number;
  pageSize?: number;
}

export interface AuditPage {
  total: number;
  page: number;
  pageSize: number;
  items: AuditEntry[];
}

export interface AuditFilters {
  actions: string[];
  entityTypes: string[];
  actors: { id: string; name: string }[];
}

export interface SessionInfo {
  user: SessionUser | null;
  /** True when the server can email a reset link ("Forgot password?" is shown only then). */
  passwordReset: boolean;
}

const API_BASE = '/api';

// ---------------------------------------------------------------------------------------------
// Every request in this module goes through fetchApi (update I.6). The hosting CDN sometimes
// answers an API call with an HTML page (its bot check, or a placeholder while the app restarts)
// or drops the connection. Reads are safe to repeat, so they are retried twice with a short
// pause; writes are sent once, so nothing is ever saved twice.
// ---------------------------------------------------------------------------------------------

const RETRY_DELAYS_MS = [700, 1800];
const UNREACHABLE = "We couldn't reach the server just now. Please try again in a moment.";
const UNCONFIRMED = "We couldn't confirm the server received this. Refresh the page to check, then try again if needed.";
// The method of each response, so handleResponse can word a failed write differently.
const requestMethods = new WeakMap<Response, string>();

const isJsonResponse = (res: Response) => (res.headers.get('content-type') || '').includes('json');

async function fetchApi(input: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method || 'GET').toUpperCase();
  const retryable = method === 'GET' || method === 'HEAD';
  const attempts = retryable ? RETRY_DELAYS_MS.length + 1 : 1;
  let lastError: unknown = null;
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt - 1]));
    try {
      const res = await fetch(input, init);
      requestMethods.set(res, method);
      // A non-JSON reply to a read is the CDN, not the app: try again.
      if (retryable && !isJsonResponse(res) && res.status !== 204 && attempt < attempts - 1) continue;
      return res;
    } catch (err) {
      lastError = err;
    }
  }
  console.warn(`[api] ${method} ${input} failed: no response from the server.`, lastError);
  const err: any = new Error(retryable ? UNREACHABLE : UNCONFIRMED);
  err.status = 0;
  err.unreachable = true;
  throw err;
}

async function handleResponse<T>(res: Response): Promise<T> {
  let json: any;
  const text = await res.text();
  try {
    json = JSON.parse(text);
  } catch {
    // Not the app's answer (see fetchApi). Keep the technical details in the console only.
    const method = requestMethods.get(res) || 'GET';
    console.warn(`[api] ${method} ${res.url} returned a non-JSON reply (HTTP ${res.status}, ${res.headers.get('content-type') || 'no content type'}):`, text.slice(0, 160));
    const err: any = new Error(method === 'GET' || method === 'HEAD' ? UNREACHABLE : UNCONFIRMED);
    err.status = res.status;
    err.unreachable = true;
    throw err;
  }
  if (!res.ok || json.success === false) {
    // Attaching the real HTTP status lets callers tell "not authenticated, stop retrying"
    // apart from "transient failure, keep retrying" — see AdminDataContext's periodic
    // refresh, which used to retry every 12s forever even for a logged-out visitor.
    const err: any = new Error(json.error || `HTTP error ${res.status}`);
    err.status = res.status;
    // Machine-readable reason where the route gives one (e.g. WRONG_PASSWORD, TOO_SHORT).
    if (typeof json.code === 'string') err.code = json.code;
    // Per-field messages from form endpoints (e.g. payment methods), keyed by field name.
    if (json.fieldErrors) err.fieldErrors = json.fieldErrors;
    throw err;
  }
  return json.data !== undefined ? json.data : json;
}

export const api = {
  // Staff auth (docs/IAM_RBAC_SPEC.md §6). The console reads these through src/auth/AuthContext.
  // identifier: email or phone (normalised by the server). Errors carry the HTTP status
  // (401 wrong details, 429 too many attempts, 0 unreachable).
  async login(identifier: string, password: string): Promise<{ success: boolean }> {
    const fail = (status: number, message: string) => {
      const err: any = new Error(message);
      err.status = status;
      return err;
    };
    let res: Response;
    try {
      res = await fetchApi(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        cache: 'no-store',
        body: JSON.stringify({ identifier, password })
      });
    } catch {
      throw fail(0, "Can't reach the server. Check your connection and try again.");
    }
    let json: any;
    try {
      json = await res.json();
    } catch {
      // The hosting CDN has been seen answering with an empty or HTML body. The body is
      // unreliable but the session cookie isn't, so ask the server whether login took.
      if (res.ok && (await api.getSession()).user) return { success: true };
      if (res.status === 401) throw fail(401, 'Incorrect sign-in details.');
      if (res.status === 429) throw fail(429, 'Too many login attempts. Try again in a few minutes.');
      throw fail(res.status, 'Sign-in is temporarily unavailable. Please try again in a moment.');
    }
    if (!res.ok || json.success === false) {
      throw fail(res.status, json.error || `HTTP error ${res.status}`);
    }
    return json;
  },

  async logout(): Promise<void> {
    await fetchApi(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' });
  },

  /**
   * The signed-in staff user (null when signed out) and whether "Forgot password?" may be
   * offered. Throws only when the server can't be reached, so callers can tell "signed out"
   * apart from "offline".
   */
  async getSession(): Promise<SessionInfo> {
    const res = await fetchApi(`${API_BASE}/auth/session`, { credentials: 'include', cache: 'no-store' });
    const json = await handleResponse<any>(res);
    return { user: json?.user ?? null, passwordReset: json?.passwordReset === true };
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const res = await fetchApi(`${API_BASE}/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ currentPassword, newPassword })
    });
    await handleResponse<unknown>(res);
  },

  /** The signed-in user's own name and language (PATCH /api/auth/me). */
  async updateMyAccount(changes: { displayName?: string; locale?: 'en' | 'fr' }): Promise<SessionUser | null> {
    const res = await fetchApi(`${API_BASE}/auth/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(changes)
    });
    const json = await handleResponse<any>(res);
    return json?.user ?? null;
  },

  /** The signed-in user's own active sessions (My account). */
  async getMySessions(): Promise<UserSession[]> {
    const res = await fetchApi(`${API_BASE}/auth/sessions`, { credentials: 'include', cache: 'no-store' });
    return handleResponse<UserSession[]>(res);
  },

  /** Signs the signed-in user out on every other device; returns how many sessions ended. */
  async signOutOtherSessions(): Promise<number> {
    const res = await fetchApi(`${API_BASE}/auth/sessions`, { method: 'DELETE', credentials: 'include' });
    const data = await handleResponse<{ signedOut: number }>(res);
    return Number(data?.signedOut) || 0;
  },

  /** Asks for a reset link (B.6). The server answers the same whether or not the email has an account. */
  async requestPasswordReset(email: string): Promise<void> {
    const res = await fetchApi(`${API_BASE}/auth/forgot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    await handleResponse<unknown>(res);
  },

  // Staff accounts, roles and audit log (IAM_RBAC_SPEC §6). Errors carry `code` (e.g.
  // CANNOT_GRANT, LAST_SUPER_ADMIN) for the console to word.
  async listUsers(): Promise<StaffUser[]> {
    const res = await fetchApi(`${API_BASE}/users`, { credentials: 'include', cache: 'no-store' });
    return handleResponse<StaffUser[]>(res);
  },

  /** Creates an account; the temporary password comes back once and is never stored here. */
  async createUser(input: StaffUserInput): Promise<{ user: StaffUser; tempPassword: string }> {
    const res = await fetchApi(`${API_BASE}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      cache: 'no-store',
      body: JSON.stringify(input)
    });
    return handleResponse<{ user: StaffUser; tempPassword: string }>(res);
  },

  async updateUser(id: string, changes: StaffUserInput): Promise<StaffUser> {
    const res = await fetchApi(`${API_BASE}/users/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(changes)
    });
    return handleResponse<StaffUser>(res);
  },

  async resetUserPassword(id: string): Promise<{ user: StaffUser; tempPassword: string }> {
    const res = await fetchApi(`${API_BASE}/users/${encodeURIComponent(id)}/reset-password`, {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store'
    });
    return handleResponse<{ user: StaffUser; tempPassword: string }>(res);
  },

  /** Signs the user out on every device; returns how many sessions ended. */
  async signOutUserEverywhere(id: string): Promise<number> {
    const res = await fetchApi(`${API_BASE}/users/${encodeURIComponent(id)}/sessions`, {
      method: 'DELETE',
      credentials: 'include'
    });
    const data = await handleResponse<{ signedOut: number }>(res);
    return Number(data?.signedOut) || 0;
  },

  async listRoles(): Promise<StaffRole[]> {
    const res = await fetchApi(`${API_BASE}/roles`, { credentials: 'include', cache: 'no-store' });
    return handleResponse<StaffRole[]>(res);
  },

  async createRole(input: { name: string; description: string; permissions: string[] }): Promise<StaffRole> {
    const res = await fetchApi(`${API_BASE}/roles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(input)
    });
    return handleResponse<StaffRole>(res);
  },

  async updateRole(id: string, changes: { name?: string; description?: string; permissions?: string[] }): Promise<StaffRole> {
    const res = await fetchApi(`${API_BASE}/roles/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(changes)
    });
    return handleResponse<StaffRole>(res);
  },

  async deleteRole(id: string): Promise<void> {
    const res = await fetchApi(`${API_BASE}/roles/${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'include' });
    await handleResponse<unknown>(res);
  },

  async getAuditLog(query: AuditQuery): Promise<AuditPage> {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
    }
    const res = await fetchApi(`${API_BASE}/audit?${params.toString()}`, { credentials: 'include', cache: 'no-store' });
    return handleResponse<AuditPage>(res);
  },

  async getAuditFilters(): Promise<AuditFilters> {
    const res = await fetchApi(`${API_BASE}/audit/filters`, { credentials: 'include', cache: 'no-store' });
    return handleResponse<AuditFilters>(res);
  },

  // Public Tracking
  async trackShipment(trackingNumber: string): Promise<Shipment> {
    const res = await fetchApi(`${API_BASE}/track/${encodeURIComponent(trackingNumber)}`);
    return handleResponse<Shipment>(res);
  },

  // Proof of payment from the track page (public, rate-limited; update F.2). image is base64 or a data: URL.
  async submitPaymentProof(trackingNumber: string, proof: PaymentProofBody): Promise<{ status: 'SUBMITTED'; submittedAt: string }> {
    const res = await fetchApi(`${API_BASE}/track/${encodeURIComponent(trackingNumber)}/payment-proof`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(proof)
    });
    return handleResponse<{ status: 'SUBMITTED'; submittedAt: string }>(res);
  },

  // Public Booking & Quotes
  async submitPublicQuote(quoteData: Partial<QuoteRequest>): Promise<QuoteRequest> {
    const res = await fetchApi(`${API_BASE}/quotes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(quoteData)
    });
    return handleResponse<QuoteRequest>(res);
  },

  async submitPublicShipment(shipmentData: Partial<Shipment>): Promise<Shipment> {
    const res = await fetchApi(`${API_BASE}/shipments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(shipmentData)
    });
    return handleResponse<Shipment>(res);
  },

  // Admin Shipments
  async getShipments(params?: { search?: string; status?: string }): Promise<Shipment[]> {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.status) query.set('status', params.status);
    const res = await fetchApi(`${API_BASE}/shipments?${query.toString()}`);
    return handleResponse<Shipment[]>(res);
  },

  // Soft-deleted shipments — "Delete" moves a shipment here rather than erasing it; this is
  // the Recently Deleted / trash list.
  async getTrashedShipments(): Promise<Shipment[]> {
    const res = await fetchApi(`${API_BASE}/shipments?trash=true`);
    return handleResponse<Shipment[]>(res);
  },

  async restoreShipment(trackingNumber: string): Promise<Shipment> {
    const res = await fetchApi(`${API_BASE}/shipments/${encodeURIComponent(trackingNumber)}/restore`, {
      method: 'POST'
    });
    return handleResponse<Shipment>(res);
  },

  // Permanent, irreversible delete — only ever called from the trash view on a shipment
  // that's already soft-deleted, as a deliberate separate action from the ordinary delete.
  async permanentlyDeleteShipment(trackingNumber: string): Promise<{ success: boolean; message: string }> {
    const res = await fetchApi(`${API_BASE}/shipments/${encodeURIComponent(trackingNumber)}/permanent`, {
      method: 'DELETE'
    });
    return handleResponse<{ success: boolean; message: string }>(res);
  },

  // Single fresh shipment, server-synced (unmasked, admin-only — never call this from a
  // public-facing page; use trackShipment there instead).
  async getShipment(trackingNumber: string): Promise<Shipment> {
    const res = await fetchApi(`${API_BASE}/shipments/${encodeURIComponent(trackingNumber)}`);
    return handleResponse<Shipment>(res);
  },

  async createShipment(shipmentData: Partial<Shipment>): Promise<Shipment> {
    const res = await fetchApi(`${API_BASE}/shipments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(shipmentData)
    });
    return handleResponse<Shipment>(res);
  },

  async updateShipmentStatus(
    trackingNumber: string,
    newStatus: ShipmentStatus,
    location?: string,
    facility?: string,
    notes?: string,
    progressPercent?: number,
    statusText?: string,
    lat?: number,
    lng?: number,
    eventTitle?: string,
    skipEventCreation?: boolean,
    estimatedDeliveryDate?: string,
    estimatedDeliveryTime?: string
  ): Promise<Shipment> {
    const res = await fetchApi(`${API_BASE}/shipments/${encodeURIComponent(trackingNumber)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newStatus, location, facility, notes, progressPercent, statusText, lat, lng, eventTitle, skipEventCreation, estimatedDeliveryDate, estimatedDeliveryTime })
    });
    return handleResponse<Shipment>(res);
  },

  async updateShipment(trackingNumber: string, shipment: Partial<Shipment>): Promise<Shipment> {
    const res = await fetchApi(`${API_BASE}/shipments/${encodeURIComponent(trackingNumber)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(shipment)
    });
    return handleResponse<Shipment>(res);
  },

  async addTrackingEvent(trackingNumber: string, event: Partial<TrackingEvent>): Promise<Shipment> {
    const res = await fetchApi(`${API_BASE}/shipments/${encodeURIComponent(trackingNumber)}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event)
    });
    return handleResponse<Shipment>(res);
  },

  async correctTrackingEvent(trackingNumber: string, eventId: string, updates: Partial<TrackingEvent>): Promise<Shipment> {
    const res = await fetchApi(`${API_BASE}/shipments/${encodeURIComponent(trackingNumber)}/events/${encodeURIComponent(eventId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    return handleResponse<Shipment>(res);
  },

  // Return to origin: the server creates the return as its own shipment with a new TX ID.
  async initiateReturn(trackingNumber: string, reason: string, operator?: string): Promise<{ original: Shipment; returnShipment: Shipment }> {
    const res = await fetchApi(`${API_BASE}/shipments/${encodeURIComponent(trackingNumber)}/return`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason, operator })
    });
    return handleResponse<{ original: Shipment; returnShipment: Shipment }>(res);
  },

  async deleteShipment(trackingNumber: string): Promise<{ success: boolean; message: string }> {
    const res = await fetchApi(`${API_BASE}/shipments/${encodeURIComponent(trackingNumber)}`, {
      method: 'DELETE'
    });
    return handleResponse<{ success: boolean; message: string }>(res);
  },

  // Package images (admin). Every call returns the shipment's full, ordered image list.
  async getShipmentImages(trackingNumber: string): Promise<AdminShipmentImage[]> {
    const res = await fetchApi(`${API_BASE}/shipments/${encodeURIComponent(trackingNumber)}/images`);
    return handleResponse<AdminShipmentImage[]>(res);
  },

  async uploadShipmentImage(
    trackingNumber: string,
    image: { base64: string; caption: string; isPublic: boolean; width: number; height: number }
  ): Promise<AdminShipmentImage[]> {
    const res = await fetchApi(`${API_BASE}/shipments/${encodeURIComponent(trackingNumber)}/images`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: image.base64, caption: image.caption, isPublic: image.isPublic, width: image.width, height: image.height })
    });
    return handleResponse<AdminShipmentImage[]>(res);
  },

  async updateShipmentImage(trackingNumber: string, imageId: string, updates: { caption?: string; isPublic?: boolean }): Promise<AdminShipmentImage[]> {
    const res = await fetchApi(`${API_BASE}/shipments/${encodeURIComponent(trackingNumber)}/images/${encodeURIComponent(imageId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    return handleResponse<AdminShipmentImage[]>(res);
  },

  async reorderShipmentImages(trackingNumber: string, ids: string[]): Promise<AdminShipmentImage[]> {
    const res = await fetchApi(`${API_BASE}/shipments/${encodeURIComponent(trackingNumber)}/images/order`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    });
    return handleResponse<AdminShipmentImage[]>(res);
  },

  async deleteShipmentImage(trackingNumber: string, imageId: string): Promise<AdminShipmentImage[]> {
    const res = await fetchApi(`${API_BASE}/shipments/${encodeURIComponent(trackingNumber)}/images/${encodeURIComponent(imageId)}`, {
      method: 'DELETE'
    });
    return handleResponse<AdminShipmentImage[]>(res);
  },

  // Payment request per shipment (admin only). Accounts are typed per shipment (update D-9).
  async getShipmentPayment(trackingNumber: string): Promise<ShipmentPayment | null> {
    const res = await fetchApi(`${API_BASE}/shipments/${encodeURIComponent(trackingNumber)}/payment`);
    return handleResponse<ShipmentPayment | null>(res);
  },

  async saveShipmentPayment(trackingNumber: string, request: PaymentRequestBody): Promise<ShipmentPayment> {
    const res = await fetchApi(`${API_BASE}/shipments/${encodeURIComponent(trackingNumber)}/payment`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });
    return handleResponse<ShipmentPayment>(res);
  },

  async setShipmentPaymentStatus(trackingNumber: string, action: 'cancel' | 'mark_paid' | 'reopen'): Promise<ShipmentPayment> {
    const res = await fetchApi(`${API_BASE}/shipments/${encodeURIComponent(trackingNumber)}/payment/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });
    return handleResponse<ShipmentPayment>(res);
  },

  // Proofs of payment (admin Payments page, update F.5). Screenshots load from each proof's fileUrl.
  async getPaymentProofs(status?: ProofStatus): Promise<AdminPaymentProof[]> {
    const res = await fetchApi(`${API_BASE}/payments/proofs${status ? `?status=${status}` : ''}`);
    return handleResponse<AdminPaymentProof[]>(res);
  },

  // Review (update F.6). Approving marks the request and its linked invoice paid.
  async approvePaymentProof(id: string, addTrackingEvent: boolean): Promise<AdminPaymentProof> {
    const res = await fetchApi(`${API_BASE}/payments/proofs/${encodeURIComponent(id)}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ addTrackingEvent })
    });
    return handleResponse<AdminPaymentProof>(res);
  },

  async rejectPaymentProof(id: string, reason: string): Promise<AdminPaymentProof> {
    const res = await fetchApi(`${API_BASE}/payments/proofs/${encodeURIComponent(id)}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });
    return handleResponse<AdminPaymentProof>(res);
  },

  async deleteShipmentPayment(trackingNumber: string): Promise<void> {
    const res = await fetchApi(`${API_BASE}/shipments/${encodeURIComponent(trackingNumber)}/payment`, { method: 'DELETE' });
    await handleResponse<null>(res);
  },

  // Admin Quotes
  async getQuotes(): Promise<QuoteRequest[]> {
    const res = await fetchApi(`${API_BASE}/quotes`);
    return handleResponse<QuoteRequest[]>(res);
  },

  // Public: a single quote by its own ID (used by the "look up my quote" flow) — scoped to
  // one record instead of pulling every customer's quotes to find a match client-side.
  async getPublicQuote(id: string): Promise<QuoteRequest | null> {
    const res = await fetchApi(`${API_BASE}/quotes/${encodeURIComponent(id)}`);
    if (res.status === 404) return null;
    return handleResponse<QuoteRequest>(res);
  },

  async publishQuote(id: string, pricing: QuoteRequestPricing, internalNotes?: string): Promise<QuoteRequest> {
    const res = await fetchApi(`${API_BASE}/quotes/${encodeURIComponent(id)}/publish`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pricing, internalNotes })
    });
    return handleResponse<QuoteRequest>(res);
  },

  async updateQuoteStatus(id: string, status: QuoteRequestStatus, validUntil?: string): Promise<QuoteRequest> {
    const res = await fetchApi(`${API_BASE}/quotes/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, validUntil })
    });
    return handleResponse<QuoteRequest>(res);
  },

  async convertQuoteToShipment(id: string, shipment?: Partial<Shipment>): Promise<{ trackingNumber: string; data: Shipment }> {
    const res = await fetchApi(`${API_BASE}/quotes/${encodeURIComponent(id)}/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(shipment || {})
    });
    // The new ID is sent beside `data` (a raw database row), and handleResponse returns only
    // `data`, so read it from the top-level body first.
    const body = await res.clone().json().catch(() => null);
    const data = await handleResponse<Shipment>(res);
    return { trackingNumber: body?.trackingNumber, data };
  },

  // Admin Documents
  async getDocuments(params?: { docType?: string; status?: string; search?: string }): Promise<AdminDocument[]> {
    const query = new URLSearchParams();
    if (params?.docType) query.set('docType', params.docType);
    if (params?.status) query.set('status', params.status);
    if (params?.search) query.set('search', params.search);
    const res = await fetchApi(`${API_BASE}/documents?${query.toString()}`);
    return handleResponse<AdminDocument[]>(res);
  },

  async generateDocument(docData: AdminDocument): Promise<AdminDocument> {
    const res = await fetchApi(`${API_BASE}/documents/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(docData)
    });
    return handleResponse<AdminDocument>(res);
  },

  async regenerateDocument(id: string, notes?: string, refreshedFields?: Partial<AdminDocument>): Promise<AdminDocument> {
    const res = await fetchApi(`${API_BASE}/documents/${encodeURIComponent(id)}/regenerate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes, ...refreshedFields })
    });
    return handleResponse<AdminDocument>(res);
  },

  async updateDocumentStatus(id: string, status: DocumentStatus): Promise<AdminDocument> {
    const res = await fetchApi(`${API_BASE}/documents/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    return handleResponse<AdminDocument>(res);
  },

  async updateDocumentPaymentStatus(id: string, paymentStatus: 'PAID' | 'PENDING'): Promise<AdminDocument> {
    const res = await fetchApi(`${API_BASE}/documents/${encodeURIComponent(id)}/payment-status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentStatus })
    });
    return handleResponse<AdminDocument>(res);
  },

  async deleteDocument(id: string): Promise<{ success: boolean; message: string }> {
    const res = await fetchApi(`${API_BASE}/documents/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    return handleResponse<{ success: boolean; message: string }>(res);
  },

  // Settings
  async getSettings(): Promise<AdminSettings> {
    const res = await fetchApi(`${API_BASE}/settings`);
    return handleResponse<AdminSettings>(res);
  },

  async updateSettings(settings: Partial<AdminSettings>): Promise<AdminSettings> {
    const res = await fetchApi(`${API_BASE}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    return handleResponse<AdminSettings>(res);
  },

  // Contact form (public submit) and the admin Messages inbox
  async submitContactMessage(message: Pick<ContactMessage, 'name' | 'email' | 'phone' | 'subject' | 'priority' | 'trackingNumber' | 'gatewayCode' | 'message'>): Promise<ContactMessage> {
    const res = await fetchApi(`${API_BASE}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });
    return handleResponse<ContactMessage>(res);
  },

  async getContactMessages(): Promise<ContactMessage[]> {
    const res = await fetchApi(`${API_BASE}/messages`, { credentials: 'include' });
    return handleResponse<ContactMessage[]>(res);
  },

  async updateContactMessageStatus(id: string, status: ContactMessageStatus): Promise<ContactMessage> {
    const res = await fetchApi(`${API_BASE}/messages/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status })
    });
    return handleResponse<ContactMessage>(res);
  },

  // Dashboard Stats
  async getStats(): Promise<any> {
    const res = await fetchApi(`${API_BASE}/stats`, { credentials: 'include' });
    return handleResponse<any>(res);
  }
};
