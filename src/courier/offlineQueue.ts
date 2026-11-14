// Offline queue for courier steps (DISPATCH_SPEC §6 "Field realities"). Every step the courier
// records (job actions, proof-of-delivery files, cash handovers) is written to IndexedDB first and
// sent in order until the server answers. Each step carries a client-generated idempotency key
// and the device time, so a step the server already applied is never applied twice (the server
// returns the stored answer). The jobs list and profile are cached too, so the app opens offline.
//
// Outcomes per step: answered OK → removed; no answer (offline, timeout, host page, 5xx, 429) →
// kept, retried with back-off; refused (other 4xx) → removed with its job's later steps (they
// depended on it) and reported to the courier; 401 → queue paused until the courier signs in again.
// Without IndexedDB (private mode, blocked storage) the queue lives in memory for this tab.
import { courierUrls, sendRaw, type RawResult } from './courierApi';

export type QueueKind = 'action' | 'pod' | 'handover';

export interface QueueItem {
  key: string;
  userId: string;
  kind: QueueKind;
  jobId: string | null;
  createdAt: number;
  /** JSON body for 'action' and 'handover' (idempotencyKey and deviceTs included). */
  body?: Record<string, unknown>;
  /** 'pod' parts. */
  photo?: Blob | null;
  signature?: Blob | null;
  recipientName?: string | null;
  note?: string | null;
}

export interface QueueFailure {
  key: string;
  kind: QueueKind;
  jobId: string | null;
  action: string | null;
  status: number;
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface SyncState {
  pending: QueueItem[];
  syncing: boolean;
  online: boolean;
  signedOut: boolean;
  failures: QueueFailure[];
  lastSyncedAt: number | null;
}

type Listener = (state: SyncState) => void;
type AppliedListener = (item: QueueItem, result: RawResult) => void;

const DB_NAME = 'tx_courier';
const DB_VERSION = 1;
const QUEUE = 'queue';
const CACHE = 'cache';
const RETRY_DELAYS_MS = [4_000, 10_000, 30_000, 60_000];

export function newKey(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return 'k' + Date.now().toString(36) + '_' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

// ---- IndexedDB (with an in-memory fallback) ----

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        if (typeof indexedDB === 'undefined') return resolve(null);
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(QUEUE)) db.createObjectStore(QUEUE, { keyPath: 'key' });
          if (!db.objectStoreNames.contains(CACHE)) db.createObjectStore(CACHE);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }
  return dbPromise;
}

function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return openDb().then((db) => new Promise<T | undefined>((resolve, reject) => {
    if (!db) return resolve(undefined);
    try {
      const tx = db.transaction(store, mode);
      const req = fn(tx.objectStore(store));
      tx.oncomplete = () => resolve(req ? req.result : undefined);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    } catch (err) {
      reject(err);
    }
  }));
}

const memoryQueue = new Map<string, QueueItem>();
const memoryCache = new Map<string, unknown>();

async function storeItem(item: QueueItem): Promise<void> {
  memoryQueue.set(item.key, item);
  try { await run(QUEUE, 'readwrite', (s) => s.put(item)); } catch { /* memory copy remains */ }
}
async function removeItem(key: string): Promise<void> {
  memoryQueue.delete(key);
  try { await run(QUEUE, 'readwrite', (s) => s.delete(key)); } catch { /* ignore */ }
}
async function loadItems(): Promise<QueueItem[]> {
  try {
    const stored = await run<QueueItem[]>(QUEUE, 'readonly', (s) => s.getAll() as IDBRequest<QueueItem[]>);
    for (const item of stored ?? []) memoryQueue.set(item.key, item);
  } catch { /* memory only */ }
  return [...memoryQueue.values()].sort((a, b) => a.createdAt - b.createdAt || a.key.localeCompare(b.key));
}

/** Saved copies for offline start (jobs list, profile), per user. */
export async function cacheGet<T>(name: string): Promise<T | undefined> {
  try {
    const v = await run<T>(CACHE, 'readonly', (s) => s.get(name) as IDBRequest<T>);
    if (v !== undefined) return v;
  } catch { /* fall through */ }
  return memoryCache.get(name) as T | undefined;
}
export async function cachePut(name: string, value: unknown): Promise<void> {
  memoryCache.set(name, value);
  try { await run(CACHE, 'readwrite', (s) => s.put(value, name)); } catch { /* memory copy remains */ }
}

// ---- Sending ----

function send(item: QueueItem): Promise<RawResult> {
  if (item.kind === 'pod' && item.jobId) {
    const form = new FormData();
    if (item.photo) form.append('photo', item.photo, item.photo.type === 'image/jpeg' ? 'photo.jpg' : 'photo.webp');
    if (item.signature) form.append('signature', item.signature, 'signature.png');
    if (item.recipientName) form.append('recipientName', item.recipientName);
    if (item.note) form.append('note', item.note);
    return sendRaw(courierUrls.pod(item.jobId), { method: 'POST', body: form });
  }
  const url = item.kind === 'handover' ? courierUrls.handover() : courierUrls.action(item.jobId ?? '');
  return sendRaw(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item.body ?? {}) });
}

