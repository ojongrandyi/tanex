// English master, area "help": the Help Centre (CONTENT §8.1, §8.2, §8.4, §8.5) and the Contact
// page's quick answers. Answers marked [confirm] in CONTENT are shown as written (#104).
const help = {
  hero: {
    title: 'How can we help?',
    searchLabel: 'Search the help centre',
    searchPlaceholder: 'Search for answers, e.g. customs, delivery time, documents',
  },
  quick: {
    label: 'Quick links',
    track: 'Track a Shipment',
    collect: 'Book a Collection',
    quote: 'Request a Quote',
    desk: 'TanEx Operations Desk',
  },
  kb: {
    title: 'Answers to common questions',
    filterLabel: 'Topics',
    all: 'All topics ({n})',
    results: '{n} answers',
    emptyTitle: 'No matching answers.',
    emptyBody: "Try different words, or contact us and we'll answer directly.",
    clear: 'Clear search',
  },
  categories: {
    tracking: 'Tracking',
    booking: 'Booking & collection',
    customs: 'Customs & international',
    documents: 'Documents & delivery',
    local: 'Local delivery',
    payments: 'Payments',
  },
  articles: {
    findId: { q: 'Where do I find my tracking ID?', a: "On your booking confirmation, at the top of your waybill and on every piece label. It's 8 characters and starts with TX (e.g. TX7K2M9P)." },
    notUpdated: { q: "Why hasn't my tracking updated?", a: 'Updates appear at each scan. On long air or ocean legs there can be several hours between scans. The estimated position keeps moving in the meantime.' },
    multiPiece: { q: 'How do multi-piece shipments work?', a: 'All pieces share one tracking ID. Each piece has its own label ending in -01, -02 and so on.' },
    cutOff: { q: "What's the cut-off for same-day collection?", a: 'It depends on your city and service. Your coordinator confirms it at booking.' },
    packing: { q: 'How should I pack my shipment?', a: 'Use a strong outer box, cushion every item and seal all seams. For high-value items, ask for our Secure Vault packaging.' },
    changeAddress: { q: 'Can I change the delivery address?', a: 'Yes, before the shipment reaches the destination gateway. Contact us with your tracking ID.' },
    duties: { q: 'Who pays duties and taxes?', a: "That's agreed at booking: either the sender (duties paid) or the recipient (duties unpaid)." },
    customsDocuments: { q: 'What documents do I need?', a: "Usually a commercial invoice and, for some goods, permits or certificates. We'll tell you exactly what your lane needs." },
    prohibited: { q: "What can't I ship?", a: 'Prohibited and restricted items vary by country. See our Shipping Terms, or ask us before you book.' },
    pod: { q: "Where's my proof of delivery?", a: 'On your tracking page as soon as the shipment is delivered, available to download as a PDF.' },
    damaged: { q: 'What if my shipment is damaged?', a: "Tell us within 7 days of delivery, with photos. We'll open a claim and keep you updated." },
    localAreas: { q: 'Which areas do your riders cover?', a: 'Buea, Limbe and Douala. When you book, choose your city and the pickup and drop-off areas to see the price.' },
    localPrice: { q: 'How is the price worked out?', a: "By city, the pickup and drop-off areas, and the parcel size. Express pickup costs extra. If your areas aren't listed yet, we confirm the price before pickup." },
    localCod: { q: 'Can the rider collect money from the recipient?', a: 'Yes. Choose cash on delivery when you book and enter the amount. We pay it to you as agreed.' },
    localUnavailable: { q: "What if the recipient isn't available?", a: "The rider tries to reach them. If the delivery can't be made, your tracking page shows why and our team contacts you to arrange a new time." },
    localMap: { q: "Why can't I see the rider on the map?", a: 'The location appears once your parcel is picked up and updates every few seconds while the rider is on the way.' },
    payMethods: { q: 'Which payment methods do you accept?', a: 'Cash to the rider, MTN Mobile Money and Orange Money to the TanEx company accounts, and for international shipments the options shown on your payment request.' },
    payMomoProof: { q: 'How do I prove a Mobile Money payment?', a: 'Upload a screenshot of the confirmation SMS on your tracking page, with the transaction ID.' },
  },
  banner: {
    title: 'Still need help with a shipment?',
    contact: 'Contact Support',
    call: 'Call {phone}',
  },
};

export default help;
export type HelpMessages = typeof help;
