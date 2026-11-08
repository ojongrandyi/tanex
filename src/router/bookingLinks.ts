// Where booking buttons lead. "Book a bike delivery" opens the Services page's local-delivery
// section until the bike booking page goes live with G.6; then this becomes
// { page: 'local-delivery' } and every button follows.
export const BIKE_BOOKING = { page: 'services', param: 'local-delivery' } as const;
