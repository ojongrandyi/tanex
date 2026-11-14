// Sidebar labels and header text for the Tariffs and Couriers views, kept apart from DISPATCH_TEXT so
// the console's main chunk doesn't carry the whole dispatch copy (CONTENT §10.2).
export const DISPATCH_MENU = {
  section: 'DELIVERY',
  tariffs: { menu: 'Tariffs', description: 'Delivery cities, areas, rates and average speeds.' },
  couriers: { menu: 'Couriers', description: 'Riders and drivers: accounts, vehicles and photos.' },
} as const;
