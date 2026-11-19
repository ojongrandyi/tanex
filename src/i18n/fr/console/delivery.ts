// Français, console : menus Livraison et Blog, Caisse et Mobile Money (CONTENT_FR §10.2 ;
// tracker I.2, à confirmer, relecture native #108). Termes alignés sur l'application livreur
// approuvée : course, livreur, enlèvement, livraison.
import type { ConsoleTextAreas, Widen } from '../../../admin/i18n/consoleText';

export const blogMenu: Widen<ConsoleTextAreas['blogMenu']> = {
  menu: 'Blog',
  description: 'Écrire, relire et publier des articles.',
};

// Boutique : libellé du bouton validé par le propriétaire (#180).
export const shopMenu: Widen<ConsoleTextAreas['shopMenu']> = {
  menu: 'Boutique',
  description: 'Produits, photos, stock, catégories et commandes.',
  newBadge: (n: number) => (n === 1 ? '1 nouvelle' : `${n} nouvelles`),
  newOrdersLabel: (n: number) => (n === 1 ? '1 nouvelle commande boutique' : `${n} nouvelles commandes boutique`),
  bellTitle: (n: number) => (n === 1 ? '1 nouvelle commande boutique' : `${n} nouvelles commandes boutique`),
  bellBody: 'Appelez le client pour confirmer la commande et les frais de livraison.',
  dashboard: {
    title: 'Commandes boutique',
    newOrders: 'Nouvelles commandes',
    feeToConfirm: (n: number) => (n === 1 ? '1 avec des frais à confirmer' : `${n} avec des frais à confirmer`),
    allFeesSet: 'Tous les frais de livraison sont fixés',
    ready: 'Prêtes à envoyer',
    readyHint: 'Emballées, en attente de livraison ou de retrait',
    out: 'En cours de livraison',
    problems: (n: number) => (n === 1 ? '1 avec un problème de livraison' : `${n} avec un problème de livraison`),
    noProblems: 'Aucun problème de livraison',
    unpaid: 'Terminées, non payées',
    unpaidHint: 'Livrées ou retirées, paiement non enregistré',
    lowStock: 'Stock bas',
    lowStockHint: 'Produits publiés au niveau de stock bas ou en dessous',
  },
};

export const dispatchMenu: Widen<ConsoleTextAreas['dispatchMenu']> = {
  section: 'LIVRAISON',
  dispatch: {
    menu: 'Répartition',
    description: 'Courses de livraison, livreurs sur la carte, attribution et prix.',
    attention: (n: number) => (n === 1 ? '1 course demande votre attention' : `${n} courses demandent votre attention`),
  },
  tariffs: { menu: 'Tarifs', description: 'Villes de livraison, quartiers, tarifs et vitesses moyennes.' },
  couriers: { menu: 'Livreurs', description: 'Motards et chauffeurs : comptes, véhicules et photos.' },
  cash: { menu: 'Caisse et Mobile Money', description: 'Soldes des livreurs, remises et Mobile Money à confirmer, rapport du jour.' },
};

