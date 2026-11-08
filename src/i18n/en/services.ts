// English master, area "services": the Services page (CONTENT §3, §3.6). All service details are
// [confirm] drafts pending the owner (tracker #104); no numbers or claims beyond CONTENT.
const services = {
  hero: {
    eyebrow: 'Our services',
    titleStart: 'Every way to move it, under',
    titleEm: 'one roof.',
    sub: 'Choose the mode that fits your cargo and your timeline. We take care of the route, the paperwork and every hand-off.',
    quote: 'Get a Quote',
    track: 'Track a Shipment',
  },
  eyebrows: { services: 'Services', compare: 'Compare', how: 'How it works', addons: 'Add-ons' },
  // Headings for the sections whose CONTENT only gives an eyebrow (CONTENT §3.7, owner to confirm).
  headings: {
    services: 'Six ways to move it',
    compare: 'Which service fits?',
    how: 'From booking to the door',
    addons: 'Extras when you need them',
    nav: 'Services on this page',
  },
  labels: { highlights: 'Highlights', goodFor: 'Good for', quote: 'Get a Quote', track: 'Track a Shipment', bike: 'Book a bike delivery' },
  items: {
    air: {
      name: 'Air freight',
      summary: 'International air shipping for documents, parcels and time-sensitive cargo.',
      h1: 'Collection from your door',
      h2: 'Export documents prepared with you',
      h3: 'Customs clearance support',
      h4: 'Tracked from pickup to delivery',
      goodFor: 'documents, samples, spare parts, e-commerce orders, personal parcels abroad',
    },
    maritime: {
      name: 'Maritime freight',
      summary: 'Ocean shipping in full containers (FCL) or shared containers (LCL) for larger and heavier loads.',
      h1: 'FCL and LCL',
      h2: 'Port handling and documentation',
      h3: 'Import and export',
      h4: 'Delivery to the door after clearance',
      goodFor: 'business stock, machinery, vehicles, household moves',
    },
    rail: {
      name: 'Rail freight',
      summary: 'Inland transport for heavy and bulk cargo on routes served by rail, combined with road delivery at each end.',
      h1: 'Cost-effective for heavy loads',
      h2: 'Booked and tracked by our team',
      h3: 'Road collection and delivery to complete the trip',
      h4: '',
      goodFor: 'bulk goods, construction materials, agricultural produce',
    },
    road: {
      name: 'Road freight',
      summary: 'Truck and van transport between cities in Cameroon and to neighbouring countries.',
      h1: 'Full and part loads',
      h2: 'Door-to-door collection and delivery',
      h3: 'Tracked city to city',
      h4: '',
      goodFor: 'furniture, retail stock, pallets, deliveries between Limbe, Buea, Douala and beyond',
    },
    warehousing: {
      name: 'Warehousing',
      summary: 'Secure storage for your goods, with receiving, stock checks, packing and dispatch.',
      h1: 'Short- and long-term storage',
      h2: 'Goods checked in and recorded',
      h3: 'Pick, pack and dispatch on request',
      h4: 'Combined with any of our transport services',
      goodFor: 'traders, online sellers, importers waiting for onward delivery',
    },
    local: {
      name: 'Local delivery (bike)',
      summary: 'Same-city delivery by TanEx riders in Buea, Limbe and Douala, with live tracking.',
      h1: 'Collected from your door',
      h2: 'Live rider location',
      h3: 'Photo proof of delivery',
      h4: 'Cash or Mobile Money',
      goodFor: 'documents, food orders, phones and small parcels, online shop deliveries',
    },
  },
  compare: {
    caption: 'Our services compared',
    service: 'Service',
    bestFor: 'Best for',
    speed: 'Speed',
    tracking: 'Tracking',
    rows: {
      local: { name: 'Local delivery', bestFor: 'Small items within one city', speed: 'Fastest, same city', tracking: 'Live rider location' },
      road: { name: 'Road freight', bestFor: 'Bigger loads between cities', speed: 'Scheduled trips', tracking: 'City-to-city updates' },
      air: { name: 'Air freight', bestFor: 'Urgent international shipments', speed: 'Fastest international', tracking: 'Every milestone' },
      maritime: { name: 'Maritime freight', bestFor: 'Large or heavy international loads', speed: 'Scheduled sailings', tracking: 'Every milestone' },
      rail: { name: 'Rail freight', bestFor: 'Heavy and bulk cargo inland', speed: 'Scheduled departures', tracking: 'Every milestone' },
      warehousing: { name: 'Warehousing', bestFor: 'Storing goods before delivery', speed: 'n/a', tracking: 'Stock records' },
    },
  },
  how: {
    book: { title: 'Book.', body: 'Book online, on WhatsApp or at our office. You get your 8-character tracking ID straight away.' },
    collect: { title: 'Collect.', body: 'We collect from your door, check and label every piece.' },
    move: { title: 'Move.', body: 'By bike, truck, air, sea or rail. Every hand-off is recorded.' },
    deliver: { title: 'Deliver.', body: "Delivered to the door, with a photo and the recipient's name as proof." },
  },
  addons: {
    express: { title: 'Express (in town).', body: 'Priority pickup for urgent same-city deliveries.' },
    cod: { title: 'Cash on delivery.', body: 'The rider collects payment for your goods from the recipient and we pay it to you.' },
    code: { title: 'Delivery code.', body: 'The recipient gives a 4-digit code to the rider before handover.' },
    packing: { title: 'Packing.', body: 'We pack and protect your items before shipping.' },
  },
  cta: {
    title: 'Ready to send something?',
    body: 'Get a clear price, or book a bike delivery in a few minutes.',
    quote: 'Get a Quote',
    bike: 'Book a bike delivery',
  },
};

export default services;
export type ServicesMessages = typeof services;
