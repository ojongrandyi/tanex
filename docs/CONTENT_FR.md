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
- Navigation : **Suivi** · **Services** (Aérien · Maritime · Ferroviaire · Routier · Entreposage · Livraison locale) · **Expédier** (Réserver un envoi · Réserver une livraison à moto) · **Réseau** · **À propos** · **Blog** · **Contact**
- Bouton principal : **Demander un devis** · Langue : `EN | FR`
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

**Colonnes :** *Services* Fret aérien · Fret maritime · Fret ferroviaire · Fret routier · Entreposage · Livraison locale — *Entreprise* À propos de TanEx · Notre réseau · Blog · Contact — *Assistance* Suivre un envoi · Réserver une livraison à moto · Centre d'aide · Demander un devis — *Mentions légales* Politique de confidentialité · Conditions d'utilisation · Conditions d'expédition · Politique de cookies · Accessibilité

**Bureaux :** `Buea (siège)` : `{{HQ_ADDRESS}}` · `Douala` : `{{DOUALA_OFFICE}}` · `Appelez le {{PHONE}} · {{PHONE_2}}` · `Ouvert de {{HOURS}}`

**Ligne du bas :** `© {année} Tanex SARL. Tous droits réservés.`

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

## 6.9 Suivi : livraisons locales et entre villes
- **Étapes :** `Demandée` · `Livreur assigné` · `Récupéré` · `En route` · `Livré` · échec : `Tentative de livraison infructueuse`
- **Livreur :** `Votre livreur` / `Votre chauffeur` · `Moto` / `Fourgonnette` / `Camion`
- **Carte :** `Position en direct` · `Mise à jour il y a {n} secondes` · `En attente de la prochaine position du livreur`
- **Arrivée :** `Arrivée dans environ {n} min` · `Estimation basée sur la position actuelle du livreur`
- **Livré :** `Livré à {heure}, reçu par {nom masqué}.` · `Preuve photo enregistrée` · **Partager :** `Partager le suivi sur WhatsApp`

## 7.5 Réserver une livraison à moto
- **H1 :** `Réserver une livraison à moto` · **Texte :** `Dans Buea, Limbe ou Douala. Un livreur TanEx récupère le colis à la porte et le remet au destinataire, et vous suivez la course en direct.`
- **Étapes :** `1. Ville` · `2. Enlèvement` · `3. Livraison` · `4. Colis` · `5. Paiement` · `Récapitulatif`
- **Champs :** `Ville` · `Quartier` · `Point de repère ou indications` (ex. `« En face de la station Total, portail bleu »`) · `Nom du contact` · `Téléphone du contact` · `Position sur la carte (facultatif)` · `Nom du destinataire` · `Téléphone du destinataire` · `Taille du colis` (`Petit : tient dans un sac à dos` · `Moyen : tient dans le coffre du livreur` · `Grand : nécessite une fourgonnette`) · `De quoi s'agit-il ?` · `Enlèvement express` · `Qui paie ?` (`Moi` / `Le destinataire`) · `Encaisser le prix de ma marchandise (paiement à la livraison)` + `Montant` · `Heure d'enlèvement souhaitée` · `Votre e-mail (facultatif, pour le reçu)`
- **Prix :** `Prix de la livraison : {montant}` · sans tarif : `Nous vous confirmerons le prix par téléphone ou WhatsApp avant l'enlèvement.`
- **Bouton :** `Réserver la livraison` · `Réservation…`
- **Succès :** **Livraison réservée.** `Votre numéro de suivi est {ID}.` · `Suivre cette livraison` · `Envoyer le suivi au destinataire sur WhatsApp` · `Réserver une autre livraison`

## 10.3 Application livreur
- `Courses du jour` · `En service` / `Hors service` · `Aucune course pour l'instant. Les nouvelles courses s'affichent ici.` · `Nouvelle course assignée`
- `Enlèvement` · `Livraison` · `Appeler` · `WhatsApp` · `Ouvrir dans Maps` · `Montant à encaisser : {montant}` · `Express`
- `Accepter la course` · `Refuser` · `Récupéré` · `Je suis en route` · `Livré` · `Livraison impossible`
- `Nom du destinataire` · `Prendre une photo` · `Reprendre` · `Signature (facultatif)` · `Code de livraison` · `Montant encaissé` · `Moyen` (`Espèces` / `MTN MoMo` / `Orange Money`) · `ID de transaction` · `Confirmer la livraison`
- Motifs : `Destinataire injoignable` · `Destinataire absent` · `Mauvaise adresse` · `Refusé` · `Livraison dangereuse` · `Problème de véhicule` · `Autre`
- `Enregistré sur le téléphone, sera synchronisé` · `Synchronisé` · `Hors ligne` · `Gardez l'application ouverte pendant la livraison pour que le client puisse vous suivre.` · `La localisation est désactivée. Activez-la pour partager votre position pendant les livraisons.`
- `Ma caisse` · `Solde` · `Déclarer un versement` · `En attente de confirmation` · `Confirmé`

## 14. Modèles de notifications

| Clé | Français |
|---|---|
| `booking.confirmed` | `Bonjour {name}, votre réservation TanEx est confirmée. Numéro de suivi : {id}. Suivez-la ici : {link}` |
| `local.share_recipient` | `Bonjour {name}, {sender} vous envoie un colis avec TanEx. Suivez la livraison en direct : {link}` |
| `local.assigned` | `Votre livreur TanEx {rider} prend en charge {id}. Suivi : {link}` |
| `local.on_the_way` | `Votre colis {id} est en route avec {rider}. Suivez en direct : {link}` |
| `local.delivered` | `Livré : {id} a été reçu par {masked} à {time}. Merci d'avoir choisi TanEx.` |
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
