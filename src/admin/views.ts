// Console views and the permission each one needs (docs/IAM_RBAC_SPEC.md §9). The sidebar
// shows only the views the user may open; AdminApp falls back to the first one allowed.
import type { PermissionKey } from '../shared/permissions';

export type AdminViewType =
  | 'operations-center'
  | 'all-shipments'
  | 'create-shipment'
  | 'tracking-events'
  | 'quote-requests'
  | 'messages'
  | 'payments'
  | 'document-center'
  | 'settings'
  | 'account';

/** null = every signed-in user (My account). */
export const VIEW_PERMISSION: Record<AdminViewType, PermissionKey | null> = {
  'operations-center': 'dashboard.view',
  'all-shipments': 'shipments.view',
  'create-shipment': 'shipments.create',
  'tracking-events': 'tracking.update',
  'quote-requests': 'quotes.view',
  'messages': 'messages.view',
  'payments': 'payments.view',
  'document-center': 'documents.view',
  'settings': 'settings.view',
  'account': null
};

/** Order the console tries when picking a landing view. */
export const VIEW_ORDER: readonly AdminViewType[] = [
  'operations-center',
  'all-shipments',
  'create-shipment',
  'tracking-events',
  'quote-requests',
  'messages',
  'payments',
  'document-center',
  'settings'
];

export function canOpenView(view: AdminViewType, can: (key: PermissionKey) => boolean): boolean {
  const key = VIEW_PERMISSION[view];
  return key === null || can(key);
}

/** The first work view the user may open, or null when they have none (My account only). */
export function firstAllowedView(can: (key: PermissionKey) => boolean): AdminViewType | null {
  return VIEW_ORDER.find((v) => canOpenView(v, can)) ?? null;
}
