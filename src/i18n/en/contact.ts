// English master, area "contact": the Contact page (CONTENT §8.3, §8.4, §8.6). Quick answers come
// from the "help" area.
const contact = {
  hero: {
    title: 'Talk to TanEx',
    sub: 'Questions, quotes or a shipment that needs attention: a real coordinator will get back to you.',
  },
  channels: {
    label: 'Ways to reach us',
    phone: 'Phone',
    whatsapp: 'WhatsApp',
    email: 'Email',
  },
  offices: {
    title: 'Our offices',
    buea: 'Buea, head office',
    douala: 'Douala',
    hoursTitle: 'Opening hours',
    directions: 'Get directions',
    directionsFor: 'Get directions: {office} (opens Google Maps)',
  },
  form: {
    title: 'Send us a message',
    name: 'Name',
    email: 'Email',
    phone: 'Phone',
    optional: '(optional)',
    topic: 'Topic',
    topicPlaceholder: 'Choose a topic',
    topics: { quote: 'Quote', shipment: 'Active shipment', billing: 'Billing', partnership: 'Partnership', other: 'Other' },
    tracking: 'Tracking ID',
    trackingHint: 'For example {example}',
    gateway: 'Gateway',
    gatewayNone: 'No gateway',
    message: 'Message',
    submit: 'Send message',
    sending: 'Sending…',
    errorRequired: 'Please fill in your name, email, topic and message.',
    errorEmail: 'Please enter a valid email address.',
    errorSend: "We couldn't send your message. Please try again, or email us at {email}.",
  },
  success: {
    title: 'Message received.',
    body: "Your reference is {ref}. We'll reply to {email} as soon as possible.",
    again: 'Send another message',
    track: 'Track a Shipment',
  },
  desk: {
    title: 'TanEx Operations Desk.',
    body: 'For active shipments, include your tracking ID for the fastest help.',
  },
  faq: { title: 'Quick answers', more: 'More answers in the Help Centre' },
};

export default contact;
export type ContactMessages = typeof contact;
