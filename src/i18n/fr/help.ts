// Français, zone « help » : le Centre d'aide (CONTENT_FR §8.1, §8.2, §8.4, §8.5). Relecture native #108.
import type { HelpMessages } from '../en/help';
import type { Translation } from '../types';

const help = {
  hero: {
    title: 'Comment pouvons-nous vous aider ?',
    searchLabel: "Rechercher dans le centre d'aide",
    searchPlaceholder: 'Cherchez une réponse, ex. douane, délai de livraison, documents',
  },
  quick: {
    label: 'Accès rapides',
    track: 'Suivre un envoi',
    collect: 'Réserver un enlèvement',
    quote: 'Demander un devis',
    desk: 'Bureau des opérations TanEx',
  },
  kb: {
    title: 'Réponses aux questions fréquentes',
    filterLabel: 'Sujets',
    all: 'Tous les sujets ({n})',
    results: '{n} réponses',
    emptyTitle: 'Aucune réponse trouvée.',
    emptyBody: 'Essayez d\'autres mots, ou contactez-nous et nous vous répondrons directement.',
    clear: 'Effacer la recherche',
  },
  categories: {
    tracking: 'Suivi',
    booking: 'Réservation et enlèvement',
    customs: 'Douane et international',
    documents: 'Documents et livraison',
    local: 'Livraison locale',
    payments: 'Paiements',
  },
  articles: {
    findId: { q: 'Où trouver mon numéro de suivi ?', a: 'Sur votre confirmation de réservation, en haut de votre lettre de transport et sur chaque étiquette de colis. Il compte 8 caractères et commence par TX (ex. TX7K2M9P).' },
    notUpdated: { q: "Pourquoi mon suivi n'a-t-il pas été mis à jour ?", a: 'Les mises à jour apparaissent à chaque scan. Sur les longs trajets en avion ou en bateau, plusieurs heures peuvent séparer deux scans. La position estimée continue d\'avancer entre-temps.' },
    multiPiece: { q: 'Comment fonctionnent les envois de plusieurs colis ?', a: 'Tous les colis partagent un seul numéro de suivi. Chaque colis a sa propre étiquette, terminée par -01, -02, etc.' },
    cutOff: { q: "Quelle est l'heure limite pour un enlèvement le jour même ?", a: 'Elle dépend de votre ville et du service. Votre coordinateur la confirme à la réservation.' },
    packing: { q: 'Comment emballer mon envoi ?', a: 'Utilisez un carton extérieur solide, calez chaque objet et scellez toutes les jointures. Pour les objets de valeur, demandez notre emballage Secure Vault.' },
    changeAddress: { q: "Puis-je changer l'adresse de livraison ?", a: "Oui, tant que l'envoi n'a pas atteint la porte d'entrée de destination. Contactez-nous avec votre numéro de suivi." },
    duties: { q: 'Qui paie les droits et taxes ?', a: "C'est convenu à la réservation : soit l'expéditeur (droits payés), soit le destinataire (droits non payés)." },
    customsDocuments: { q: "De quels documents ai-je besoin ?", a: 'En général une facture commerciale et, pour certaines marchandises, des permis ou certificats. Nous vous dirons exactement ce qu\'il faut pour votre itinéraire.' },
    prohibited: { q: 'Que ne puis-je pas expédier ?', a: "Les articles interdits et réglementés varient selon les pays. Consultez nos Conditions d'expédition ou demandez-nous avant de réserver." },
    pod: { q: 'Où est ma preuve de livraison ?', a: 'Sur votre page de suivi dès la livraison, téléchargeable en PDF.' },
    damaged: { q: 'Que faire si mon envoi est endommagé ?', a: 'Prévenez-nous dans les 7 jours suivant la livraison, avec des photos. Nous ouvrons une réclamation et vous tenons informé.' },
    localAreas: { q: 'Quelles zones vos livreurs couvrent-ils ?', a: "Buea, Limbe et Douala. À la réservation, choisissez votre ville et les quartiers d'enlèvement et de livraison pour voir le prix." },
    localPrice: { q: 'Comment le prix est-il calculé ?', a: "Selon la ville, les quartiers d'enlèvement et de livraison et la taille du colis. L'enlèvement express coûte un supplément. Si vos quartiers ne sont pas encore listés, nous confirmons le prix avant l'enlèvement." },
    localCod: { q: 'Le livreur peut-il encaisser de l\'argent auprès du destinataire ?', a: 'Oui. Choisissez le paiement à la livraison à la réservation et indiquez le montant. Nous vous le reversons comme convenu.' },
    localUnavailable: { q: "Et si le destinataire n'est pas disponible ?", a: "Le livreur essaie de le joindre. Si la livraison ne peut pas se faire, votre page de suivi en indique la raison et notre équipe vous contacte pour convenir d'un nouveau créneau." },
    localMap: { q: 'Pourquoi ne vois-je pas le livreur sur la carte ?', a: 'La position apparaît dès que votre colis est récupéré et se met à jour toutes les quelques secondes pendant le trajet.' },
    payMethods: { q: 'Quels moyens de paiement acceptez-vous ?', a: "Les espèces au livreur, MTN Mobile Money et Orange Money sur les comptes de l'entreprise TanEx, et pour les envois internationaux les moyens indiqués sur votre demande de paiement." },
    payMomoProof: { q: 'Comment prouver un paiement Mobile Money ?', a: "Envoyez une capture d'écran du SMS de confirmation sur votre page de suivi, avec l'ID de transaction." },
  },
  banner: {
    title: 'Encore besoin d\'aide pour un envoi ?',
    contact: "Contacter l'assistance",
    call: 'Appeler le {phone}',
  },
} satisfies Translation<HelpMessages>;

export default help;