const isRetryable = (r: RawResult) => r.status === 0 || r.status >= 500 || r.status === 429 || r.status === 408;

export class CourierSync {
  private state: SyncState;
  private listeners = new Set<Listener>();
  private applied = new Set<AppliedListener>();
  private timer: number | null = null;
  private attempt = 0;
  private running = false;
  private ready: Promise<void>;

  constructor(private userId: string) {
    this.state = {
      pending: [], syncing: false, online: typeof navigator === 'undefined' ? true : navigator.onLine,
      signedOut: false, failures: [], lastSyncedAt: null,
    };
    this.ready = loadItems().then((items) => {
      this.set({ pending: items.filter((i) => i.userId === this.userId) });
    });
    window.addEventListener('online', this.onOnline);
    window.addEventListener('offline', this.onOffline);
  }

  dispose(): void {
    window.removeEventListener('online', this.onOnline);
    window.removeEventListener('offline', this.onOffline);
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.listeners.clear();
    this.applied.clear();
  }

  private onOnline = () => {
    this.set({ online: true });
    this.flush();
  };
  private onOffline = () => this.set({ online: false });

  getState(): SyncState {
    return this.state;
  }
  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.state);
    return () => { this.listeners.delete(fn); };
  }
  /** Called for each step the server accepted, with its answer (the updated job, or the cash entry). */
  onApplied(fn: AppliedListener): () => void {
    this.applied.add(fn);
    return () => { this.applied.delete(fn); };
  }
  private set(patch: Partial<SyncState>): void {
    this.state = { ...this.state, ...patch };
    for (const fn of this.listeners) fn(this.state);
  }

  /** Saves a step on the phone, then tries to send it. */
  async enqueue(item: Omit<QueueItem, 'userId' | 'createdAt' | 'key'> & { key?: string }): Promise<QueueItem> {
    await this.ready;
    const key = item.key ?? newKey();
    // createdAt only orders the queue: later than every waiting step, even if the clock moved back.
    const last = this.state.pending.reduce((m, i) => Math.max(m, i.createdAt), 0);
    const full: QueueItem = { ...item, key, userId: this.userId, createdAt: Math.max(Date.now(), last + 1) };
    await storeItem(full);
    this.set({ pending: [...this.state.pending, full] });
    this.flush();
    return full;
  }

  dismissFailure(key: string): void {
    this.set({ failures: this.state.failures.filter((f) => f.key !== key) });
  }

  /** After signing in again. */
  resume(): void {
    this.set({ signedOut: false });
    this.flush();
  }

  /** Sends waiting steps in order until one has no answer. */
  async flush(): Promise<void> {
    await this.ready;
    if (this.running || this.state.signedOut) return;
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
    this.running = true;
    try {
      while (this.state.pending.length > 0) {
        this.set({ syncing: true });
        const item = this.state.pending[0];
        const result = await send(item);
        if (result.ok) {
          await removeItem(item.key);
          this.attempt = 0;
          this.set({ pending: this.state.pending.filter((i) => i.key !== item.key), online: true, lastSyncedAt: Date.now() });
          for (const fn of this.applied) fn(item, result);
          continue;
        }
        if (result.status === 401) {
          this.set({ signedOut: true });
          break;
        }
        if (isRetryable(result)) {
          this.set({ online: result.status === 0 ? false : this.state.online });
          this.scheduleRetry();
          break;
        }
        // Refused: drop it and the job's later steps, which depended on it.
        const dropped = this.state.pending.filter((i) => i.key === item.key || (item.jobId !== null && i.jobId === item.jobId));
        for (const d of dropped) await removeItem(d.key);
        const failure: QueueFailure = {
          key: item.key, kind: item.kind, jobId: item.jobId,
          action: typeof item.body?.action === 'string' ? item.body.action : item.kind,
          status: result.status, code: result.code ?? 'SERVER_ERROR', message: result.error ?? '', details: result.details,
        };
        this.set({
          pending: this.state.pending.filter((i) => !dropped.includes(i)),
          failures: [...this.state.failures, failure],
        });
        for (const fn of this.applied) fn(item, result);
      }
    } finally {
      this.running = false;
      this.set({ syncing: false });
    }
  }

  private scheduleRetry(): void {
    const delay = RETRY_DELAYS_MS[Math.min(this.attempt, RETRY_DELAYS_MS.length - 1)];
    this.attempt += 1;
    this.timer = window.setTimeout(() => {
      this.timer = null;
      this.flush();
    }, delay);
  }
}