export const cash: Widen<ConsoleTextAreas['cash']> = {
  loading: 'Chargement…',
  loadError: 'Impossible de charger le registre de caisse. Vérifiez votre connexion et réessayez.',
  retry: 'Réessayer',
  viewOnly: 'Vous pouvez consulter le registre de caisse. Confirmer des entrées et des ajustements nécessite l’autorisation « Confirmer les remises d’espèces des livreurs ».',
  search: 'Rechercher un livreur, une référence ou un numéro de suivi',
  tabs: { pending: 'En attente des Finances', couriers: 'Soldes des livreurs', report: 'Rapport du jour' },
  pending: {
    intro: 'Remises déclarées par les livreurs et paiements qu’ils ont enregistrés. Vérifiez chacun avec les espèces reçues ou le relevé MTN MoMo / Orange Money de l’entreprise, puis confirmez ou rejetez.',
    empty: 'Rien en attente de confirmation.',
    noMatch: 'Aucune entrée ne correspond à votre recherche.',
  },
  columns: {
    when: 'Enregistré', ref: 'Référence', courier: 'Livreur', type: 'Entrée', method: 'Moyen', amount: 'Montant',
    momoRef: 'ID de transaction', job: 'Numéro de suivi', status: 'Statut', note: 'Note', actions: 'Actions',
    balance: 'Solde', toHandOver: 'À remettre', mobileMoney: 'Mobile Money enregistré', waiting: 'En attente',
  },
  types: { COLLECTED: 'Encaissé', HANDOVER: 'Remise', ADJUSTMENT: 'Ajustement' },
  methods: { CASH: 'Espèces', MTN_MOMO: 'MTN MoMo', ORANGE_MONEY: 'Orange Money' },
  statuses: { PENDING: 'En attente de confirmation', CONFIRMED: 'Confirmé', REJECTED: 'Rejeté' },
  collectedMoMo: "Payé sur le compte de l'entreprise",
  confirm: 'Confirmer',
  reject: 'Rejeter',
  confirmed: (ref: string) => `${ref} confirmé.`,
  rejected: (ref: string) => `${ref} rejeté.`,
  confirmAsk: (ref: string, amount: string) => `Confirmer ${ref} pour ${amount} ? Vérifiez d’abord avec les espèces reçues ou le relevé du compte.`,
  rejectTitle: (ref: string) => `Rejeter ${ref}`,
  rejectReason: 'Pourquoi est-ce rejeté ?',
  rejectHint: 'Le livreur voit l’entrée comme rejetée ; le motif est conservé dans le journal d’audit.',
  chargeCourier: (amount: string) => `Imputer aussi ${amount} au livreur`,
  chargeHint: 'Seulement si le livreur est responsable, par exemple si le colis a été remis sans que le paiement arrive. Enregistre un ajustement lié à cette entrée. Sinon, rien n’est imputé.',
  rejectedCharged: (ref: string, amount: string) => `${ref} rejeté ; ${amount} imputé au livreur.`,
  reasonRequired: 'Indiquez un motif.',
  by: (name: string) => `par ${name}`,
  couriers: {
    intro: 'Solde = espèces encaissées + ajustements − remises confirmées par les Finances. L’argent encaissé doit être remis sous 7 jours.',
    empty: "Aucun livreur pour l'instant.",
    none: 'Aucun montant enregistré',
    dueBy: (date: string) => `à remettre avant le ${date}`,
    overdue: (date: string) => `En retard : à remettre le ${date}`,
    entries: 'Entrées',
    hideEntries: 'Masquer les entrées',
    entriesTitle: (name: string) => `30 derniers jours : ${name}`,
    noEntries: 'Aucune entrée ces 30 derniers jours.',
    adjust: 'Ajuster',
  },
  adjust: {
    title: (name: string) => `Ajustement : ${name}`,
    intro: 'Corrige ce que doit le livreur. Montant positif quand il doit davantage, négatif (avec −) quand il doit moins.',
    amount: 'Montant',
    currency: 'Devise',
    reason: 'Motif',
    reasonHint: 'Obligatoire. Conservé dans le journal d’audit et affiché sur le relevé du livreur.',
    save: 'Enregistrer l’ajustement',
    saving: 'Enregistrement…',
    cancel: 'Annuler',
    invalidAmount: 'Saisissez un montant différent de 0.',
    done: (name: string) => `Ajustement enregistré pour ${name}.`,
  },
  report: {
    intro: 'Par livreur pour une journée (heure du Cameroun). Les soldes sont ceux de fin de journée.',
    date: 'Jour',
    csv: 'Télécharger le CSV',
    empty: 'Aucun mouvement de caisse ce jour-là.',
    columns: {
      collected: 'Espèces encaissées', mobileMoney: 'Mobile Money enregistré', declared: 'Remises déclarées',
      confirmed: 'Remises confirmées', adjustments: 'Ajustements', waiting: 'En attente des Finances', balance: 'Solde en fin de journée',
    },
  },
  errors: {
    ALREADY_REVIEWED: 'Cette entrée a déjà été confirmée ou rejetée. La liste a été actualisée.',
    REASON_REQUIRED: 'Indiquez un motif.',
    INVALID_CASH: 'Vérifiez le montant.',
    NOT_FOUND: 'Introuvable. La liste a été actualisée.',
    CHARGE_NOT_ALLOWED: 'Seul un paiement Mobile Money enregistré par le livreur peut lui être imputé.',
    FORBIDDEN: "Vous n'avez pas l'autorisation de faire cela.",
    fallback: 'Une erreur est survenue. Réessayez.',
  },
};
