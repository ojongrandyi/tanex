// Français, zone « company » : pages Carrières et Politique RSE (CONTENT_FR §16, à confirmer).
import type { CompanyMessages } from '../en/company';
import type { Translation } from '../types';

const company = {
  careers: {
    hero: {
      eyebrow: 'Carrières',
      title: 'Travaillez avec {company}',
      sub: "Nous transportons des colis depuis les portes de Buea, Limbe et Douala jusqu'au reste du monde. Si vous êtes fiable, soigneux et à l'aise avec les gens, nous aimerions avoir de vos nouvelles.",
    },
    teams: {
      eyebrow: 'Où vous pourriez nous rejoindre',
      title: 'Les équipes {company}',
      riders: { title: 'Livreurs à moto', body: 'Récupérer et livrer des colis en ville à moto.' },
      drivers: { title: 'Chauffeurs', body: 'Transporter des charges plus importantes entre les villes, en camion et en fourgonnette.' },
      operations: { title: 'Opérations et bureau', body: 'Enregistrer les envois, préparer les documents, aider les clients et faire avancer chaque colis.' },
    },
    values: {
      eyebrow: 'Ce qui compte pour nous',
      title: 'Notre façon de travailler',
      reliable: { title: 'Fiabilité', body: "Être à l'heure et faire ce que nous avons promis." },
      care: { title: 'Soin', body: "Traiter chaque colis comme s'il était le nôtre." },
      service: { title: 'Service', body: 'Une aide aimable et claire pour chaque client, en anglais ou en français.' },
    },
    apply: {
      title: 'Comment postuler',
      body: "Aucun poste ouvert n'est publié ici pour le moment. Envoyez votre CV et un court message à {email}, en précisant l'équipe et la ville (Buea, Limbe ou Douala) qui vous intéressent. Nous vous contacterons si votre profil correspond.",
      button: 'Envoyer votre CV',
      subject: 'Candidature',
    },
  },
  csr: {
    hero: {
      eyebrow: 'Politique RSE',
      title: 'Notre responsabilité',
      sub: "Comment {company} s'engage à être une entreprise sûre, juste et responsable dans les communautés que nous servons.",
    },
    sectionsLabel: 'Nos engagements',
    safety: { title: 'Sécurité routière', body: "Nos livreurs et chauffeurs respectent le code de la route et portent l'équipement de sécurité adapté. Nous organisons les chargements et les trajets pour qu'aucune livraison ne justifie de prendre un risque." },
    people: { title: 'Travail équitable', body: "Nous traitons notre personnel et nos livreurs avec respect, les payons à temps et leur donnons la formation et l'équipement nécessaires." },
    customers: { title: 'Service honnête', body: "Un prix clair avant l'envoi, un suivi que vous consultez vous-même et une preuve de chaque livraison. Nous protégeons vos données personnelles comme l'explique notre politique de confidentialité.", link: 'Lire notre politique de confidentialité' },
    environment: { title: 'Environnement', body: "La moto pour les courts trajets en ville, des chargements groupés entre les villes et moins de trajets à vide. Quand c'est possible, nous réutilisons les emballages et réduisons les déchets." },
    community: { title: 'Communauté locale', body: "Basés à Buea, nous travaillons avec des entreprises de Buea, Limbe et Douala et les aidons à atteindre leurs clients au Cameroun et à l'étranger." },
    contact: 'Des questions ou des suggestions sur notre façon de travailler ? Écrivez-nous à {email}.',
  },
} satisfies Translation<CompanyMessages>;

export default company;
