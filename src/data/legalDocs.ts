// Legal pages (docs/CONTENT.md §13.1, docs/CONTENT_FR.md §13): plain-language drafts in English and
// French. LAWYER REVIEW UNDER CAMEROONIAN LAW REQUIRED BEFORE LAUNCH (tracker #112); the French text
// also needs the native review (#108). Items marked [confirm] in CONTENT §13 are shown as written
// until the owner confirms them (dimensional divisor 5000, 7-day claims window).
//
// The Cookie Policy lists what the code really sets (audited in E.4): the staff session cookie and
// the browser-storage keys of the public pages. Update it whenever a cookie, storage key or
// third-party service is added or removed, and bump LEGAL_LAST_UPDATED.

import { COMPANY_SHORT, DOMAIN, LEGAL_NAME } from '../config/brand';
import { pagePath } from '../router/routes';

export type LegalDocId = 'privacy' | 'terms' | 'shipping-terms' | 'cookies' | 'accessibility';
export const LEGAL_DOC_IDS: readonly LegalDocId[] = ['privacy', 'terms', 'shipping-terms', 'cookies', 'accessibility'];

/** A paragraph, or a bulleted list when it is an array. */
export type LegalBlock = string | string[];

export interface LegalSection {
  heading: string;
  body: LegalBlock[];
}

export interface LegalDoc {
  id: LegalDocId;
  /** Tab and footer label */
  label: string;
  title: string;
  sections: LegalSection[];
}

/** Date of the current text (ISO); pages format it per language. Update with every change. */
export const LEGAL_LAST_UPDATED = '2026-11-08';

interface LegalContact {
  email: string;
  /** '' when not set: the sentence that uses it is left out. */
  address: string;
}

export function legalDocs(contact: LegalContact, lang: 'en' | 'fr' = 'en'): LegalDoc[] {
  return lang === 'fr' ? legalDocsFr(contact) : legalDocsEn(contact);
}

