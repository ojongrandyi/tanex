// English master, area "network": the Network page (CONTENT §5, §9, §5.1). The list itself is
// src/data/gateways.ts (owner to confirm, #105).
const network = {
  hero: {
    eyebrow: 'Our network',
    title: 'Local roots. Global reach.',
    sub: 'We deliver every day in Buea, Limbe and Douala, and connect through Douala to the world\'s main trade hubs.',
  },
  riders: {
    title: 'Where our riders deliver',
    intro: 'Bike delivery inside each city, and trucks between them.',
    roles: { 'head-office': 'Head office', office: 'Office', bike: 'Bike delivery', gateway: 'Airport and port gateway' },
  },
  gateways: {
    title: 'Our gateways and trade lanes',
    intro: 'Trade hubs we ship to from Douala. They are gateways we serve, not TanEx offices.',
    mapLabel: 'Map of the TanEx network: Buea, Douala and the trade hubs we connect to',
    regions: { Africa: 'Africa', Europe: 'Europe', 'Middle East': 'Middle East', Asia: 'Asia', Americas: 'Americas' },
    modesLabel: 'Modes',
    modes: { air: 'Air', ocean: 'Sea', road: 'Road' },
    localTime: 'Local time',
    contact: 'Contact us about this lane',
    choose: 'Choose a place',
    showOnMap: 'Show on the map',
    showOnMapFor: 'Show on the map: {name}',
  },
  legend: { base: 'TanEx base', gateway: 'Gateway', lane: 'Trade lane' },
  note: "Don't see your destination? We ship well beyond these hubs. Ask us about your route.",
  noteCta: 'Ask about your route',
};

export default network;
export type NetworkMessages = typeof network;
