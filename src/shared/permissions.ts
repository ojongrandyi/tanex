// Permission catalogue and seeded roles (docs/IAM_RBAC_SPEC.md §4, docs/TANEX_PLAN.md §4.1).
// Shared by client and server and kept DOM-free. The server syncs PERMISSIONS into the
// `permissions` table at boot (server/auth/schema.ts); adding a feature means adding keys here.

export type Locale = 'en' | 'fr';
export type LocalizedText = Readonly<Record<Locale, string>>;

/** Grants every permission. Held only by the locked Super Admin role. */
export const ALL_PERMISSIONS = '*' as const;

export const PERMISSION_GROUPS = [
  { key: 'dashboard', label: { en: 'Dashboard', fr: 'Tableau de bord' } },
  { key: 'shipments', label: { en: 'Shipments', fr: 'Expéditions' } },
  { key: 'tracking', label: { en: 'Tracking', fr: 'Suivi' } },
  { key: 'documents', label: { en: 'Documents', fr: 'Documents' } },
  { key: 'quotes', label: { en: 'Quotes', fr: 'Devis' } },
  { key: 'messages', label: { en: 'Messages', fr: 'Messages' } },
  { key: 'payments', label: { en: 'Payments', fr: 'Paiements' } },
  { key: 'dispatch', label: { en: 'Dispatch', fr: 'Dispatching' } },
  { key: 'courier', label: { en: 'Courier', fr: 'Coursier' } },
  { key: 'cash', label: { en: 'Cash', fr: 'Espèces' } },
  { key: 'blog', label: { en: 'Blog', fr: 'Blog' } },
  { key: 'admin', label: { en: 'Administration', fr: 'Administration' } }
] as const satisfies readonly { key: string; label: LocalizedText }[];

export type PermissionGroupKey = (typeof PERMISSION_GROUPS)[number]['key'];

export const PERMISSIONS = [
  // Dashboard
  { key: 'dashboard.view', group: 'dashboard', description: { en: 'View the dashboard and its figures', fr: 'Voir le tableau de bord et ses chiffres' } },
  // Shipments
  { key: 'shipments.view', group: 'shipments', description: { en: 'View shipments', fr: 'Voir les expéditions' } },
  { key: 'shipments.create', group: 'shipments', description: { en: 'Create shipments', fr: 'Créer des expéditions' } },
  { key: 'shipments.edit', group: 'shipments', description: { en: 'Edit shipments and their photos', fr: 'Modifier les expéditions et leurs photos' } },
  { key: 'shipments.delete', group: 'shipments', description: { en: 'Move shipments to the trash, restore them and delete them permanently', fr: 'Mettre des expéditions à la corbeille, les restaurer et les supprimer définitivement' } },
  // Tracking
  { key: 'tracking.update', group: 'tracking', description: { en: 'Add and correct tracking events, change statuses and create returns', fr: 'Ajouter et corriger des événements de suivi, changer les statuts et créer des retours' } },
  // Documents
  { key: 'documents.view', group: 'documents', description: { en: 'View documents', fr: 'Voir les documents' } },
  { key: 'documents.manage', group: 'documents', description: { en: 'Regenerate, update and delete documents', fr: 'Régénérer, mettre à jour et supprimer des documents' } },
  // Quotes
  { key: 'quotes.view', group: 'quotes', description: { en: 'View quote requests', fr: 'Voir les demandes de devis' } },
  { key: 'quotes.manage', group: 'quotes', description: { en: 'Publish quotes and convert them to shipments', fr: 'Publier des devis et les convertir en expéditions' } },
  // Messages
  { key: 'messages.view', group: 'messages', description: { en: 'Read contact messages', fr: 'Lire les messages de contact' } },
  { key: 'messages.manage', group: 'messages', description: { en: 'Change the status of contact messages', fr: 'Changer le statut des messages de contact' } },
  // Payments
  { key: 'payments.view', group: 'payments', description: { en: 'View payment requests and proofs of payment', fr: 'Voir les demandes de paiement et les preuves de paiement' } },
  { key: 'payments.manage', group: 'payments', description: { en: 'Create payment requests and approve or reject proofs of payment', fr: 'Créer des demandes de paiement et approuver ou refuser les preuves de paiement' } },
  // Dispatch
  { key: 'dispatch.view', group: 'dispatch', description: { en: 'View delivery jobs', fr: 'Voir les courses de livraison' } },
  { key: 'dispatch.manage', group: 'dispatch', description: { en: 'Create, price, assign and cancel delivery jobs', fr: 'Créer, tarifer, attribuer et annuler des courses de livraison' } },
  { key: 'tariffs.manage', group: 'dispatch', description: { en: 'Manage delivery zones and rates', fr: 'Gérer les zones et les tarifs de livraison' } },
  { key: 'couriers.view', group: 'dispatch', description: { en: 'View couriers', fr: 'Voir les coursiers' } },
  { key: 'couriers.manage', group: 'dispatch', description: { en: 'Manage courier profiles', fr: 'Gérer les profils des coursiers' } },
  // Courier
  { key: 'courier.app', group: 'courier', description: { en: 'Use the courier app (own jobs only)', fr: "Utiliser l'application coursier (ses propres courses uniquement)" } },
  // Cash
  { key: 'cash.view', group: 'cash', description: { en: 'View the cash ledger', fr: 'Voir le registre des espèces' } },
  { key: 'cash.confirm', group: 'cash', description: { en: 'Confirm courier cash handovers and record adjustments', fr: 'Confirmer les remises d’espèces des coursiers et enregistrer des ajustements' } },
  // Blog
  { key: 'blog.view', group: 'blog', description: { en: 'View blog posts in the console', fr: 'Voir les articles du blog dans la console' } },
  { key: 'blog.write', group: 'blog', description: { en: 'Write and edit own drafts', fr: 'Rédiger et modifier ses propres brouillons' } },
  { key: 'blog.edit_any', group: 'blog', description: { en: "Edit anyone's posts", fr: 'Modifier les articles de tous les auteurs' } },
  { key: 'blog.publish', group: 'blog', description: { en: 'Publish and unpublish posts', fr: 'Publier et dépublier des articles' } },
  { key: 'blog.categories', group: 'blog', description: { en: 'Manage blog categories', fr: 'Gérer les catégories du blog' } },
  // Admin
  { key: 'users.view', group: 'admin', description: { en: 'View staff accounts', fr: 'Voir les comptes du personnel' } },
  { key: 'users.manage', group: 'admin', description: { en: 'Create, edit, disable and reset staff accounts', fr: 'Créer, modifier, désactiver et réinitialiser les comptes du personnel' } },
  { key: 'roles.manage', group: 'admin', description: { en: 'Create and edit roles and their permissions', fr: 'Créer et modifier les rôles et leurs permissions' } },
  { key: 'settings.view', group: 'admin', description: { en: 'View settings', fr: 'Voir les paramètres' } },
  { key: 'settings.manage', group: 'admin', description: { en: 'Change settings', fr: 'Modifier les paramètres' } },
  { key: 'audit.view', group: 'admin', description: { en: 'View the audit log', fr: "Voir le journal d'audit" } }
] as const satisfies readonly { key: string; group: PermissionGroupKey; description: LocalizedText }[];

