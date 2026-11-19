# TanEx : Contenus du site (français)

> Traduction de `docs/CONTENT.md` (maître anglais), **mêmes numéros de section**. Les dictionnaires
> `src/i18n/fr.ts` sont remplis à partir de ce fichier. Français professionnel, vouvoiement, adapté au Cameroun.
> **Relecture par un locuteur natif côté propriétaire avant le lancement** (tracker #108).
> Typographie : espace insécable avant `: ; ! ?` et à l'intérieur des « guillemets » (géré par le helper i18n).

**Statut :** §1 (dont §1.4), §2, §6.3, §6.8 (statuts), §6.9, §6.11, §7.5, §10.3 et §14 sont rédigés ci-dessous. Les autres sections sont traduites
dans les tâches D.3 / E.x (PROMPTS.md) et ajoutées ici **avant** d'être utilisées dans le code.

| Placeholder | Valeur |
|---|---|
| `{{TAGLINE}}` | De votre porte au monde entier |
| `{{HQ_ADDRESS}}` | Check Point, en face du stade omnisports de Molyko, Buea, Cameroun |
| `{{DOUALA_OFFICE}}` | Kotto, La Canadienne, Douala, Cameroun |
| `{{HOURS}}` | 9 h 00 – 16 h 00 (jours à confirmer) |
| `{{SLOGAN}}` | Saving Situations (à garder en anglais ? à confirmer) |
| Les autres | identiques à CONTENT.md |

---

## 1. Global : métadonnées, en-tête, pied de page

### 1.1 Méta par défaut et par page
- **Titre par défaut :** `TanEx | Livraison à domicile au Cameroun et expédition dans le monde entier`
- **Description par défaut :** `TanEx récupère vos colis à votre porte et les livre à moto dans Buea, Limbe et Douala, en camion entre les villes, et partout dans le monde par avion, bateau, train et route, avec un seul numéro de suivi.`
- **Titre OG :** `TanEx : De votre porte au monde entier`

| Page | `<title>` | Méta description |
|---|---|---|
| Suivi | Suivre un envoi \| TanEx | Saisissez votre numéro de suivi TanEx à 8 caractères pour voir où se trouve votre colis, avec la position du livreur en direct pour les livraisons en ville. |
| Services | Nos services logistiques \| TanEx | Fret aérien, maritime, ferroviaire et routier, entreposage, et livraison à moto dans Buea, Limbe et Douala. |
| Livraison locale | Livraison à moto à Buea, Limbe et Douala \| TanEx | Réservez un livreur TanEx pour récupérer et livrer en ville, et suivez la livraison en direct. |
| Devis | Demander un devis \| TanEx | Dites-nous ce que vous envoyez et où. Notre équipe vous enverra un prix clair. |
| Expédier | Réserver un envoi \| TanEx | Réservez un enlèvement, ajoutez chaque colis et obtenez votre numéro de suivi immédiatement. |
| À propos | À propos de TanEx | Qui nous sommes, notre façon de travailler et l'équipe TanEx à Buea. |
| Réseau | Notre réseau \| TanEx | De notre base à Buea et de la porte d'entrée de Douala jusqu'aux grands carrefours commerciaux du monde. |
| Aide | Centre d'aide \| TanEx | Réponses sur le suivi, la livraison à moto, la réservation, la douane, les paiements et les documents. |
| Contact | Nous contacter \| TanEx | Contactez l'équipe TanEx à Buea par e-mail, téléphone ou WhatsApp. |
| Mentions légales | Politiques \| TanEx | Confidentialité, conditions d'utilisation, conditions d'expédition, cookies et accessibilité. |
| Blog | Blog \| TanEx | Actualités, guides et conseils d'expédition de l'équipe TanEx. |

### 1.1a Page introuvable (404)
- **Titre :** `Page introuvable | TanEx` (noindex ; **à confirmer**, ajouté avec D.2) · **Sur-titre :** `Erreur 404` · **H1 :** `Page introuvable`
- **Texte :** `La page que vous cherchez n'existe pas ou a été déplacée. Vérifiez l'adresse ou utilisez l'un des liens ci-dessous.`
- **Boutons :** `Retour à l'accueil` · `Suivre un envoi` · **Aide :** `Besoin d'aide ?` → `Contactez-nous`

### 1.2 En-tête
- Navigation (menu du propriétaire, 2026-11-09, **à confirmer**) : **Accueil** · **À propos** · **Suivre un envoi** · **Nos services** (Transport aérien · Transport routier · Entreposage · Transport maritime · Transport ferroviaire · Livraison locale · Tous les services) · **Boutique** · **Blog** · **Contactez-nous**. « Réserver un envoi » et « Notre réseau » passent dans le pied de page.
- Page Blog en attendant F.3 (**à confirmer**) : `Blog` · `Articles bientôt disponibles` · `Nous préparons des actualités, des guides et des conseils d'expédition de l'équipe {{COMPANY}}. Revenez bientôt.` · `Suivre un envoi` · `Nous contacter`
- Bouton principal : **Acheter maintenant** (vers la boutique, depuis le 2026-11-19, **à confirmer**) · Langue : `EN | FR`
- Bandeau mobile : `Besoin d'aide ? {{EMAIL}}`
- Libellés d'interface ajoutés avec C.3 (**à confirmer**, relecture native #108) : `Accueil` · `Tous les services` ·
  `Menu` / `Ouvrir le menu` / `Fermer le menu` · `Aller au contenu principal` · `Coordonnées` · `Langue` · titres
  masqués du pied de page : `Bureaux`, `Réseaux sociaux`. (L'indication anglaise « French version coming soon » disparaît
  quand le site français est actif, D.3.)

### 1.3 Pied de page
`Livraison à moto en ville, camions entre les villes, et fret aérien, maritime, ferroviaire et routier vers le monde entier, avec un seul numéro de suivi de la première à la dernière porte.`

**Engagements (4) :**
1. **De la porte au monde.** En ville, au Cameroun et dans le monde.
2. **Suivi en direct.** Suivez votre livreur sur la carte en ville.
3. **Preuve en photo.** Chaque livraison est enregistrée avec une photo et un nom.
4. **Anglais et français.** Notre équipe vous répond dans les deux langues.

**Colonnes :** *Services* Transport aérien · Transport routier · Entreposage · Transport maritime · Transport ferroviaire · Livraison locale — *Entreprise* À propos de TanEx · Notre réseau · Blog · Contact — *Assistance* Suivre un envoi · Réserver un envoi · Réserver une livraison à moto · Centre d'aide · Demander un devis — *Mentions légales* Politique de confidentialité · Conditions d'utilisation · Conditions d'expédition · Retours et remboursements · Politique de cookies (Accessibilité passe à la ligne du bas avec M.8, SHOP_SPEC §18)

**Bureaux :** `Buea (siège)` : `{{HQ_ADDRESS}}` · `Douala` : `{{DOUALA_OFFICE}}` · `Appelez le {{PHONE}} · {{PHONE_2}}` · `Ouvert de {{HOURS}}`

**Ligne du bas :** `© {année} Tanex SARL. Tous droits réservés.` · liens au-delà de la 5e ligne d'une colonne (titre masqué `Autres liens`) · `Propulsé par Web Spectron` (**à confirmer**)

### 1.4 Langue, messages communs et erreurs (ajouté le 2026-11-08 avec D.3, **à confirmer**, relecture native #108)
- **Sélecteur :** `EN | FR` · `English` · `Français` · libellé `Langue` · navigation `Navigation principale` · logo `Accueil {{COMPANY}}`.
- **Bandeau de suggestion** (page d'accueil anglaise, navigateur en français ; toujours en français) :
  `Ce site existe aussi en français.` · lien `Voir le site en français` · bouton `Fermer`.
- **Messages d'erreur** (même codes que CONTENT §1.4) :
  `BAD_REQUEST` Certaines informations sont incorrectes. Vérifiez-les et réessayez. ·
  `AUTH_REQUIRED` Veuillez vous connecter pour continuer. ·
  `FORBIDDEN` Vous n'avez pas l'autorisation de faire cela. ·
  `NOT_FOUND` Nous n'avons pas trouvé ce que vous cherchez. ·
  `CONFLICT` Cet élément a été modifié entre-temps. Actualisez la page et réessayez. ·
  `PAYLOAD_TOO_LARGE` Le fichier est trop volumineux. ·
  `UNSUPPORTED_MEDIA_TYPE` / `MALFORMED_BODY` Cette demande n'a pas pu être lue. Actualisez la page et réessayez. ·
  `RATE_LIMITED` Trop de tentatives. Veuillez patienter un moment, puis réessayer. ·
  `SERVER_ERROR` Un problème est survenu de notre côté. Veuillez réessayer. ·
  `NETWORK` Impossible de joindre notre serveur. Vérifiez votre connexion et réessayez. ·
  `INVALID_TRACKING_ID` Les numéros de suivi commencent par TX et comptent 8 caractères, par ex. TX7K2M9P. ·
  `SHIPMENT_NOT_FOUND` Nous n'avons trouvé aucun envoi avec ce numéro. Vérifiez les caractères et réessayez. ·
  `QUOTE_NOT_FOUND` Nous n'avons trouvé aucun devis avec cette référence. ·
  `NO_PAYMENT_REQUEST` Cet envoi n'a aucune demande de paiement. ·
  `NOT_ACCEPTING` Ce paiement n'attend plus de preuve. Actualisez la page pour voir son statut actuel. ·
  `TOO_MANY_OPEN` Des preuves de ce paiement sont déjà en attente de vérification. Notre équipe les examinera en premier. ·
  `VALIDATION_FAILED` Certaines informations doivent être corrigées. ·
  `MISSING_FIELDS` Le nom et le message sont obligatoires. ·
  `CONTACT_REQUIRED` Veuillez saisir une adresse e-mail ou un numéro de téléphone avec son indicatif pays. ·
  `INVALID_EMAIL` Veuillez saisir une adresse e-mail valide.
- **Page non affichée** (ajouté le 2026-11-12, **à confirmer**) : titre `Cette page ne s'est pas affichée correctement` ·
  texte `Actualiser la page règle généralement le problème. Vos envois et vos demandes ne sont pas affectés.` ·
  aide `Toujours bloqué ? Appelez-nous ou écrivez-nous sur WhatsApp au {phone}, ou par e-mail à {email}.` ·
  boutons `Actualiser la page` · `Aller à l'accueil` · console seulement : `Réessayer` · `Détails techniques`.
- **Heures :** format `9 h 00 – 16 h 00`.

---

## 2. Page d'accueil

### 2.1 Bandeau principal
- **Sur-titre :** `PORTE À PORTE · CAMEROUN ET MONDE ENTIER`
- **H1 :** `De votre porte` / **`au monde entier.`**
- **Texte :** `Livraison à moto le jour même dans Buea, Limbe et Douala, camions entre les villes, et fret aérien, maritime, ferroviaire et routier partout où vous devez aller. Un seul numéro de suivi, de l'enlèvement à la preuve de livraison.` **[à confirmer « le jour même »]**
- **Champ de suivi :** `Suivre un envoi` · `Saisissez votre numéro de suivi, ex. TX7K2M9P` · bouton `Suivre`
- **Boutons :** `Demander un devis` · `Réserver une livraison à moto`
- **Points :** `Suivi du livreur en direct` · `Preuve de livraison en photo` · `Service en anglais et en français`
- **Animation :** voir §2.10

### 2.2 Services (6)
Cartes photo (2026-11-09, **à confirmer**) : titres Transport aérien · Transport routier · Entreposage · Transport maritime · Transport ferroviaire · Livraison locale ; étiquettes `Monde entier` · `Cameroun et région` · `Stockage et expédition` · `Monde entier` · `Liaisons intérieures` · `Buea · Limbe · Douala` ; lien `En savoir plus`.
- **Sur-titre :** `NOS SERVICES` · **H2 :** `Tous les moyens de transport, sous un même toit`
- **Intro :** `D'un document à travers Buea à un conteneur de l'autre côté de l'océan, choisissez le mode adapté à votre marchandise. Nous nous occupons de la réservation, des documents et de chaque transfert.`
1. **Fret aérien.** Expédition internationale rapide de documents, colis et marchandises urgentes, avec les documents douaniers préparés pour vous.
2. **Fret maritime.** Conteneurs complets (FCL) ou groupés (LCL) pour les charges plus lourdes et volumineuses, via les ports du Cameroun.
3. **Fret ferroviaire.** Transport intérieur économique pour les marchandises lourdes et en vrac sur les lignes desservies par le rail. **[à confirmer]**
4. **Fret routier.** Camions et fourgonnettes entre les villes du Cameroun et vers les pays voisins. **[à confirmer]**
5. **Entreposage.** Stockage sécurisé, contrôle des stocks, emballage et expédition quand vous êtes prêt. **[à confirmer]**
6. **Livraison locale.** Livreurs à moto dans Buea, Limbe et Douala, avec suivi en direct et preuve en photo.

### 2.3 Livraison à moto
- **Sur-titre :** `LIVRAISON EN VILLE` · **H2 :** `À travers la ville, sous vos yeux.`
- **Texte :** `Besoin d'envoyer quelque chose d'un bout à l'autre de Buea ? Un livreur TanEx le récupère à votre porte et le remet directement au destinataire. Vous suivez la course en direct sur la carte et recevez une photo et un nom à la livraison.`
- **Étapes :** `Récupéré` · `En route` · `Livré`
- **Prix :** `Partout dans Buea à partir de 500 FCFA.`
- **Points :** `Livreurs à Buea, Limbe et Douala` · `Position en direct pendant le trajet` · `Paiement en espèces à la livraison ou par Mobile Money` · `Preuve en photo à chaque livraison`
- **Bouton :** `Réserver une livraison à moto` · lien `Comment le prix est calculé`

### 2.4 Livraison en camion
- **Sur-titre :** `DE VILLE EN VILLE` · **H2 :** `Les gros chargements, entre les villes.`
- **Texte :** `Quand ça ne tient pas sur une moto, nos camions et fourgonnettes le transportent entre Limbe, Buea, Douala et au-delà. Nous enlevons, chargeons avec soin et livrons à la porte, avec le même numéro de suivi du début à la fin.`
- **Points :** `Meubles, marchandises et palettes` · `Enlèvement et livraison aux deux bouts` · `Suivi de ville en ville`
- **Bouton :** `Devis pour un camion`

### 2.5 Réseau mondial
- **Sur-titre :** `NOTRE RÉSEAU` · **H2 :** `De Buea aux grands carrefours du commerce mondial`
- **Intro :** `Notre base est à Buea, et le port et l'aéroport de Douala sont notre porte vers le monde. De là, nous rejoignons les principaux carrefours d'Europe, d'Afrique, du Moyen-Orient, d'Asie et des Amériques.`
- **Légende :** `Base TanEx` · `Porte d'entrée` · `Route commerciale` · **Lien :** `Voir notre réseau →`

### 2.6 Étiquettes intelligentes
- **Sur-titre :** `ÉTIQUETTES INTELLIGENTES` · **H2 :** `Une étiquette. Chaque étape.`
- **Texte :** `Chaque colis TanEx porte une étiquette à code-barres liée à son numéro de suivi. Chaque scan (à l'enlèvement, à notre bureau, à la porte d'entrée, en douane et à la livraison) met à jour votre page de suivi.`
- **Tuiles :** **8 caractères** « Numéro de suivi » · **Chaque colis** « Étiqueté individuellement » · **En direct** « Mises à jour du statut »

### 2.7 Contactez-nous
- **H2 :** `Contactez-nous`
- **Texte :** `Une question sur une livraison, un prix ou un partenariat ? Envoyez-nous un message et l'équipe TanEx vous répondra.`
- **Formulaire :** Nom · Téléphone ou e-mail · Message · bouton `Envoyer le message`
- **Succès :** **Message reçu.** `Votre référence est TX-TKT-######. Nous vous répondrons dès que possible.`

### 2.8 Questions fréquentes
- **Sur-titre / H2 :** `QUESTIONS FRÉQUENTES` · `Foire aux questions`
1. **Faut-il un compte pour suivre un envoi ?** Non. Saisissez votre numéro de suivi à 8 caractères (par exemple TX7K2M9P) sur la page Suivi. Les données personnelles sont masquées.
2. **Où livrez-vous en ville ?** Nos livreurs couvrent Buea, Limbe et Douala, par exemple d'un quartier de Buea à un autre. Choisissez votre ville et vos quartiers à la réservation pour voir le prix.
3. **Puis-je suivre mon livreur en direct ?** Oui. Dès que votre colis est récupéré, votre page de suivi affiche la position du livreur sur la carte jusqu'à la livraison.
4. **Comment puis-je payer ?** En espèces au livreur, ou par MTN Mobile Money ou Orange Money sur les comptes de l'entreprise TanEx indiqués à la réservation. D'autres moyens de paiement sont disponibles pour les envois internationaux.
5. **Expédiez-vous à l'international ?** Oui. Nous expédions partout dans le monde par avion, bateau, train et route, et préparons avec vous les documents d'exportation.
6. **Puis-je vous écrire en anglais ?** Oui. Notre équipe travaille en français et en anglais.

### 2.9 Sur le blog
- **Sur-titre :** `SUR LE BLOG` · **H2 :** `Actualités et conseils d'expédition` · **Lien :** `Tous les articles →`

### 2.10 Le parcours : étapes et rail de navigation
- **Rail (lecteurs d'écran) :** `Sections de la page` · **Étapes :** `Votre porte` · `Services` · `En ville` · `De ville en ville` · `Le monde` · `L'étiquette` · `Contact` · `Livré`
- **Contrôle :** `Mettre l'animation en pause` / `Reprendre l'animation`
- **Plongée du bandeau :** `Tout commence à votre porte.`
- **Étapes moto :** `Récupéré.` · `En route.` · `Livré.`
- **Camion :** `Trop grand pour la moto ? Le camion prend le relais.`
- **Monde :** `Et quand il faut passer les frontières, il prend l'avion.`
- **Étiquette :** `Chaque étape, une seule étiquette : TX7K2M9P.`
- **Arrivée (pied de page) :** `Livré. De votre porte au monde entier, et jusqu'à une autre porte.`

### 2.11 Libellés d'interface ajoutés avec E.1 (**à confirmer**, relecture native #108)
- **Formulaire de contact :** `Envoyez-nous un message` · `Envoi…` · `Indiquez votre nom, un numéro de téléphone ou un e-mail, et votre message.` · `Saisissez une adresse e-mail ou un numéro de téléphone avec l'indicatif du pays.` · `Nous n'avons pas pu envoyer votre message. Veuillez réessayer.` · `Envoyer un autre message` · `Appeler` · `WhatsApp` · `E-mail` · `Ouvert` · `Comment nous joindre` · `Venez nous voir à Buea` · `Venez nous voir à Douala`
- **Moto :** `Étapes de la livraison`
- **Carte du réseau :** `Carte du réseau TanEx : Buea, Douala et les carrefours commerciaux que nous desservons` · `Choisir un lieu` · `Aérien` · `Maritime` · `Routier` · `Heure locale` · `Nous contacter pour cette route`
- **Étiquette d'exemple :** `Exemple d'étiquette de colis TanEx` · `Origine` · `Destination` · `Poids` · `Service` · `Numéro de suivi : {id}`
- **Titres scindés pour l'accent (C.1) :** `À travers la ville,` / `sous vos yeux.` · `Les gros chargements,` / `entre les villes.` · `De Buea aux grands carrefours du` / `commerce mondial` · `Une étiquette.` / `Chaque étape.` · `Contactez-nous` (entièrement en italique)

---

## 3. Page Services (ajouté avec E.2, **relecture native en attente**, #108)

- **Sur-titre :** `NOS SERVICES` · **H1 :** `Tous les moyens de transport, sous un même toit.`
- **Texte :** `Choisissez le mode adapté à votre marchandise et à vos délais. Nous nous occupons de l'itinéraire, des documents et de chaque transfert.`
- **Sur-titres de section :** `SERVICES` · `COMPARER` · `COMMENT ÇA MARCHE` · `OPTIONS`
- **Libellés :** `Points forts` · `Idéal pour` · boutons `Demander un devis` · `Suivre un envoi`

### 3.1 Services (tous **[à confirmer]**)

**Fret aérien**
- *Résumé :* Expédition aérienne internationale de documents, colis et marchandises urgentes.
- *Points forts :* Enlèvement à votre porte · Documents d'exportation préparés avec vous · Accompagnement au dédouanement · Suivi de l'enlèvement à la livraison
- *Idéal pour :* documents, échantillons, pièces détachées, commandes en ligne, colis personnels à l'étranger

**Fret maritime**
- *Résumé :* Transport maritime en conteneurs complets (FCL) ou groupés (LCL) pour les charges plus volumineuses et plus lourdes.
- *Points forts :* FCL et LCL · Manutention portuaire et documents · Import et export · Livraison à la porte après dédouanement
- *Idéal pour :* stocks d'entreprise, machines, véhicules, déménagements

**Fret ferroviaire**
- *Résumé :* Transport intérieur des marchandises lourdes et en vrac sur les lignes desservies par le rail, complété par la route à chaque extrémité.
- *Points forts :* Économique pour les charges lourdes · Réservé et suivi par notre équipe · Enlèvement et livraison par la route pour compléter le trajet
- *Idéal pour :* marchandises en vrac, matériaux de construction, produits agricoles

**Fret routier**
- *Résumé :* Transport par camion et fourgonnette entre les villes du Cameroun et vers les pays voisins.
- *Points forts :* Chargements complets et partiels · Enlèvement et livraison porte à porte · Suivi de ville en ville
- *Idéal pour :* meubles, stocks de magasin, palettes, livraisons entre Limbe, Buea, Douala et au-delà

**Entreposage**
- *Résumé :* Stockage sécurisé de vos marchandises, avec réception, contrôle des stocks, emballage et expédition.
- *Points forts :* Stockage de courte et longue durée · Marchandises contrôlées et enregistrées à l'entrée · Préparation, emballage et expédition sur demande · Combinable avec tous nos services de transport
- *Idéal pour :* commerçants, vendeurs en ligne, importateurs en attente de livraison

**Livraison locale (moto)**
- *Résumé :* Livraison dans la même ville par les livreurs TanEx à Buea, Limbe et Douala, avec suivi en direct.
- *Points forts :* Récupéré à votre porte · Position du livreur en direct · Preuve de livraison en photo · Espèces ou Mobile Money
- *Idéal pour :* documents, repas, téléphones et petits colis, livraisons de boutiques en ligne

### 3.2 Comparer (tableau)
| Service | Idéal pour | Rapidité | Suivi |
|---|---|---|---|
| Livraison locale | Petits objets dans une même ville | Le plus rapide, même ville | Position du livreur en direct |
| Fret routier | Gros chargements entre les villes | Trajets programmés | Mises à jour de ville en ville |
| Fret aérien | Envois internationaux urgents | Le plus rapide à l'international | Chaque étape |
| Fret maritime | Charges internationales volumineuses ou lourdes | Départs programmés | Chaque étape |
| Fret ferroviaire | Marchandises lourdes et en vrac à l'intérieur du pays | Départs programmés | Chaque étape |
| Entreposage | Stocker avant la livraison | n/a | Registre des stocks |

En-têtes : `Service` · `Idéal pour` · `Rapidité` · `Suivi`

### 3.3 Comment ça marche (4 étapes)
1. **Réservez.** En ligne, sur WhatsApp ou à notre bureau. Vous recevez immédiatement votre numéro de suivi à 8 caractères.
2. **Enlèvement.** Nous récupérons à votre porte, vérifions et étiquetons chaque colis.
3. **Transport.** À moto, en camion, par avion, bateau ou train. Chaque transfert est enregistré.
4. **Livraison.** Livré à la porte, avec une photo et le nom du destinataire comme preuve.

### 3.4 Options **[à confirmer]**
1. **Express (en ville).** Enlèvement prioritaire pour les livraisons urgentes dans la même ville.
2. **Paiement à la livraison.** Le livreur encaisse le prix de votre marchandise auprès du destinataire et nous vous le reversons.
3. **Code de livraison.** Le destinataire donne un code à 4 chiffres au livreur avant la remise.
4. **Emballage.** Nous emballons et protégeons vos objets avant l'expédition.

### 3.6 Appel à l'action (aussi sur À propos)
- **H2 :** `Prêt à envoyer quelque chose ?` · **Texte :** `Obtenez un prix clair, ou réservez une livraison à moto en quelques minutes.` · **Boutons :** `Demander un devis` · `Réserver une livraison à moto`

### 3.7 Libellés ajoutés avec E.2 (**à confirmer**)
- **Titres de section :** `Six façons de transporter` · `Quel service vous convient ?` · `De la réservation jusqu'à la porte` · `Des options quand vous en avez besoin`
- `Services sur cette page` · `Nos services comparés` · `Rapidité` « n/a » s'écrit `Sans objet`

## 4. Page À propos (ajouté avec E.3, **relecture native en attente**)

- **Sur-titre :** `À PROPOS DE TANEX` · **H1 :** `De notre porte à Buea jusqu'à la vôtre, où qu'elle soit.`
- **Texte :** `TanEx est une entreprise de livraison et de logistique basée à Buea, avec un bureau à Douala. Nous transportons les colis en ville à moto, entre les villes en camion, et du Cameroun vers le monde entier par avion, bateau, train et route.`
- **Slogan :** `{{SLOGAN}}.` (gardé en anglais, à confirmer)
- **Notre approche (4) :** sur-titre `NOTRE APPROCHE`
  1. **Un seul numéro de suivi.** De la première à la dernière porte.
  2. **Des livreurs identifiés.** Chaque livraison a un livreur ou un chauffeur TanEx qui en répond.
  3. **Des preuves, pas des promesses.** Une photo et un nom à chaque livraison.
  4. **Deux langues.** Nous vous servons en anglais et en français.
- **Direction :** sur-titre `DIRECTION` · titre `Directeur général` · puis `Responsable des opérations` et `Responsable régional` · texte alternatif de la photo : voir §12
- **Horaires :** `Ouvert 24 h/24, 7 j/7`
- **Notre équipe :** `L'équipe TanEx porte le marron et l'orange que vous verrez à votre porte.`
- **Histoire :** **H2** `Pourquoi TanEx` (masqué tant que le propriétaire n'a pas fourni le texte)

---

## 5. Page Réseau (ajouté avec E.3, **relecture native en attente**)

- **Sur-titre :** `NOTRE RÉSEAU` · **H1 :** `Des racines locales. Une portée mondiale.`
- **Texte :** `Nous livrons chaque jour à Buea, Limbe et Douala, et nous rejoignons par Douala les grands carrefours du commerce mondial.`
- **Blocs :** `Où livrent nos livreurs` · `Nos portes d'entrée et routes commerciales`
- **Champs des cartes :** Nom · Ville, pays · Modes · Heure locale (en direct) · `Nous contacter pour cette route`
- **Rôles :** `Siège` · `Bureau` · `Livraison à moto` · modes `Aérien` · `Maritime` · `Routier`
- **Note :** `Votre destination n'apparaît pas ? Nous expédions bien au-delà de ces carrefours. Parlez-nous de votre itinéraire.`

### 8.6 Libellés ajoutés avec E.4 (**à confirmer**)
- **Aide :** `Rechercher dans le centre d'aide` · `Accès rapides` · `Sujets` · `Livraison locale` · `Paiements` · `{n} réponses`
- **Contact :** `Téléphone` · `WhatsApp` · `E-mail` · `Nos bureaux` · `Horaires d'ouverture` · `Itinéraire` (`Itinéraire : {bureau} (ouvre Google Maps)`) · `(facultatif)` · `Par exemple TX7K2M9P` · `Aucune porte d'entrée` · `Indiquez votre nom, votre e-mail, le sujet et votre message.` · `Saisissez une adresse e-mail valide.` · `Nous n'avons pas pu envoyer votre message. Réessayez, ou écrivez-nous à {email}.` · `Plus de réponses dans le Centre d'aide`
- **Mentions légales :** `Pages juridiques` · `Dernière mise à jour : {date}`

## 9. Liste du réseau

Noms affichés en français : Buea (siège) · Douala (bureau) · Limbe · Douala (porte d'entrée aéroport et port) ·
Paris · Bruxelles · Londres · Francfort · Istanbul · Dubaï · Canton (Guangzhou) · Shanghai · Lagos · Abidjan ·
Johannesburg · New York · Houston. Pays : noms français via `Intl.DisplayNames`.

---

## 12. Textes alternatifs des images

| Emplacement | Texte alternatif |
|---|---|
| about-md | `{{MD_NAME}}, directeur général de TanEx, au bureau TanEx de Buea` (sans le nom : `Le directeur général de TanEx au bureau TanEx de Buea`) |
| scènes moto / camion | (décoratif) |

## 8. Centre d'aide et Contact (ajouté avec E.4, **relecture native en attente**)

### 8.1 Aide : en-tête et accès rapides
- **H1 :** `Comment pouvons-nous vous aider ?` · Recherche : `Cherchez une réponse, ex. douane, délai de livraison, documents`
- Accès rapides : **Suivre un envoi** · **Réserver un enlèvement** · **Demander un devis** · **Bureau des opérations TanEx**
- Aucun résultat : **Aucune réponse trouvée.** `Essayez d'autres mots, ou contactez-nous et nous vous répondrons directement.`
- Bandeau : **Encore besoin d'aide pour un envoi ?** → `Contacter l'assistance`

### 8.2 Aide : base de connaissances (`Réponses aux questions fréquentes`)
**Suivi**
- *Où trouver mon numéro de suivi ?* Sur votre confirmation de réservation, en haut de votre lettre de transport et sur chaque étiquette de colis. Il compte 8 caractères et commence par TX (ex. TX7K2M9P).
- *Pourquoi mon suivi n'a-t-il pas été mis à jour ?* Les mises à jour apparaissent à chaque scan. Sur les longs trajets en avion ou en bateau, plusieurs heures peuvent séparer deux scans. La position estimée continue d'avancer entre-temps.
- *Comment fonctionnent les envois de plusieurs colis ?* Tous les colis partagent un seul numéro de suivi. Chaque colis a sa propre étiquette, terminée par -01, -02, etc.

**Réservation et enlèvement**
- *Quelle est l'heure limite pour un enlèvement le jour même ?* Elle dépend de votre ville et du service. Votre coordinateur la confirme à la réservation. [à confirmer]
- *Comment emballer mon envoi ?* Utilisez un carton extérieur solide, calez chaque objet et scellez toutes les jointures. Pour les objets de valeur, demandez notre emballage Secure Vault.
- *Puis-je changer l'adresse de livraison ?* Oui, tant que l'envoi n'a pas atteint la porte d'entrée de destination. Contactez-nous avec votre numéro de suivi.

**Douane et international**
- *Qui paie les droits et taxes ?* C'est convenu à la réservation : soit l'expéditeur (droits payés), soit le destinataire (droits non payés).
- *De quels documents ai-je besoin ?* En général une facture commerciale et, pour certaines marchandises, des permis ou certificats. Nous vous dirons exactement ce qu'il faut pour votre itinéraire.
- *Que ne puis-je pas expédier ?* Les articles interdits et réglementés varient selon les pays. Consultez nos Conditions d'expédition ou demandez-nous avant de réserver.

**Documents et livraison**
- *Où est ma preuve de livraison ?* Sur votre page de suivi dès la livraison, téléchargeable en PDF.
- *Que faire si mon envoi est endommagé ?* Prévenez-nous dans les 7 jours suivant la livraison, avec des photos [à confirmer]. Nous ouvrons une réclamation et vous tenons informé.

### 8.3 Page Contact
- **H1 :** `Parlez à TanEx`
- **Texte :** `Une question, un devis ou un envoi qui demande de l'attention : un vrai coordinateur vous répondra.`
- **Bureaux :** **Buea, siège** · `Check Point, en face du stade omnisports de Molyko` · **Douala** · `Kotto, La Canadienne` · **Horaires d'ouverture** `{{HOURS}}` · lien `Itinéraire`
- **Formulaire :** `Envoyez-nous un message`. Champs : Nom · E-mail · Téléphone (facultatif) · Sujet (Devis · Envoi en cours · Facturation · Partenariat · Autre) · Numéro de suivi (facultatif) · Message
- **Succès :** **Message reçu.** `Votre référence est TX-TKT-######. Nous répondrons à {email} dès que possible.`
- **Carte d'aide :** **Bureau des opérations TanEx.** `Pour un envoi en cours, indiquez votre numéro de suivi pour une aide plus rapide.`
- **FAQ :** `Réponses rapides`

### 8.4 Libellés d'interface
- **Aide :** `Tous les sujets ({n})` · `Effacer la recherche` · `Appeler le {{PHONE}}`
- **Contact :** `Choisissez un sujet` · `Porte d'entrée` · `Envoyer le message` · `Envoyer un autre message` · `Suivre un envoi`

### 8.5 Aide : livraison locale et paiements
**Livraison locale**
- *Quelles zones vos livreurs couvrent-ils ?* Buea, Limbe et Douala. À la réservation, choisissez votre ville et les quartiers d'enlèvement et de livraison pour voir le prix.
- *Comment le prix est-il calculé ?* Selon la ville, les quartiers d'enlèvement et de livraison et la taille du colis. L'enlèvement express coûte un supplément. Si vos quartiers ne sont pas encore listés, nous confirmons le prix avant l'enlèvement.
- *Le livreur peut-il encaisser de l'argent auprès du destinataire ?* Oui. Choisissez le paiement à la livraison à la réservation et indiquez le montant. Nous vous le reversons comme convenu.
- *Et si le destinataire n'est pas disponible ?* Le livreur essaie de le joindre. Si la livraison ne peut pas se faire, votre page de suivi en indique la raison et notre équipe vous contacte pour convenir d'un nouveau créneau.
- *Pourquoi ne vois-je pas le livreur sur la carte ?* La position apparaît dès que votre colis est récupéré et se met à jour toutes les quelques secondes pendant le trajet.

**Paiements**
- *Quels moyens de paiement acceptez-vous ?* Les espèces au livreur, MTN Mobile Money et Orange Money sur les comptes de l'entreprise TanEx, et pour les envois internationaux les moyens indiqués sur votre demande de paiement.
- *Comment prouver un paiement Mobile Money ?* Envoyez une capture d'écran du SMS de confirmation sur votre page de suivi, avec l'ID de transaction.

## 13. Mentions légales (ajouté avec E.4, **relecture par un juriste et un locuteur natif requise**)

H1 : `Mentions légales`. Onglets : **Politique de confidentialité · Conditions d'utilisation · Conditions d'expédition · Retours et remboursements · Politique de cookies · Accessibilité** (Retours : §13.2, M.8). Chaque onglet affiche `Dernière mise à jour : {date}` (10 novembre 2026). Le droit applicable est celui de la République du Cameroun (à confirmer par le juriste, #112). Le texte est rendu depuis `src/data/legalDocs.ts` (version française dans le même fichier).

**Politique de confidentialité**
1. *Qui nous sommes.* Tanex SARL (« TanEx », « nous ») exploite ce site et transporte les envois qui y sont réservés. Notre siège est situé {{HQ_ADDRESS}}. Pour toute question sur vos données personnelles, écrivez à {{EMAIL}}.
2. *Ce que nous collectons.* Les coordonnées de l'expéditeur et du destinataire que vous nous donnez lors d'une réservation ou d'une demande de devis : noms, entreprise, numéros de téléphone, e-mail et adresses de livraison. · Les données d'envoi : contenu, poids, dimensions, valeur déclarée, ainsi que les scans et événements enregistrés pendant le transport. · Les messages que vous nous envoyez via les formulaires de contact, de rappel et d'assistance. · Des données techniques de base : quand votre navigateur charge nos pages, cartes et polices, les serveurs concernés reçoivent votre adresse IP. Nous n'utilisons aucun outil d'analyse ni de publicité.
3. *Pourquoi nous les utilisons.* Pour enlever, transporter et livrer vos envois. · Pour préparer les documents de douane et d'expédition. · Pour répondre à vos questions, traiter les réclamations et vous tenir informé. · Pour respecter nos obligations légales, fiscales et douanières.
4. *Suivi public.* Toute personne disposant d'un numéro de suivi peut suivre un envoi. La page de suivi publique n'affiche que la ville et le pays à chaque extrémité du trajet, et masque les noms, numéros de téléphone et adresses e-mail.
5. *Avec qui nous les partageons.* Nous ne partageons que ce dont chaque intervenant a besoin pour acheminer votre envoi : transporteurs, agents et manutentionnaires sur le trajet, ainsi que les douanes et autres autorités. Nous ne vendons pas de données personnelles.
6. *Transferts internationaux.* Comme nous transportons des marchandises à travers les frontières, les informations d'envoi voyagent avec elles vers les pays du trajet. Nous ne partageons que ce qu'exigent le transport et la douane.
7. *Durée de conservation.* Nous conservons les données personnelles uniquement le temps nécessaire aux finalités ci-dessus, y compris les durées imposées par les règles fiscales, douanières et de transport.
8. *Vos droits.* Selon votre lieu de résidence (par exemple en vertu de la loi camerounaise n° 2024/017 du 23 décembre 2024 relative à la protection des données à caractère personnel [à confirmer par le juriste], ou du RGPD de l'UE ou du Royaume-Uni), vous pouvez demander à consulter les données personnelles que nous détenons sur vous, les corriger, les supprimer ou vous opposer à leur utilisation. Vous pouvez aussi déposer une plainte auprès de votre autorité de protection des données.
9. *Demandes relatives à la vie privée.* Écrivez à {{EMAIL}} en indiquant votre demande et, si elle concerne un envoi, son numéro de suivi. Nous pouvons vous demander de confirmer votre identité avant d'y donner suite.

**Conditions d'utilisation**
1. *Acceptation des conditions.* En utilisant ce site, vous acceptez les présentes conditions. Lorsque vous réservez un envoi, nos Conditions d'expédition s'appliquent également.
2. *Utilisation du site et du suivi.* Vous pouvez utiliser ce site pour demander des devis, réserver des envois et les suivre. Merci de ne pas en faire un usage abusif : pas de collecte automatisée des données de suivi, ni de tentative d'accès aux envois d'autres personnes ou à nos systèmes internes. · Les mises à jour du suivi dépendent des scans effectués sur le trajet et peuvent être retardées. Elles sont fournies à titre indicatif et ne garantissent pas les délais de livraison.
3. *Devis et réservations.* Un devis est valable jusqu'à la date indiquée et couvre l'envoi que vous avez décrit. Si l'envoi s'avère différent (par exemple plus lourd, plus volumineux ou avec un autre contenu), le prix peut changer. Une réservation est confirmée lorsque vous recevez un numéro de suivi.
4. *Paiement et facturation.* Nous facturons chaque envoi, ou selon ce qui a été convenu par écrit avec vous. Le paiement est dû comme indiqué sur la facture. Les droits, taxes et frais fixés par les autorités s'ajoutent, sauf mention contraire sur votre devis.
5. *Limitation de responsabilité.* Dans les limites permises par la loi, nous ne sommes pas responsables des pertes indirectes ou consécutives liées à votre utilisation de ce site. Notre responsabilité pour les envois est définie dans les Conditions d'expédition.
6. *Modification des conditions.* Nous pouvons mettre à jour ces conditions. La date en haut de cette page indique la version en vigueur.
7. *Droit applicable.* Les présentes conditions sont régies par le droit de la République du Cameroun [à confirmer par le juriste]. Elles ne vous privent d'aucun droit que vous accorde le droit de la consommation du pays où vous résidez.

**Conditions d'expédition**
1. *Réservation et acceptation.* Nous acceptons un envoi lorsque nous l'enlevons, ou que vous nous le remettez, et qu'il dispose d'un numéro de suivi. Nous pouvons inspecter, refuser ou retenir tout envoi non conforme aux présentes conditions ou à la loi.
2. *Articles interdits et réglementés.* Vous ne devez rien envoyer d'illégal dans le pays d'origine, de transit ou de destination. Des articles tels que les marchandises dangereuses, l'argent liquide, les armes, les animaux vivants et les denrées périssables sont interdits ou nécessitent notre accord avant la réservation. Les règles varient selon les pays : demandez-nous avant de réserver.
3. *Emballage.* Il vous appartient d'emballer votre envoi pour qu'il résiste à une manutention normale : carton extérieur solide, chaque objet calé, toutes les jointures scellées. Pour les objets de valeur, demandez notre emballage Secure Vault.
4. *Poids facturable.* Nous facturons le plus élevé du poids réel et du poids volumétrique. Poids volumétrique en kg = longueur × largeur × hauteur en cm ÷ 5000.
5. *Suppléments.* Des suppléments carburant, zone éloignée et douane peuvent s'appliquer. Tout supplément connu figure sur votre devis.
6. *Droits et taxes.* La prise en charge des droits et taxes est convenue à la réservation : soit l'expéditeur (droits payés), soit le destinataire (droits non payés).
7. *Livraison et preuve de livraison.* Nous livrons à l'adresse indiquée lors de la réservation. L'heure de livraison et le nom de la personne qui a signé sont enregistrés avec votre numéro de suivi comme preuve de livraison.
8. *Responsabilité et valeur déclarée.* Notre responsabilité en cas de perte ou de dommage est limitée. Sauf si vous déclarez une valeur et souscrivez une couverture étendue lors de la réservation, l'indemnisation est limitée à la responsabilité standard de votre service et de votre itinéraire, confirmée à la réservation. Nous ne sommes pas responsables des retards ni des pertes indirectes.
9. *Réclamations.* Prévenez-nous dans les 7 jours suivant la livraison. Indiquez votre numéro de suivi, une description du problème, des photos des marchandises et de l'emballage, et une preuve de valeur (par exemple la facture commerciale). Nous ouvrons une réclamation et vous tenons informé.
10. *Retour à l'expéditeur.* Si un envoi ne peut être ni livré ni dédouané, nous contactons l'expéditeur. Il peut être retourné aux frais de l'expéditeur ; un retour reçoit son propre numéro de suivi.

**Politique de cookies**
1. *Les cookies que nous utilisons.* Nous utilisons un seul cookie essentiel, tx.sid. Il garde le personnel TanEx connecté à notre console d'opérations pendant 12 heures au maximum. Il n'est pas déposé pour les visiteurs du site public. · Nous n'utilisons ni cookies d'analyse ni cookies publicitaires. Si nous ajoutons un outil d'analyse, nous mettrons cette page à jour et demanderons votre consentement lorsque la loi l'exige.
2. *Choix enregistrés dans votre navigateur.* tx_locale (langue choisie) · tx_recent_tracking · tx_units · tx_live_shipment_stream · tx_motion_paused (animation de l'accueil en pause, ajouté en H.1, **à confirmer**) : texte complet dans `src/data/legalDocs.ts`.
3. *Autres services utilisés par nos pages.* Nos pages chargent des fonds de carte depuis Esri (ArcGIS) et utilisent OpenStreetMap Nominatim et OSRM pour rechercher des adresses et des itinéraires. Les polices et les photos sont servies depuis notre propre site. Ces services reçoivent votre adresse IP lorsque votre navigateur les contacte.

**Accessibilité**
1. *Notre engagement.* Nous voulons que chacun puisse suivre un envoi, réserver et nous contacter. Nous visons le niveau AA des Règles pour l'accessibilité des contenus Web (WCAG) 2.2 sur l'ensemble de ce site.
2. *Ce que nous faisons.* Les formulaires, boutons et menus fonctionnent au clavier et les champs ont des libellés. · Les images ont des alternatives textuelles, et le texte est dimensionné et coloré pour rester lisible. · Les cartes animées respectent le réglage de réduction des animations de votre appareil. · Les pages de suivi donnent l'itinéraire et chaque scan sous forme de texte, pas seulement sur la carte.
3. *Signaler un obstacle.* Si quelque chose sur ce site est difficile à utiliser, écrivez à {{EMAIL}}. Indiquez la page et ce qui s'est passé : nous vous aiderons à obtenir ce dont vous avez besoin autrement pendant que nous corrigeons le problème.

### 13.2 Retours et remboursements (boutique ; ajouté le 2026-11-17, **approuvé par le propriétaire le 2026-11-17 (#178) ; relecture d'un juriste (#11) et d'un locuteur natif encore requise**)
Sixième onglet des mentions légales, id `returns` (SHOP_SPEC §18). Libellé de l'onglet et du pied de page
`Retours et remboursements` ; titre de la page `Retours et remboursements`. Valeurs approuvées : comme CONTENT §13.2.

**Retours et remboursements**
1. *À propos de cette politique.* Cette politique s'applique aux produits achetés dans la boutique {{COMPANY}} sur {{DOMAIN}}. Elle ne concerne pas les livraisons et les envois que vous réservez chez nous, qui relèvent de nos Conditions d'expédition. Rien dans cette politique ne limite les droits que vous accorde la loi sur la protection des consommateurs qui vous est applicable.
2. *Vérifiez votre commande à la réception.* Vérifiez vos articles à la réception, si possible devant le livreur. S'il manque quelque chose, si un article est endommagé ou ne correspond pas à votre commande, dites-le au livreur et contactez-nous dans les **48 heures** suivant la livraison ou le retrait, avec votre numéro de commande et des photos du problème.
3. *Article erroné, endommagé ou défectueux.* Si nous vous avons envoyé le mauvais article, ou s'il est arrivé endommagé ou défectueux, nous corrigeons la situation sans frais pour vous. Nous récupérons l'article gratuitement à {{LOCAL_CITIES}} et organisons son retour depuis les autres villes à nos frais. Vous choisissez ensuite un remplacement (si nous en avons en stock) ou le remboursement complet de l'article et des frais de livraison payés pour celui-ci.
4. *Si vous changez d'avis.* Vous pouvez retourner un article dans les **7 jours** suivant sa réception s'il n'a pas été utilisé, s'il est complet et dans son emballage d'origine avec toutes ses étiquettes et ses accessoires. Déposez-le dans l'une de nos agences, ou nous pouvons le récupérer au tarif de livraison habituel. Nous remboursons le prix payé pour l'article ; les frais de livraison initiaux ne sont pas remboursés.
5. *Articles non repris.* Sauf s'ils sont erronés, endommagés ou défectueux, nous ne pouvons pas reprendre : les articles utilisés, portés, lavés ou montés · les cosmétiques et produits d'hygiène et de soin dont le scellé ou l'emballage a été ouvert · les denrées alimentaires et autres produits périssables · les articles fabriqués, coupés ou modifiés à votre demande · les articles marqués « Vente finale » sur leur fiche produit.
6. *Comment retourner un article.* Contactez-nous avant tout renvoi : écrivez à {{EMAIL}}, ou appelez-nous ou écrivez-nous sur WhatsApp au {{PHONE}} ou au {{PHONE_2}}. Indiquez votre numéro de commande, la référence produit de chaque article (elle commence par TX-PRD et figure dans votre confirmation de commande), le motif du retour et des photos si l'article est endommagé. Nous vous confirmerons si l'article peut être retourné et organiserons son enlèvement ou son dépôt dans notre agence.
7. *À la réception de votre retour.* Nous vérifions chaque article retourné à son arrivée. S'il remplit les conditions ci-dessus, nous lançons votre remboursement ou envoyons le remplacement. Sinon, nous vous en expliquons la raison et organisons la restitution de l'article.
8. *Remboursements.* Nous remboursons dans les **7 jours** suivant la réception et la vérification de l'article, par le moyen utilisé pour payer : MTN MoMo ou Orange Money vers le numéro qui a servi au paiement, ou en espèces dans notre agence si vous avez payé en espèces. Nous vous communiquons la référence du remboursement. Nous ne vous demanderons jamais votre code PIN ni aucun mot de passe pour un remboursement.
9. *Échanges.* Pour échanger un article contre un autre produit ou une autre taille, dites-le-nous en nous contactant. Si le nouvel article est en stock, nous l'échangeons directement et vous payez ou recevez la différence de prix ; sinon, nous remboursons l'article retourné et vous pouvez passer une nouvelle commande.
10. *Annuler une commande.* Vous pouvez annuler gratuitement à tout moment avant que votre commande ne quitte notre agence. Appelez-nous, écrivez-nous sur WhatsApp ou par e-mail avec votre numéro de commande. Si vous avez déjà payé, nous vous remboursons intégralement comme indiqué à la section 8. Si vous refusez une livraison à votre porte pour une raison non prévue à la section 3, nous pouvons facturer les frais de livraison.
11. *Contact.* Questions sur un retour ou un remboursement : {{EMAIL}} · {{PHONE}} · {{PHONE_2}}. {{LEGAL_NAME}}, {{HQ_ADDRESS}}.

## 6. Suivi, résultat du suivi, chargement, assistance (ajouté avec E.5, **relecture native en attente**)

### 6.1 Page Suivi
- **H1 :** `Suivre votre envoi`
- **Texte :** `Saisissez votre numéro de suivi TanEx à 8 caractères pour voir où se trouve votre envoi en ce moment.`
- **Champ :** `ex. TX7K2M9P` · **Bouton :** `Suivre`
- **Validation :** `Les numéros de suivi commencent par TX et comptent 8 caractères, ex. TX7K2M9P.`
- **Introuvable :** `Nous n'avons trouvé aucun envoi avec le numéro {id}. Vérifiez les caractères et réessayez, ou contactez-nous et nous le retrouverons pour vous.`
- **« Où trouver votre numéro » (3 cartes) :**
  1. **Confirmation de réservation.** Dans l'e-mail ou le message WhatsApp envoyé lors de la réservation.
  2. **Lettre de transport / étiquette.** Imprimé en haut de votre lettre de transport et sur l'étiquette de chaque colis.
  3. **Votre coordinateur.** Tout coordinateur TanEx peut le retrouver à partir de votre nom, d'une référence ou de votre numéro de téléphone.
- **Suivi multiple :** **Suivre plusieurs envois** · `Saisissez jusqu'à 10 numéros de suivi, un par ligne.`
- **Bandeau d'aide :** **Besoin d'aide pour un envoi en cours ?** `Notre équipe est là pour vous aider.` → `Contacter l'assistance`

### 6.2 Écran de chargement
`Localisation de votre envoi…` · `Vérification des derniers scans…` · `Tracé de l'itinéraire…`

### 6.3 Résultat du suivi : libellés
- Statuts : **Réservé** · **Enlevé** · **À la porte d'entrée d'origine** · **Parti** · **En transit** · **Arrivé à la porte d'entrée de destination** · **Dédouanement** · **En cours de livraison** · **Livré** · **En attente** · **Retardé** · **Retour à l'expéditeur**
- Panneaux : **Résumé de l'envoi** · **Itinéraire** · **Historique du trajet** · **Colis** · **Documents** · **Besoin d'aide ?**
- Modes : `Par avion` · `Par bateau` · `Par route`
- Site public pour les actions de l'administration : `Centre des opérations TanEx`
- Livraison estimée : `Livraison estimée : {date}, {créneau} ({fuseau horaire local})`
- Livré : `Livré le {date} à {heure}. Signé par {nom masqué}.`

### 6.4 Fenêtre d'assistance
- **H3 :** `Comment pouvons-nous vous aider pour cet envoi ?`
- Champs : Numéro de suivi · Type de problème (Retard · Changement d'adresse · Dommage · Question de douane · Autre) · Message · E-mail · Nom
- Bouton : `Ouvrir un ticket` · **Succès :** `Ticket TX-TKT-###### ouvert pour {numéro de suivi}. Nous répondrons à {e-mail} rapidement.`

### 6.5 Libellés d'interface
- Onglets : `Un numéro` · `Suivre plusieurs envois` · recherches récentes : `Suivis récemment`
- Résultats multiples : `Ouvrir le suivi` · `Dernier passage` · `{n} sur {m} trouvés`
- Résultat : `Retour au suivi` · `Dernier scan` · `Afficher l'historique des scans` / `Masquer l'historique des scans`
- Anciens statuts : Exception → En attente · Tentative de livraison → Retardé · Sur un site → En transit · Créé / En attente d'enlèvement → Réservé · Annulé → `Annulé`

### 6.6 Photos du colis
- `Photos du colis` · `Photos ajoutées par notre équipe pour cet envoi.` · `Aucune photo n'a encore été ajoutée pour cet envoi.`
- Sans légende : `Photo de l'envoi {n}` · Visionneuse : `Photo {n} sur {total}` · `Photo précédente` · `Photo suivante` · `Fermer` · `Ouvrir la photo : {légende}`

## 7. Devis, Expédier, Résultat du devis (ajouté avec E.5, **relecture native en attente**)

### 7.1 Page Devis
- **H1 :** `Demander un devis`
- **Texte :** `Dites-nous ce que vous transportez et où. Un coordinateur confirmera votre tarif, généralement le jour ouvrable même. [à confirmer]`
- **Carte latérale :** **Des réponses claires, sans surprise.** `Votre devis indique le service, le délai de transit estimé et tous les frais connus : le prix que vous acceptez est le prix que vous payez (droits et taxes selon le cas).`
- **Succès :** `Demande de devis reçue`
- **Et ensuite :** 1. Un coordinateur étudie votre itinéraire et votre marchandise. 2. Vous recevez votre tarif par e-mail avec un lien sécurisé vers le devis. 3. Acceptez-le en ligne et nous réservons votre enlèvement.

### 7.2 Résultat du devis
- **H1 :** `Votre devis TanEx` · `Référence du devis` · `Valable jusqu'au` · `Itinéraire` · `Service` · `Transit estimé` · `Détail des frais` · `Total`
- Pied : `{{DOMAIN}} · Lien de devis sécurisé` · Boutons : `Accepter et réserver` · `Télécharger le PDF` · `Poser une question`

### 7.3 Page Expédier
- **H1 :** `Réserver un envoi`
- Étapes : **1. Expéditeur et enlèvement** · **2. Destinataire et livraison** · **3. Colis** · **4. Service et options** · **Récapitulatif**
- **Succès :** `Envoi réservé` · `Votre numéro de suivi est {ID}. Les étiquettes de chaque colis sont prêtes à imprimer.`
- **Et ensuite :** Imprimez et collez une étiquette sur chaque colis · Tenez l'envoi prêt à l'heure d'enlèvement · Suivez l'avancement à tout moment avec votre numéro

### 7.4 Libellés d'interface
- **Formulaire de devis :** `1. Itinéraire` (`De` / `À`) · `2. Marchandise` · `3. Service` · `4. Vos coordonnées`; `Colis` · `Poids` · `Valeur déclarée` · `Dimensions` · `Contenu` · `Service` · `Mode de transport` · `Instructions particulières` · `Nom` · `Entreprise` · `E-mail` · `Téléphone`; bouton `Demander un devis`
- **Succès du devis :** `Référence du devis {ref}` · `Et ensuite` · `Voir votre devis` · `Demander un autre devis`
- **Résultat :** statuts `En cours d'étude` · `Prêt` · `Accepté` · `Réservé` · `Refusé` · `Expiré`; `Transport ({route})` · `Manutention hors gabarit` · `Manutention spéciale`; `Devis accepté` · `Nous allons réserver votre enlèvement.` · `Numéro de suivi {ID}` · `Copier la référence` · `Vos coordonnées` · `Bureau des opérations TanEx`
- **Expédier :** `Réserver un enlèvement` · `Dépôt au bureau TanEx` · `Heure d'enlèvement`; `Nom de l'expéditeur` · `Nom du destinataire` · `Téléphone` · `Adresse` · `Entreprise` · `Instructions de livraison` · `Contenu`; `Continuer` · `Retour` · `Ajouter un colis` · `Réserver l'envoi` · `Imprimer les étiquettes` · `Copier le numéro de suivi` · `Réserver un autre envoi`
- **Note du récapitulatif :** `Votre coordinateur confirme le tarif avant l'enlèvement.`

### 6.7 Moyens de paiement : libellés
- Copie : `Copier` → `Copié` · `{champ} copié` · `Impossible de copier. Sélectionnez {champ} et copiez-le manuellement.`
- Avertissement crypto : `Envoyez uniquement des {coin} sur le réseau {network}. Les fonds envoyés sur un autre réseau peuvent être perdus.`
- Western Union : `Après l'envoi, saisissez le MTCN (numéro de contrôle du transfert) comme référence de paiement.`
- MoneyGram : `Après l'envoi, saisissez le numéro de référence MoneyGram comme référence de paiement.`
- Noms des champs : voir le tableau §6.7 (traductions dans `src/i18n/fr/payment.ts`, relecture native).

### 6.8 Section paiement
- **Titre :** `Paiement` · **Intro :** `Un paiement est dû pour cet envoi. Payez sur l'un des comptes ci-dessous, puis envoyez-nous votre preuve de paiement.`
- **Libellés :** `Montant dû` · `Objet` · `À payer avant le` · `Note de notre équipe`
- **Statuts :** `En attente de paiement` · `Preuve en cours de vérification` · `Payé` · `Annulé`
- **Comptes :** `Comment payer` · `Choisissez l'un des {n} moyens de paiement` (`1 moyen de paiement`) · `Choisissez un compte. Vous ne payez qu'une seule fois.` · `Afficher les détails` / `Masquer les détails` · `Afficher le QR code` / `Masquer le QR code` · `QR code pour {method}` · `Scannez avec votre portefeuille ou l'appareil photo.`
- **Payé :** `Paiement reçu` · `Merci. Nous avons reçu votre paiement le {date}.` · `Merci. Nous avons bien reçu votre paiement.` · `Afficher les comptes de paiement` / `Masquer les comptes de paiement`
- **Preuve :** `Envoyer une preuve de paiement` · `Déjà payé ? Envoyez votre reçu pour que nous puissions le confirmer.` · `Après le paiement, envoyez une capture d'écran ou une photo du reçu pour que notre équipe le confirme.`
- **Champs :** `Compte sur lequel vous avez payé` (`Choisissez un compte`) · `Votre nom` (`Le nom de l'expéditeur du paiement`) · `Montant envoyé` · `Référence du paiement (facultatif)` (`ID de transaction, MTCN ou numéro de référence`) · `Capture d'écran du paiement` (`JPG, PNG, WebP ou HEIC. Seule notre équipe peut la voir.`)
- **Boutons :** `Choisir une image` · `Changer d'image` · `Retirer l'image` · `Envoyer la preuve` · `Envoi…`
- **Erreurs :** `Choisissez le compte sur lequel vous avez payé.` · `Saisissez le nom de l'expéditeur du paiement.` · `Saisissez le montant envoyé.` · `Ajoutez une capture d'écran du paiement.` · `Ce fichier n'est pas une image. Envoyez un JPG, PNG, WebP ou HEIC.` · `Impossible de lire cette image. Essayez un autre fichier ou faites une nouvelle capture d'écran.`
- **Succès :** `Merci. Votre preuve de paiement a été envoyée. Nous la vérifierons et mettrons cette page à jour.`
- **En vérification :** `Preuve en cours de vérification` · `Nous avons reçu votre preuve le {date} à {heure}. Notre équipe va la vérifier et mettre cette page à jour.`
- **Refusée :** `Preuve non acceptée : {motif}` · `Vérifiez les informations et envoyez une nouvelle preuve ci-dessous.`

### 6.10 Moyens de paiement ajoutés pour TanEx
- `MTN Mobile Money` : `Nom du compte` · `Numéro MoMo` · `Code marchand` (facultatif)
- `Orange Money` : `Nom du compte` · `Numéro Orange Money` · `Code marchand` (facultatif)
- `Paiement à la livraison` : `Payez le livreur en espèces à l'arrivée de votre colis. Demandez la référence de votre reçu.`
- **Aide pour les preuves MoMo/OM :** `Saisissez l'ID de transaction de votre SMS de confirmation.`

## 6.3 Suivi : noms des statuts (ajouté le 2026-11-08 avec D.3, **à confirmer**)
`Réservé` · `Récupéré` · `À la plateforme de départ` · `Parti` · `En transit` · `Arrivé à la plateforme de destination` ·
`Dédouanement` · `En cours de livraison` · `Livré` · `En attente` · `Retardé` · `Retour à l'expéditeur` · `Annulé`

## 6.8 Paiement : statuts (ajouté le 2026-11-08 avec D.3, **à confirmer**)
`En attente de paiement` · `Preuve en cours de vérification` · `Payé` · `Annulé`

## 6.11 Événements écrits par le système (ajouté le 2026-11-08 avec D.3, **à confirmer**)
`Envoi enregistré et code-barres attribué` · `Envoi enregistré à partir d'un devis` · `Envoi retour enregistré` ·
`Retour à l'expéditeur : {motif}` · `Parti de la plateforme, en transit` · `Paiement confirmé` · `Scan de contrôle vérifié` ·
un changement de statut sans titre affiche le nom du statut (§6.3). La description de l'événement reste en anglais
(texte enregistré) jusqu'à une tâche ultérieure.
- *Livraisons locales et entre villes (ajouté le 2026-11-14 avec G.1, **à confirmer**) :* `Livraison demandée` ·
  `Livraison confirmée` · `Livreur assigné` · `Récupéré par {prénom du livreur}` · `En route vers le destinataire` ·
  `Livré, reçu par {nom masqué}` · `Tentative de livraison infructueuse : {motif}` (motifs §10.3) ·
  `Retourné à l'expéditeur` · `Livraison annulée`.
- *Statuts des courses (console et application livreur, ajouté avec G.1, **à confirmer**) :* `Demandée` · `Confirmée` ·
  `Assignée` · `Acceptée` · `Colis récupéré` · `En route` · `Livrée` · `Tentative de livraison infructueuse` ·
  `Retournée à l'expéditeur` · `Annulée` · tailles `Petit` · `Moyen` · `Grand`

## 6.9 Suivi : livraisons locales et entre villes
- **Étapes :** `Demandée` · `Livreur assigné` · `Récupéré` · `En route` · `Livré` · échec : `Tentative de livraison infructueuse`
- **Livreur :** `Votre livreur` / `Votre chauffeur` · `Moto` / `Fourgonnette` / `Camion`
- **Carte :** `Position en direct` · `Mise à jour il y a {n} secondes` · `En attente de la prochaine position du livreur`
- **Arrivée :** `Arrivée dans environ {n} min` · `Estimation basée sur la position actuelle du livreur`
- **Livré :** `Livré à {heure}, reçu par {nom masqué}.` · `Preuve photo enregistrée` · **Partager :** `Partager le suivi sur WhatsApp`
- *Ajouté avec G.7 (17/11/2026, **à confirmer**, #171) :* `Livraison locale` / `Livraison entre villes` · `Retour au suivi` · `Avancement de la livraison` · `Notre équipe vous contactera pour convenir d'un nouveau créneau.` · `Retournée à l'expéditeur` · `Livraison annulée` · `Photo de {name}` · `En attente de la prochaine position du chauffeur` · `Estimation basée sur la position actuelle du chauffeur` · `Arrivée dans environ {h} h {m} min` · `Itinéraire` · `Carte de l'itinéraire de la livraison` · `Zone d'enlèvement` / `Zone de livraison` / `Livreur` · `De` / `À` · `Besoin d'aide ?` · `Notre équipe est là pour vous aider.` · `Contacter le support`

## 7.5 Réserver une livraison à moto
- **H1 :** `Réserver une livraison à moto` · **Texte :** `Dans Buea, Limbe ou Douala. Un livreur TanEx récupère le colis à la porte et le remet au destinataire, et vous suivez la course en direct.`
- **Étapes :** `1. Ville` · `2. Enlèvement` · `3. Livraison` · `4. Colis` · `5. Paiement` · `Récapitulatif`
- **Champs :** `Ville` · `Quartier` · `Point de repère ou indications` (ex. `« En face de la station Total, portail bleu »`) · `Nom du contact` · `Téléphone du contact` · `Position sur la carte (facultatif)` · `Nom du destinataire` · `Téléphone du destinataire` · `Taille du colis` (`Petit : tient dans un sac à dos` · `Moyen : tient dans le coffre du livreur` · `Grand : nécessite une fourgonnette`) · `De quoi s'agit-il ?` · `Enlèvement express` · `Qui paie ?` (`Moi` / `Le destinataire`) · `Encaisser le prix de ma marchandise (paiement à la livraison)` + `Montant` · `Heure d'enlèvement souhaitée` · `Votre e-mail (facultatif, pour le reçu)`
- **Prix :** `Prix de la livraison : {montant}` · sans tarif : `Nous vous confirmerons le prix par téléphone ou WhatsApp avant l'enlèvement.`
- **Bouton :** `Réserver la livraison` · `Réservation…`
- **Succès :** **Livraison réservée.** `Votre numéro de suivi est {ID}.` · `Suivre cette livraison` · `Envoyer le suivi au destinataire sur WhatsApp` · `Réserver une autre livraison`
- *Ajouté avec G.6 (17/11/2026, **à confirmer**, #171, relecture native #108) :* `Livraison à moto` · `Choisissez une ville` · `Choisissez un quartier` · `Mon quartier n'est pas dans la liste` · `(facultatif)` · `Laissez vide pour un enlèvement dès que possible.` · `Ajouter un repère` · `Retirer le repère` · `Touchez la carte à l'endroit où le livreur doit aller. Vous pouvez déplacer le repère.` · `Repère ajouté.` · `Carte du point d'enlèvement` / `Carte du point de livraison` · `Vérification du prix…` · `Choisissez la ville, les quartiers et la taille du colis pour voir le prix.` · gros colis : `Les gros colis voyagent en fourgonnette. Nous vous confirmerons le prix avant l'enlèvement.` · `La réservation en ligne n'est pas encore ouverte. Appelez-nous ou écrivez-nous sur WhatsApp et nous réserverons votre livraison.` · `Nous n'avons pas pu charger les zones de livraison. Vérifiez votre connexion et réessayez.` · `Réessayer` · erreurs : `Choisissez une ville.` · `Choisissez le quartier ou décrivez un point de repère.` · `Saisissez le nom du contact.` · `Saisissez un numéro de téléphone valide.` · `Saisissez le nom du destinataire.` · `Saisissez le numéro de téléphone du destinataire.` · `Choisissez la taille du colis.` · `Saisissez le montant à encaisser.` · `Choisissez une heure entre maintenant et 30 jours d'ici.` · `Saisissez une adresse e-mail valide, ou laissez le champ vide.` · `Vérifiez les champs signalés.` · `Nous n'avons pas pu réserver votre livraison. Vérifiez votre connexion et réessayez.` (texte complet : `src/i18n/fr/localDelivery.ts`)

## 10. Console (ajouté le 18/11/2026 avec I.2, **à confirmer**, #189, relecture native #108)
- La console s'affiche dans la langue du membre du personnel (**Mon compte → Langue**) ; avant la connexion, un
  sélecteur `English` · `Français` en haut de l'écran de connexion.
- **Texte complet :** `src/i18n/fr/console/` (un fichier par groupe d'écrans ; mêmes clés que l'anglais, vérifiées
  par la compilation). Ce n'est pas recopié ici pour éviter deux sources ; la relecture se fait dans ces fichiers.
- **Vocabulaire retenu** (aligné sur l'application livreur approuvée) : shipment → `envoi` · consignment → `envoi` ·
  tracking ID → `numéro de suivi` · courier → `livreur` · job → `course` · pickup → `enlèvement` · drop-off →
  `livraison` · dispatch → `Répartition` · area → `quartier` · tariffs/rates → `Tarifs` / `tarifs` · quote →
  `devis` · proof of payment → `preuve de paiement` · handover → `remise` · waybill → `lettre de transport` ·
  bill of lading → `connaissement` · audit log → `Journal d'audit` · hold → `retenue` · scanner → `Scanner`.
- Les documents imprimés et les valeurs enregistrées sur les envois restent en anglais (#189).

## 10.3 Application livreur
- `Courses du jour` · `En service` / `Hors service` · `Aucune course pour l'instant. Les nouvelles courses s'affichent ici.` · `Nouvelle course assignée`
- `Enlèvement` · `Livraison` · `Appeler` · `WhatsApp` · `Ouvrir dans Maps` · `Montant à encaisser : {montant}` · `Express`
- `Accepter la course` · `Refuser` · `Récupéré` · `Je suis en route` · `Livré` · `Livraison impossible`
- `Nom du destinataire` · `Prendre une photo` · `Reprendre` · `Signature (facultatif)` · `Code de livraison` · `Montant encaissé` · `Moyen` (`Espèces` / `MTN MoMo` / `Orange Money`) · `ID de transaction` · `Confirmer la livraison`
- Motifs : `Destinataire injoignable` · `Destinataire absent` · `Mauvaise adresse` · `Refusé` · `Livraison dangereuse` · `Problème de véhicule` · `Autre`
- `Enregistré sur le téléphone, sera synchronisé` · `Synchronisé` · `Hors ligne` · `Gardez l'application ouverte pendant la livraison pour que le client puisse vous suivre.` · `La localisation est désactivée. Activez-la pour partager votre position pendant les livraisons.`
- `Ma caisse` · `Solde` · `Déclarer un versement` · `En attente de confirmation` · `Confirmé`
- *Ajouté le 14/11/2026 avec G.4 (**approuvé par le propriétaire le 14/11/2026**, suivi #167 ; versement par MoMo / Orange Money et délai de 7 jours ajoutés après #169) :* texte complet dans `src/i18n/fr/courier.ts` (en-tête `Livreur`, menu `Aujourd'hui` · `Caisse` · `Historique` · `Profil`, paiement à l'enlèvement, preuve de livraison, localisation, caisse, profil, messages d'erreur). Relecture native nécessaire (#108).

## 14. Modèles de notifications

| Clé | Français |
|---|---|
| `booking.confirmed` | `Bonjour {name}, votre réservation TanEx est confirmée. Numéro de suivi : {id}. Suivez-la ici : {link}` · e-mail (*objet ajouté avec G.8, à confirmer*) : Objet `Votre réservation TanEx {id} est confirmée`, même texte |
| `local.share_recipient` | `Bonjour {name}, {sender} vous envoie un colis avec TanEx. Suivez la livraison en direct : {link}` |
| `local.assigned` | `Votre livreur TanEx {rider} prend en charge {id}. Suivi : {link}` |
| `local.on_the_way` | `Votre colis {id} est en route avec {rider}. Suivez en direct : {link}` |
| `local.delivered` | `Livré : {id} a été reçu par {masked} à {time}. Merci d'avoir choisi TanEx.` · e-mail (*ajouté avec G.8, à confirmer*) : Objet `Livré : {id}`, même texte + `Détails : {link}` |
| `local.failed` | `Nous n'avons pas pu livrer {id} : {reason}. Notre équipe vous contactera pour convenir d'un nouveau créneau.` |
| `auth.temp_password` | `Votre compte TanEx est prêt. Connectez-vous sur {url} avec {identifier} et ce mot de passe temporaire : {password}. Vous choisirez le vôtre à la connexion.` |
| `auth.reset` | Objet `Réinitialiser votre mot de passe TanEx` · `Une demande de réinitialisation a été faite pour votre compte TanEx. Utilisez ce lien dans les 30 minutes : {url}. Si ce n'était pas vous, ignorez cet e-mail.` |
| `quote.received` | Objet `Nous avons bien reçu votre demande de devis {ref}` · `Merci, {name}. Notre équipe étudie votre demande et vous enverra un prix. Consultez-la à tout moment : {url}` |
| `quote.ready` | Objet `Votre devis TanEx {ref} est prêt` · `Votre prix est prêt à être consulté et accepté : {url}` |
| `contact.received` | Objet `Nous avons bien reçu votre message ({ref})` · `Merci, {name}. Nous vous répondrons dès que possible.` |
| `payment.confirmed` | Objet `Paiement reçu pour {id}` · `Merci. Nous avons confirmé votre paiement pour {reason}.` |
| `contact.staff_alert` (ajouté après B.6, à confirmer) | Objet `Nouveau message de {name} ({ref})` · `{name} a envoyé un message depuis le site (sujet : {subject}). Lisez-le et répondez dans la console : {url}` |
| `payment.proof_received` (ajouté après B.6, à confirmer) | Objet `Preuve de paiement reçue pour {id}` · `Un client a envoyé une preuve de paiement pour {id}. Vérifiez-la dans la console, rubrique Paiements : {url}` |
| `mail.test` (ajouté avec B.6, à confirmer) | Objet `E-mail de test TanEx` · `Ceci est un e-mail de test envoyé depuis la console TanEx. Si vous pouvez le lire, l'envoi d'e-mails fonctionne.` |
| `local.booked` (e-mail, ajouté avec G.6, à confirmer) | Objet `Nous avons bien reçu votre réservation de livraison {id}` · `Merci, {name}. Votre numéro de suivi est {id}. Suivez votre livraison ici : {link}` |
| page de réservation après l'appui sur WhatsApp (*ajouté avec G.8, à confirmer*) | `Ouvert dans WhatsApp. Appuyez sur Envoyer pour le partager.` |
| application livreur (*ajouté avec G.8, à confirmer*) | `Écrire au client` · `Ouvre WhatsApp avec le message prêt. Vous appuyez encore sur Envoyer.` · `Dire au destinataire que vous êtes en route` · `Dire à l'expéditeur que c'est livré` · `Dire à l'expéditeur que la livraison n'a pas eu lieu` · `Ouvert dans WhatsApp` · `Pas de numéro de téléphone valide pour cette personne.` |
| `local.share_tracking` (WhatsApp, page de suivi, ajouté avec G.7, à confirmer) | `Suivez cette livraison TanEx en direct : {link}` |

## 15. Pages du blog (ajouté le 2026-11-12 avec F.2, **à confirmer, relecture native en attente**)
Traduction de CONTENT §15, dans `src/i18n/fr/blog.ts` (`index`, `article`).
- **Index :** sur-titre `Blog {{COMPANY}}` · H1 `Actualités, guides et conseils d'expédition` · sous-titre `Des conseils pratiques pour envoyer des colis au Cameroun et à l'étranger, et les actualités de l'équipe {{COMPANY}}.` · puce `Tous` · état vide `Nos premiers articles arrivent bientôt.` · `Lire la suite` · `{n} min de lecture` · pagination `Plus récents` · `Plus anciens`
- **Article :** `Par {author}` · `{date}` · `{n} min de lecture` · `Partager` (`WhatsApp` · `Facebook` · `LinkedIn` · `X` · `Copier le lien` → `Lien copié`) · `Articles similaires` · `Lire en anglais` (seulement si la traduction existe) · fin `Besoin d'envoyer quelque chose ?` `Demander un devis`
- **Ajouté avec F.3 (à confirmer) :** `Catégories` · `Dernier article` · `Pages du blog` · `Page {n} sur {total}` · `Nous n'avons pas pu charger les articles. Veuillez réessayer.` · `Réessayer` · `Flux RSS` · `Suivre un envoi` · catégorie `Tous les articles` · article : `Partager sur {network}` · `Retour au blog` · `Article précédent` · `Article suivant` · `Plus d'articles` · `Mots-clés` · `Article introuvable` / `Cet article n'existe pas ou n'est plus publié.` · `Nous n'avons pas pu charger cet article. Veuillez réessayer.` · accueil (§2.9) `{n} min de lecture`

## 16. Carrières et Politique RSE (pied de page ; ajouté le 2026-11-09, **approuvé par le propriétaire le 2026-11-10**)
Texte complet dans `src/i18n/fr/company.ts` (traduction de CONTENT §16). Pied de page *Entreprise* : `Carrières` · `Politique RSE`.
Chemins : `/fr/carrieres`, `/fr/politique-rse`. Titres : `Travaillez avec {{COMPANY}}` · `Notre responsabilité`.

## 17. Boutique (SHOP_SPEC ; ajouté le 2026-11-17 avec M.0, **à confirmer, relecture native en attente**)
Traduction de CONTENT §17. Les noms, descriptions et catégories des produits sont saisis par l'équipe dans la console.
Les prix s'affichent `15 000 FCFA`.

### 17.1 En-tête, pied de page, mentions légales
- Bouton d'en-tête `Boutique` (propriétaire, 2026-11-17) · bouton panier `Panier` avec le nombre, lecteurs d'écran `Panier, {n} articles`
- Pied de page *Mentions légales* : `Retours et remboursements` (Accessibilité passe à la ligne du bas, SHOP_SPEC §18)
- Onglet `Retours et remboursements` · titre `Retours et remboursements` (texte §13.2)

### 17.2 Page Boutique (`/fr/boutique`) et page catégorie
- Surtitre `Boutique {{COMPANY}}` · H1 `Achetez chez {{COMPANY}}` · sous-titre `Des produits vendus par {{COMPANY}}, livrés à votre porte par nos livreurs à {{LOCAL_CITIES}} et par camion dans les autres villes du Cameroun. Commandez en ligne, payez à la livraison ou par mobile money.`
- Puces `Tout` · recherche `Rechercher un produit` · tri `Trier par` : `En vedette` · `Nouveautés` · `Prix croissant` · `Prix décroissant` · `En stock uniquement` · `{n} produits` / `1 produit`
- Carte : `Ajouter au panier` → `Ajouté` · `Promo` · `Plus que {n}` · `Épuisé` · lecteurs d'écran `Avant {old}, maintenant {new}`
- Boutique vide : **La boutique ouvre bientôt.** `Nos produits apparaîtront ici très prochainement.`
- Aucun résultat : **Aucun produit ne correspond à votre recherche.** `Essayez d'autres mots ou effacez les filtres.` → `Effacer les filtres`
- Pagination `Pages de la boutique` · `Page {n} sur {total}` · `Précédent` · `Suivant`
- Page catégorie : surtitre identique, H1 = nom de la catégorie, sous-titre = description de la catégorie.
- *Ajouté avec M.4 (à confirmer) :* `Catégories` · bouton `Rechercher` · `Nous n'avons pas pu charger les produits. Veuillez réessayer.` → `Réessayer`
- *Méta (M.4, à confirmer) :* titre `Boutique | {{COMPANY}}` · description `Des produits vendus par {{COMPANY}}, livrés à votre porte à {{LOCAL_CITIES}} et par camion dans les autres villes du Cameroun. Payez à la livraison ou par mobile money.` · panier (M.5) `Votre panier | {{COMPANY}}` · `Vérifiez votre panier et passez commande chez {{COMPANY}}. Nous vous appelons pour la confirmer avant la livraison.`

### 17.3 Fiche produit
- Fil d'Ariane `Boutique` › {catégorie} › {produit} · `Référence produit : {code}`
- Stock : `En stock` · `Plus que {n}` · `Épuisé`
- `Quantité` · `Diminuer la quantité` · `Augmenter la quantité` · `Vous pouvez commander jusqu'à {n} exemplaires de ce produit.`
- `Ajouter au panier` · message `Ajouté à votre panier.` → `Voir le panier`
- `Poser une question sur WhatsApp` · message `Bonjour {{COMPANY}}, j'ai une question sur {product} ({code}).`
- Livraison : `Livraison par un livreur {{COMPANY}} à {{LOCAL_CITIES}}, par camion dans les autres villes du Cameroun, ou retrait dans notre agence de Buea ou de Douala.`
- Paiement : `Payez à la livraison, par MTN MoMo ou Orange Money, ou dans notre agence. Aucune carte nécessaire.`
- Liens `Retours et remboursements` · `Conditions d'expédition` · `Description` · `Produits similaires`
- Galerie : `Photo {n} sur {total}` · `Afficher en plein écran` · `Fermer` · `Photo précédente` · `Photo suivante`
- *Ajouté avec M.4 (à confirmer) :* `Fil d'Ariane` · `Dans votre panier : {n}` · `Nous n'avons pas pu charger ce produit. Veuillez réessayer.` · `Photos du produit` · `Agrandir` / `Réduire`

### 17.4 Panier (`/fr/panier`)
- H1 `Votre panier` · `Retirer` · `Sous-total` · `Continuer vos achats` · `Continuer vers vos coordonnées`
- Vide : **Votre panier est vide.** → `Découvrir la boutique`
- Changements : `Le prix de {product} est maintenant de {price}.` · `Il ne reste que {n} {product} : nous avons modifié la quantité.` · `{product} n'est plus disponible et a été retiré de votre panier.`

### 17.5 Commande : vos coordonnées
- H2 `Vos coordonnées` · `Nom complet` · `Numéro de téléphone` (aide `Un numéro camerounais, par exemple 6XX XX XX XX`) · `Numéro WhatsApp` · ☑ `Identique à mon numéro de téléphone` · `E-mail (facultatif)` (aide `Pour la confirmation de votre commande.`)
- `Comment souhaitez-vous recevoir votre commande ?` · `Livraison à mon adresse` · `Retrait dans une agence {{COMPANY}}`
- Agences : `Siège de Buea : {{HQ_ADDRESS}}` · `Douala : {{DOUALA_OFFICE}}` · `Le retrait à Douala peut prendre un peu plus de temps. Nous vous appellerons dès que votre commande sera prête.`
- Livraison : `Ville` · `Quartier` · `Mon quartier n'est pas dans la liste` · `Adresse ou point de repère` (aide `Par exemple : « En face de la station Total, portail bleu »`) · `Note pour notre équipe (facultatif)`
- `Comment allez-vous payer ?`
  - `Paiement à la livraison` : `Payez le livreur à l'arrivée de votre commande.`
  - `MTN MoMo` : `Payez après notre appel de confirmation. Indiquez votre numéro de commande comme référence de paiement.`
  - `Orange Money` : même texte que MTN MoMo.
  - `Paiement en agence` : `Payez au retrait de votre commande.`
- `Récapitulatif` · `Sous-total` · `Livraison` · `Gratuite (retrait)` · `Nous vous confirmerons les frais de livraison` · `Total` · `Total (frais de livraison à confirmer)`
- ☐ `J'accepte les Conditions d'utilisation et la politique de Retours et remboursements.`
- Bouton `Passer la commande` · `Envoi de votre commande…`
- Erreurs : `Veuillez indiquer votre nom.` · `Indiquez un numéro de téléphone camerounais valide.` · `Indiquez une adresse e-mail valide, ou laissez le champ vide.` · `Choisissez votre ville et votre quartier.` · `Indiquez votre adresse ou un point de repère.` · `Choisissez une agence de retrait.` · `Choisissez votre mode de paiement.` · `Veuillez accepter les conditions pour passer votre commande.` · `Il ne reste que {n} {product}. Mettez votre panier à jour et réessayez.` · `Trop de commandes depuis cette connexion. Patientez quelques minutes et réessayez.` · `Un problème est survenu et votre commande n'a pas été enregistrée. Réessayez, ou commandez sur WhatsApp.`

### 17.6 Commande enregistrée
- H1 `Merci, {firstName}. Votre commande est enregistrée.` · `Numéro de commande : {order}` · `Une confirmation a été envoyée à {email}.`
- `La suite` : 1. `Nous vous appelons pour confirmer votre commande et les frais de livraison.` 2. `Nous préparons votre commande.` 3. Livraison : `Un livreur {{COMPANY}} vous l'apporte, et vous recevez un numéro de suivi.` · Retrait : `Nous vous appelons quand elle est prête en agence.`
- Mobile money : `Payez par {method} au {number} ({accountName}) après notre confirmation, avec {order} comme référence. Nous ne vous demanderons jamais votre code PIN.`
- Boutons `Nous écrire sur WhatsApp` · `Continuer vos achats`

- *Ajouté avec M.5 (à confirmer) :* panier `Retirer {product}` · `Un produit n'est plus disponible et a été retiré de votre panier.` · `Vous pouvez commander jusqu’à {n} {product} : nous avons modifié la quantité.` · `Quantité de {product}` · `Nous n'avons pas pu vérifier votre panier. Veuillez réessayer.` · étapes `Étapes de la commande`, `Panier`, `Vos coordonnées` · `Choisissez votre ville` · `Choisissez votre quartier` · `Choisissez la livraison ou le retrait.` · `Choisissez votre ville pour voir les frais de livraison.` · `Calcul des frais de livraison…` · `Retour au panier` · `{n} articles` / `1 article` · `Veuillez vérifier les champs signalés en rouge.` · `Votre panier a changé. Vérifiez-le avant de passer votre commande.` · `Votre commande` · `Bonjour {{COMPANY}}, j’ai une question sur ma commande {order}.` · ligne mobile money sans `({accountName})` (#189).

### 17.7 E-mails client (l'alerte interne est en anglais, CONTENT §17.7)
- `shop.order_received` : objet `Nous avons bien reçu votre commande {order}` · `Merci, {name}. Nous avons bien reçu votre commande et vous appellerons au {phone} pour la confirmer.` · articles avec références · totaux · paiement comme §17.6 · `Retours et remboursements : {link}` · `L'équipe {{COMPANY}}`
- `shop.order_dispatched` : objet `Votre commande {order} est en route` · `Bonne nouvelle, {name} : votre commande est en route. Numéro de suivi : {id}. Suivez-la ici : {link}`
- `shop.order_cancelled` : objet `Votre commande {order} a été annulée` · `Votre commande {order} a été annulée. Motif : {reason}. Si vous avez déjà payé, nous vous rembourserons comme le prévoit notre politique de Retours et remboursements. Des questions ? {{EMAIL}} · {{PHONE}}`

- *Ajouté avec M.6 (à confirmer, #187) :* `Numéro de commande : {order}` · titre `Votre commande` · lignes `Sous-total` / `Livraison` / `Total` et mots des frais comme au panier · titre `Comment allez-vous payer ?` avec la phrase mobile money du §17.6 (sans nom de compte, #189) ou, pour le paiement à la livraison et en agence, `{méthode} : {aide}` du formulaire de commande · signature standard `— {{COMPANY}}` au lieu de `L'équipe {{COMPANY}}` · `Des questions ?` suivi de l'e-mail et du premier numéro.

### 17.8 Console
La console reste en anglais jusqu'à la tâche I.2 ; la traduction de CONTENT §17.8 sera faite avec I.2.
- *Ajouté avec M.7 (à confirmer, #187) :* menu, cloche et tuiles du tableau de bord en français : `{n} nouvelles` · `{n} nouvelles commandes boutique` · `Appelez le client pour confirmer la commande et les frais de livraison.` · `Commandes boutique` · `Nouvelles commandes` · `{n} avec des frais à confirmer` · `Tous les frais de livraison sont fixés` · `Prêtes à envoyer` · `Emballées, en attente de livraison ou de retrait` · `En cours de livraison` · `{n} avec un problème de livraison` · `Aucun problème de livraison` · `Terminées, non payées` · `Livrées ou retirées, paiement non enregistré` · `Stock bas` · `Produits publiés au niveau de stock bas ou en dessous`. Les écrans Boutique eux-mêmes restent en anglais (SHOP_TEXT), comme pour M.3.

### 17.9 Ajouts aux politiques de confidentialité et de cookies (avec M.8 ; **relecture d'un juriste, #11**)
- Confidentialité, *Commandes en boutique.* `Lorsque vous commandez dans notre boutique, nous collectons votre nom, vos numéros de téléphone et WhatsApp, votre e-mail si vous le donnez, votre adresse de livraison ou l'agence choisie, et le contenu de votre commande. Nous les utilisons pour confirmer, préparer et livrer votre commande, traiter les retours et tenir notre comptabilité. Nous conservons les commandes et paiements pendant 10 ans, comme l'exigent les règles comptables ; vos numéros de téléphone, votre e-mail et votre adresse sont supprimés de la commande 2 ans après sa clôture.`
- Cookies, liste du stockage du navigateur : `tx_cart : les produits et quantités de votre panier. Aucune donnée personnelle.`