function legalDocsEn({ email, address }: LegalContact): LegalDoc[] {
  return [
    {
      id: 'privacy',
      label: 'Privacy Policy',
      title: 'Privacy Policy',
      sections: [
        { heading: 'Who we are', body: [
          `${LEGAL_NAME} ("${COMPANY_SHORT}", "we") runs this website and carries the shipments booked through it.${address ? ` Our head office is at ${address}.` : ''} For anything about your personal data, write to ${email}.`,
        ] },
        { heading: 'What we collect', body: [[
          'Sender and recipient details you give us when you book or ask for a quote: names, company, phone numbers, email and delivery addresses.',
          'Shipment data: contents, weights, sizes, declared value, and the scans and events recorded as the shipment moves.',
          'Messages you send us through the contact and support forms.',
          'Basic technical data: when your browser loads our pages and maps, the servers involved receive your IP address. We do not use analytics or advertising tools.',
        ]] },
        { heading: 'Why we use it', body: [[
          'To collect, carry and deliver your shipments.',
          'To prepare customs and shipping documents.',
          'To answer your questions, handle claims and keep you updated.',
          'To meet our legal, tax and customs duties.',
        ]] },
        { heading: 'Public tracking', body: [
          'Anyone with a tracking ID can follow a shipment. The public tracking page shows only the city and country for each end of the journey, and masks names, phone numbers and email addresses.',
        ] },
        { heading: 'Who we share it with', body: [
          'We share only what each party needs to move your shipment: carriers, agents and handlers on the route, and customs and other authorities. We do not sell personal data.',
        ] },
        { heading: 'International transfers', body: [
          'Because we move goods across borders, shipment details travel with them to the countries on the route. We share only what carriage and customs require.',
        ] },
        { heading: 'How long we keep it', body: [
          'We keep personal data only as long as we need it for the purposes above, including the periods set by tax, customs and transport record-keeping rules.',
        ] },
        { heading: 'Your rights', body: [
          "Depending on where you live (for example under Cameroon's Law No. 2024/017 of 23 December 2024 on personal data protection, or the EU or UK GDPR), you can ask to see the personal data we hold about you, correct it, delete it, or object to how we use it. You can also complain to your data protection authority.",
        ] },
        { heading: 'Privacy requests', body: [
          `Email ${email} with your request and, if it concerns a shipment, its tracking ID. We may ask you to confirm your identity before we act on it.`,
        ] },
      ],
    },
    {
      id: 'terms',
      label: 'Terms of Service',
      title: 'Terms of Service',
      sections: [
        { heading: 'Accepting these terms', body: ['By using this website you agree to these terms. When you book a shipment, our Shipping Terms also apply.'] },
        { heading: 'Using the website and tracking', body: [
          "You can use this website to ask for quotes, book shipments and track them. Please don't misuse it: no automated collection of tracking data, and no attempts to reach other people's shipments or our internal systems.",
          'Tracking updates depend on scans along the route and can be delayed. They are for information and are not a guarantee of delivery times.',
        ] },
        { heading: 'Quotes and bookings', body: [
          'A quote is valid until the date shown on it and covers the shipment you described. If the shipment turns out different (for example heavier, larger or with other contents), the price may change. A booking is confirmed when you receive a tracking ID.',
        ] },
        { heading: 'Payment and invoicing', body: [
          'We invoice each shipment, or as agreed with you in writing. Payment is due as stated on the invoice. Duties, taxes and charges set by authorities are extra unless your quote says otherwise.',
        ] },
        { heading: 'Limitation of liability', body: [
          'As far as the law allows, we are not liable for indirect or consequential losses arising from your use of this website. Our liability for shipments is set out in the Shipping Terms.',
        ] },
        { heading: 'Changes to these terms', body: ['We may update these terms. The date at the top of this page shows the current version.'] },
        { heading: 'Governing law', body: [
          'These terms are governed by the laws of the Republic of Cameroon. Nothing in them takes away rights you have under the consumer law of the country where you live.',
        ] },
      ],
    },
    {
      id: 'shipping-terms',
      label: 'Shipping Terms',
      title: 'Shipping Terms',
      sections: [
        { heading: 'Booking and acceptance', body: ['We accept a shipment when we collect it, or you hand it to us, and it has a tracking ID. We may inspect, refuse or hold any shipment that does not meet these terms or the law.'] },
        { heading: 'Prohibited and restricted items', body: ['You must not send anything that is illegal in the origin, transit or destination country. Items such as dangerous goods, cash, weapons, live animals and perishables are either prohibited or need our agreement before booking. Rules vary by country, so ask us before you book.'] },
        { heading: 'Packaging', body: ['You are responsible for packing your shipment to withstand normal handling: use a strong outer box, cushion every item and seal all seams. For high-value items, ask for our Secure Vault packaging.'] },
        { heading: 'Chargeable weight', body: ['We charge on the greater of the actual weight and the dimensional weight. Dimensional weight in kg = length × width × height in cm ÷ 5000.'] },
        { heading: 'Surcharges', body: ['Fuel, remote-area and customs-related surcharges may apply. Every known surcharge is shown on your quote.'] },
        { heading: 'Duties and taxes', body: ['Who pays duties and taxes is agreed at booking: either the sender (duties paid) or the recipient (duties unpaid).'] },
        { heading: 'Delivery and proof of delivery', body: ['We deliver to the address on the booking. The delivery time and the name of the person who signed are recorded against your tracking ID as proof of delivery.'] },
        { heading: 'Liability and declared value', body: ['Our liability for loss or damage is limited. Unless you declare a value and take extended cover when you book, compensation is limited to the standard liability for your service and route, as confirmed at booking. We are not liable for delays or for indirect losses.'] },
        { heading: 'Claims', body: ['Tell us within 7 days of delivery. Include your tracking ID, a description of the problem, photos of the goods and the packaging, and proof of value (for example the commercial invoice). We will open a claim and keep you updated.'] },
        { heading: 'Return to sender', body: ['If a shipment cannot be delivered or cleared through customs, we contact the sender. It may be returned at the sender\'s cost; a return gets its own tracking ID.'] },
      ],
    },
    {
      id: 'cookies',
      label: 'Cookie Policy',
      title: 'Cookie Policy',
      sections: [
        { heading: 'Cookies we use', body: [
          `We use one essential cookie, tx.sid. It keeps ${COMPANY_SHORT} staff signed in to our operations console for up to 12 hours. It is not set for visitors to the public website.`,
          'We do not use analytics or advertising cookies. If we add analytics, we will update this page and ask for your consent where the law requires it.',
        ] },
        { heading: 'Choices saved in your browser', body: [
          "Some pages remember a few choices in your browser's local storage. This data stays on your device and is not sent to us:",
          [
            'tx_locale: the language you chose for this website (English or French).',
            'ngf_recent_tracking: tracking IDs you looked up recently, so you can open them again.',
            'ngf_units: whether you prefer metric or imperial units.',
            'ngf_live_shipment_stream: the latest update for a shipment you are viewing, so other open tabs stay in step.',
          ],
          'You can clear these at any time in your browser settings.',
        ] },
        { heading: 'Other services our pages use', body: [
          'Our pages load map tiles from Esri (ArcGIS) and use OpenStreetMap Nominatim and OSRM to look up addresses and routes. Fonts and photos are served from our own site. These services receive your IP address when your browser contacts them.',
        ] },
      ],
    },
    {
      id: 'accessibility',
      label: 'Accessibility',
      title: 'Accessibility',
      sections: [
        { heading: 'Our commitment', body: ['We want everyone to be able to track, book and contact us. We aim to meet the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA across this website.'] },
        { heading: 'What we do', body: [[
          'Forms, buttons and menus work with a keyboard, and form fields have labels.',
          'Images have text alternatives, and text is sized and coloured to stay readable.',
          "Animated maps respect your device's reduced-motion setting.",
          'Tracking pages give the route and every scan as text, not only on the map.',
        ]] },
        { heading: 'Report a barrier', body: [
          `If something on this website is hard to use, email ${email}. Tell us the page and what happened, and we will help you get what you need another way while we fix it.`,
        ] },
      ],
    },
  ];
}