export type PermissionKey = (typeof PERMISSIONS)[number]['key'];
export type PermissionGrant = PermissionKey | typeof ALL_PERMISSIONS;

const PERMISSION_KEY_SET: ReadonlySet<string> = new Set(PERMISSIONS.map((p) => p.key));

export function isPermissionKey(value: string): value is PermissionKey {
  return PERMISSION_KEY_SET.has(value);
}

/**
 * True when the granted keys (the union of a user's roles) include `key`, or include `*`.
 */
export function hasPermission(granted: Iterable<string>, key: PermissionKey): boolean {
  for (const g of granted) {
    if (g === ALL_PERMISSIONS || g === key) return true;
  }
  return false;
}

export interface SeededRole {
  /** Stable id, so later code and tests can find a seeded role even after it is renamed. */
  id: string;
  name: string;
  description: string;
  /** Locked = the Super Admin role: cannot be edited or deleted. */
  isLocked: boolean;
  permissions: readonly PermissionGrant[];
}

export const SUPER_ADMIN_ROLE_ID = 'role_super_admin';

/**
 * Roles created on a new database (TANEX_PLAN §4.1). Seeded only while the `roles` table is
 * empty; afterwards they belong to the Super Admin, who can edit them (except Super Admin).
 * Names and descriptions are stored as entered; the Super Admin can rename them.
 */
export const SEEDED_ROLES: readonly SeededRole[] = [
  {
    id: SUPER_ADMIN_ROLE_ID,
    name: 'Super Admin',
    description: 'Owner / IT. Everything, including users, roles and settings.',
    isLocked: true,
    permissions: [ALL_PERMISSIONS]
  },
  {
    id: 'role_operations_manager',
    name: 'Operations Manager',
    description: 'Runs shipments end to end.',
    isLocked: false,
    permissions: [
      'dashboard.view',
      'shipments.view', 'shipments.create', 'shipments.edit', 'shipments.delete',
      'tracking.update',
      'documents.view', 'documents.manage',
      'quotes.view', 'quotes.manage',
      'messages.view', 'messages.manage',
      'payments.view',
      'dispatch.view', 'dispatch.manage',
      'couriers.view', 'couriers.manage',
      'cash.view'
    ]
  },
  {
    id: 'role_dispatch_manager',
    name: 'Dispatch Manager',
    description: 'Office dispatcher: prices and assigns local and intercity jobs, watches couriers.',
    isLocked: false,
    permissions: [
      'dispatch.view', 'dispatch.manage',
      'couriers.view',
      'shipments.view',
      'tracking.update',
      'cash.view',
      'messages.view'
    ]
  },
  {
    id: 'role_courier',
    name: 'Courier',
    description: 'Bike rider or truck/van driver. Uses the courier app only.',
    isLocked: false,
    permissions: ['courier.app']
  },
  {
    id: 'role_marketing',
    name: 'Marketing',
    description: 'Blog and public content.',
    isLocked: false,
    permissions: [
      'blog.view', 'blog.write', 'blog.publish', 'blog.categories',
      'messages.view',
      'dashboard.view'
    ]
  },
  {
    id: 'role_finance',
    name: 'Finance',
    description: 'Money in.',
    isLocked: false,
    permissions: [
      'payments.view', 'payments.manage',
      'cash.view', 'cash.confirm',
      'documents.view',
      'quotes.view',
      'shipments.view'
    ]
  },
  {
    id: 'role_customer_support',
    name: 'Customer Support',
    description: 'Answers customers.',
    isLocked: false,
    permissions: [
      'shipments.view',
      'tracking.update',
      'messages.view', 'messages.manage',
      'quotes.view',
      'dispatch.view'
    ]
  }
];
