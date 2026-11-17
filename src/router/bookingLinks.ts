// Where booking buttons lead. "Book a bike delivery" opens the local-delivery booking page
// (/local-delivery, /fr/livraison-locale; G.6). Before G.6 it opened the Services page's
// local-delivery section; every button reads this one constant.
export const BIKE_BOOKING: { page: string; param?: string } = { page: 'local-delivery' };
