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
  | 'blog'
  | 'settings'
  | 'users'
  | 'roles'
  | 'audit'
  | 'account';

/** null = every signed-in user (My account); a list = any one of those permissions. */
export const VIEW_PERMISSION: Record<AdminViewType, PermissionKey | readonly PermissionKey[] | null> = {
  'operations-center': 'dashboard.view',
  'all-shipments': 'shipments.view',
  'create-shipment': 'shipments.create',
  'tracking-events': 'tracking.update',
  'quote-requests': 'quotes.view',
  'messages': 'messages.view',
  'payments': 'payments.view',
  'document-center': 'documents.view',
  // Blog studio (BLOG_SPEC §2): a writer, an editor, a publisher or a category manager.
  'blog': ['blog.view', 'blog.write', 'blog.edit_any', 'blog.publish', 'blog.categories'],
  'settings': 'settings.view',
  'users': 'users.view',
  'roles': 'roles.manage',
  'audit': 'audit.view',
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
  'blog',
  'settings',
  'users',
  'roles',
  'audit'
];

export function canOpenView(view: AdminViewType, can: (key: PermissionKey) => boolean): boolean {
  const key = VIEW_PERMISSION[view];
  if (key === null) return true;
  return typeof key === 'string' ? can(key) : key.some((k) => can(k));
}

/** The first work view the user may open, or null when they have none (My account only). */
export function firstAllowedView(can: (key: PermissionKey) => boolean): AdminViewType | null {
  return VIEW_ORDER.find((v) => canOpenView(v, can)) ?? null;
}
