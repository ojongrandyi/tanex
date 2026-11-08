// Français, zone « network » : la page Réseau (CONTENT_FR §5, §9, §5.1). Relecture native #108.
import type { NetworkMessages } from '../en/network';
import type { Translation } from '../types';

const network = {
  hero: {
    eyebrow: 'Notre réseau',
    title: 'Des racines locales. Une portée mondiale.',
    sub: 'Nous livrons chaque jour à Buea, Limbe et Douala, et nous rejoignons par Douala les grands carrefours du commerce mondial.',
  },
  riders: {
    title: 'Où livrent nos livreurs',
    intro: 'Livraison à moto dans chaque ville, et camions entre elles.',
    roles: { 'head-office': 'Siège', office: 'Bureau', bike: 'Livraison à moto', gateway: "Porte d'entrée aéroport et port" },
  },
  gateways: {
    title: "Nos portes d'entrée et routes commerciales",
    intro: "Les carrefours commerciaux que nous desservons depuis Douala. Ce sont des portes d'entrée que nous desservons, pas des bureaux TanEx.",
    mapLabel: 'Carte du réseau TanEx : Buea, Douala et les carrefours commerciaux que nous desservons',
    regions: { Africa: 'Afrique', Europe: 'Europe', 'Middle East': 'Moyen-Orient', Asia: 'Asie', Americas: 'Amériques' },
    modesLabel: 'Modes',
    modes: { air: 'Aérien', ocean: 'Maritime', road: 'Routier' },
    localTime: 'Heure locale',
    contact: 'Nous contacter pour cette route',
    choose: 'Choisir un lieu',
    showOnMap: 'Voir sur la carte',
    showOnMapFor: 'Voir sur la carte : {name}',
  },
  legend: { base: 'Base TanEx', gateway: "Porte d'entrée", lane: 'Route commerciale' },
  note: "Votre destination n'apparaît pas ? Nous expédions bien au-delà de ces carrefours. Parlez-nous de votre itinéraire.",
  noteCta: 'Parlez-nous de votre itinéraire',
} satisfies Translation<NetworkMessages>;

export default network;
