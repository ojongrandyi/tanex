// English master, area "about": the About page (CONTENT §4, §3.6, §4.1, alt text §12).
// The founding story and the wall-sign line are not written for the owner: those blocks stay
// hidden until supplied (#102). Names of the leadership team come from brand.ts (#103).
const about = {
  hero: {
    eyebrow: 'About TanEx',
    title: 'From our door in Buea to yours, wherever it is.',
    sub: 'TanEx is a delivery and logistics company based in Buea, with an office in Douala. We move parcels across town by bike, between cities by truck, and from Cameroon to the world by air, sea, rail and road.',
    slogan: '{slogan}.',
  },
  approach: {
    eyebrow: 'Our approach',
    title: 'How we work',
    id: { title: 'One tracking ID.', body: 'From the first door to the last.' },
    couriers: { title: 'Named couriers.', body: 'Every delivery has a TanEx rider or driver accountable for it.' },
    proof: { title: 'Proof, not promises.', body: 'Photo and name at every delivery.' },
    languages: { title: 'Two languages.', body: 'We serve you in English and French.' },
  },
  leadership: {
    eyebrow: 'Leadership',
    role: 'Managing Director',
    alt: 'The Managing Director of TanEx at the TanEx office in Buea',
    altNamed: '{name}, Managing Director of TanEx, at the TanEx office in Buea',
    headOfOperations: 'Head of Operations',
    regionalManager: 'Regional Manager',
  },
  team: {
    eyebrow: 'Our team',
    body: "The TanEx team wears the brown and orange you'll see at your door.",
  },
  offices: {
    eyebrow: 'Where to find us',
    buea: 'Buea, head office',
    douala: 'Douala',
    hours: 'Open {hours}',
    contact: 'Contact us',
  },
  cta: {
    title: 'Ready to send something?',
    body: 'Get a clear price, or book a bike delivery in a few minutes.',
    quote: 'Get a Quote',
    bike: 'Book a bike delivery',
  },
};

export default about;
export type AboutMessages = typeof about;
