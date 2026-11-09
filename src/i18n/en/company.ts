// English master, area "company": the Careers and CSR Policy pages (footer only, owner's note
// 2026-11-09). CONTENT §16, a draft for the owner to approve: commitments only, no figures,
// open positions or claims. Email comes from brand.ts as {email}.
const company = {
  careers: {
    hero: {
      eyebrow: 'Careers',
      title: 'Work with {company}',
      sub: "We move parcels from doors in Buea, Limbe and Douala to the rest of the world. If you are reliable, careful and good with people, we'd like to hear from you.",
    },
    teams: {
      eyebrow: 'Where you could fit',
      title: 'Teams at {company}',
      riders: { title: 'Riders', body: 'Collect and deliver parcels across town by bike.' },
      drivers: { title: 'Drivers', body: 'Carry larger loads between cities by truck and van.' },
      operations: { title: 'Operations and office', body: 'Book shipments, prepare documents, help customers and keep every parcel moving.' },
    },
    values: {
      eyebrow: 'What matters to us',
      title: 'How we work',
      reliable: { title: 'Reliability', body: 'Being on time and doing what we promised.' },
      care: { title: 'Care', body: 'Handling every parcel as if it were our own.' },
      service: { title: 'Service', body: 'Friendly, clear help for every customer, in English or French.' },
    },
    apply: {
      title: 'How to apply',
      body: "No open positions are listed here at the moment. Send your CV and a short message to {email}, saying which team and which city (Buea, Limbe or Douala) interest you. We'll contact you if there's a match.",
      button: 'Email your CV',
      subject: 'Job application',
    },
  },
  csr: {
    hero: {
      eyebrow: 'CSR Policy',
      title: 'Our responsibility',
      sub: 'How {company} works to be a safe, fair and responsible company in the communities we serve.',
    },
    sectionsLabel: 'Our commitments',
    safety: { title: 'Safety on the road', body: 'Our riders and drivers follow the traffic rules and wear the right safety equipment. We plan loads and routes so that no delivery is worth taking a risk for.' },
    people: { title: 'Fair work', body: 'We treat our staff and couriers with respect, pay them on time, and give them the training and equipment the job needs.' },
    customers: { title: 'Honest service', body: 'A clear price before you ship, tracking you can check yourself, and proof of every delivery. We protect your personal data as our Privacy Policy explains.', link: 'Read our Privacy Policy' },
    environment: { title: 'Environment', body: 'Bikes for short trips in town, combined loads between cities and fewer empty journeys. Where we can, we reuse packaging and reduce waste.' },
    community: { title: 'Local community', body: 'We are based in Buea and work with businesses across Buea, Limbe and Douala, helping them reach customers at home and abroad.' },
    contact: 'Questions or suggestions about how we work? Write to us at {email}.',
  },
};

export default company;
export type CompanyMessages = typeof company;