function legalDocsFr({ email, address }: LegalContact): LegalDoc[] {
  return [
    {
      id: 'privacy',
      label: 'Politique de confidentialité',
      title: 'Politique de confidentialité',
      sections: [
        { heading: 'Qui nous sommes', body: [
          `${LEGAL_NAME} (« ${COMPANY_SHORT} », « nous ») exploite ce site et transporte les envois qui y sont réservés.${address ? ` Notre siège se trouve à ${address}.` : ''} Pour toute question sur vos données personnelles, écrivez à ${email}.`,
        ] },
        { heading: 'Ce que nous collectons', body: [[
          "Les coordonnées de l'expéditeur et du destinataire que vous nous donnez lors d'une réservation ou d'une demande de devis : noms, entreprise, numéros de téléphone, e-mail et adresses de livraison.",
          "Les données d'envoi : contenu, poids, dimensions, valeur déclarée, ainsi que les scans et événements enregistrés pendant le transport.",
          "Les messages que vous nous envoyez via les formulaires de contact et d'assistance.",
          "Des données techniques de base : quand votre navigateur charge nos pages et nos cartes, les serveurs concernés reçoivent votre adresse IP. Nous n'utilisons aucun outil d'analyse ni de publicité.",
        ]] },
        { heading: 'Pourquoi nous les utilisons', body: [[
          'Pour enlever, transporter et livrer vos envois.',
          "Pour préparer les documents de douane et d'expédition.",
          'Pour répondre à vos questions, traiter les réclamations et vous tenir informé.',
          'Pour respecter nos obligations légales, fiscales et douanières.',
        ]] },
        { heading: 'Suivi public', body: [
          "Toute personne disposant d'un numéro de suivi peut suivre un envoi. La page de suivi publique n'affiche que la ville et le pays à chaque extrémité du trajet, et masque les noms, numéros de téléphone et adresses e-mail.",
        ] },
        { heading: 'Avec qui nous les partageons', body: [
          "Nous ne partageons que ce dont chaque intervenant a besoin pour acheminer votre envoi : transporteurs, agents et manutentionnaires sur le trajet, ainsi que les douanes et autres autorités. Nous ne vendons pas de données personnelles.",
        ] },
        { heading: 'Transferts internationaux', body: [
          "Comme nous transportons des marchandises à travers les frontières, les informations d'envoi voyagent avec elles vers les pays du trajet. Nous ne partageons que ce qu'exigent le transport et la douane.",
        ] },
        { heading: 'Durée de conservation', body: [
          'Nous conservons les données personnelles uniquement le temps nécessaire aux finalités ci-dessus, y compris les durées imposées par les règles fiscales, douanières et de transport.',
        ] },
        { heading: 'Vos droits', body: [
          "Selon votre lieu de résidence (par exemple en vertu de la loi camerounaise n° 2024/017 du 23 décembre 2024 relative à la protection des données à caractère personnel, ou du RGPD de l'UE ou du Royaume-Uni), vous pouvez demander à consulter les données personnelles que nous détenons sur vous, les corriger, les supprimer ou vous opposer à leur utilisation. Vous pouvez aussi déposer une plainte auprès de votre autorité de protection des données.",
        ] },
        { heading: 'Demandes relatives à la vie privée', body: [
          `Écrivez à ${email} en indiquant votre demande et, si elle concerne un envoi, son numéro de suivi. Nous pouvons vous demander de confirmer votre identité avant d'y donner suite.`,
        ] },
      ],
    },
    {
      id: 'terms',
      label: "Conditions d'utilisation",
      title: "Conditions d'utilisation",
      sections: [
        { heading: 'Acceptation des conditions', body: ["En utilisant ce site, vous acceptez les présentes conditions. Lorsque vous réservez un envoi, nos Conditions d'expédition s'appliquent également."] },
        { heading: 'Utilisation du site et du suivi', body: [
          "Vous pouvez utiliser ce site pour demander des devis, réserver des envois et les suivre. Merci de ne pas en faire un usage abusif : pas de collecte automatisée des données de suivi, ni de tentative d'accès aux envois d'autres personnes ou à nos systèmes internes.",
          'Les mises à jour du suivi dépendent des scans effectués sur le trajet et peuvent être retardées. Elles sont fournies à titre indicatif et ne garantissent pas les délais de livraison.',
        ] },
        { heading: 'Devis et réservations', body: [
          "Un devis est valable jusqu'à la date indiquée et couvre l'envoi que vous avez décrit. Si l'envoi s'avère différent (par exemple plus lourd, plus volumineux ou avec un autre contenu), le prix peut changer. Une réservation est confirmée lorsque vous recevez un numéro de suivi.",
        ] },
        { heading: 'Paiement et facturation', body: [
          'Nous facturons chaque envoi, ou selon ce qui a été convenu par écrit avec vous. Le paiement est dû comme indiqué sur la facture. Les droits, taxes et frais fixés par les autorités s\'ajoutent, sauf mention contraire sur votre devis.',
        ] },
        { heading: 'Limitation de responsabilité', body: [
          "Dans les limites permises par la loi, nous ne sommes pas responsables des pertes indirectes ou consécutives liées à votre utilisation de ce site. Notre responsabilité pour les envois est définie dans les Conditions d'expédition.",
        ] },
        { heading: 'Modification des conditions', body: ['Nous pouvons mettre à jour ces conditions. La date en haut de cette page indique la version en vigueur.'] },
        { heading: 'Droit applicable', body: [
          'Les présentes conditions sont régies par le droit de la République du Cameroun. Elles ne vous privent d\'aucun droit que vous accorde le droit de la consommation du pays où vous résidez.',
        ] },
      ],
    },
    {
      id: 'shipping-terms',
      label: "Conditions d'expédition",
      title: "Conditions d'expédition",
      sections: [
        { heading: 'Réservation et acceptation', body: ["Nous acceptons un envoi lorsque nous l'enlevons, ou que vous nous le remettez, et qu'il dispose d'un numéro de suivi. Nous pouvons inspecter, refuser ou retenir tout envoi non conforme aux présentes conditions ou à la loi."] },
        { heading: 'Articles interdits et réglementés', body: ["Vous ne devez rien envoyer d'illégal dans le pays d'origine, de transit ou de destination. Des articles tels que les marchandises dangereuses, l'argent liquide, les armes, les animaux vivants et les denrées périssables sont interdits ou nécessitent notre accord avant la réservation. Les règles varient selon les pays : demandez-nous avant de réserver."] },
        { heading: 'Emballage', body: ["Il vous appartient d'emballer votre envoi pour qu'il résiste à une manutention normale : carton extérieur solide, chaque objet calé, toutes les jointures scellées. Pour les objets de valeur, demandez notre emballage Secure Vault."] },
        { heading: 'Poids facturable', body: ['Nous facturons le plus élevé du poids réel et du poids volumétrique. Poids volumétrique en kg = longueur × largeur × hauteur en cm ÷ 5000.'] },
        { heading: 'Suppléments', body: ['Des suppléments carburant, zone éloignée et douane peuvent s\'appliquer. Tout supplément connu figure sur votre devis.'] },
        { heading: 'Droits et taxes', body: ["La prise en charge des droits et taxes est convenue à la réservation : soit l'expéditeur (droits payés), soit le destinataire (droits non payés)."] },
        { heading: 'Livraison et preuve de livraison', body: ["Nous livrons à l'adresse indiquée lors de la réservation. L'heure de livraison et le nom de la personne qui a signé sont enregistrés avec votre numéro de suivi comme preuve de livraison."] },
        { heading: 'Responsabilité et valeur déclarée', body: ['Notre responsabilité en cas de perte ou de dommage est limitée. Sauf si vous déclarez une valeur et souscrivez une couverture étendue lors de la réservation, l\'indemnisation est limitée à la responsabilité standard de votre service et de votre itinéraire, confirmée à la réservation. Nous ne sommes pas responsables des retards ni des pertes indirectes.'] },
        { heading: 'Réclamations', body: ["Prévenez-nous dans les 7 jours suivant la livraison. Indiquez votre numéro de suivi, une description du problème, des photos des marchandises et de l'emballage, et une preuve de valeur (par exemple la facture commerciale). Nous ouvrons une réclamation et vous tenons informé."] },
        { heading: "Retour à l'expéditeur", body: ["Si un envoi ne peut être ni livré ni dédouané, nous contactons l'expéditeur. Il peut être retourné aux frais de l'expéditeur ; un retour reçoit son propre numéro de suivi."] },
      ],
    },
    {
      id: 'cookies',
      label: 'Politique de cookies',
      title: 'Politique de cookies',
      sections: [
        { heading: 'Les cookies que nous utilisons', body: [
          `Nous utilisons un seul cookie essentiel, tx.sid. Il garde le personnel ${COMPANY_SHORT} connecté à notre console d'opérations pendant 12 heures au maximum. Il n'est pas déposé pour les visiteurs du site public.`,
          "Nous n'utilisons ni cookies d'analyse ni cookies publicitaires. Si nous ajoutons un outil d'analyse, nous mettrons cette page à jour et demanderons votre consentement lorsque la loi l'exige.",
        ] },
        { heading: 'Choix enregistrés dans votre navigateur', body: [
          "Certaines pages mémorisent quelques choix dans le stockage local de votre navigateur. Ces données restent sur votre appareil et ne nous sont pas envoyées :",
          [
            'tx_locale : la langue choisie pour ce site (anglais ou français).',
            'ngf_recent_tracking : les numéros de suivi consultés récemment, pour les rouvrir facilement.',
            "ngf_units : votre préférence entre unités métriques et impériales.",
            "ngf_live_shipment_stream : la dernière mise à jour d'un envoi que vous consultez, pour que vos autres onglets restent à jour.",
          ],
          'Vous pouvez les effacer à tout moment dans les réglages de votre navigateur.',
        ] },
        { heading: 'Autres services utilisés par nos pages', body: [
          "Nos pages chargent des fonds de carte depuis Esri (ArcGIS) et utilisent OpenStreetMap Nominatim et OSRM pour rechercher des adresses et des itinéraires. Les polices et les photos sont servies depuis notre propre site. Ces services reçoivent votre adresse IP lorsque votre navigateur les contacte.",
        ] },
      ],
    },
    {
      id: 'accessibility',
      label: 'Accessibilité',
      title: 'Accessibilité',
      sections: [
        { heading: 'Notre engagement', body: ['Nous voulons que chacun puisse suivre un envoi, réserver et nous contacter. Nous visons le niveau AA des Règles pour l\'accessibilité des contenus Web (WCAG) 2.2 sur l\'ensemble de ce site.'] },
        { heading: 'Ce que nous faisons', body: [[
          'Les formulaires, boutons et menus fonctionnent au clavier et les champs ont des libellés.',
          'Les images ont des alternatives textuelles, et le texte est dimensionné et coloré pour rester lisible.',
          'Les cartes animées respectent le réglage de réduction des animations de votre appareil.',
          "Les pages de suivi donnent l'itinéraire et chaque scan sous forme de texte, pas seulement sur la carte.",
        ]] },
        { heading: 'Signaler un obstacle', body: [
          `Si quelque chose sur ce site est difficile à utiliser, écrivez à ${email}. Indiquez la page et ce qui s'est passé : nous vous aiderons à obtenir ce dont vous avez besoin autrement pendant que nous corrigeons le problème.`,
        ] },
      ],
    },
  ];
}

/** Footer line on generated documents (CONTENT §11) links here. */
export const LEGAL_URL = `${DOMAIN}${pagePath('legal', 'shipping-terms')}`;
