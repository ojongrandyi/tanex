// Sidebar labels and header text for the Dispatch, Tariffs and Couriers views, kept apart from
// DISPATCH_TEXT and BOARD_TEXT so the console's main chunk doesn't carry the whole dispatch copy
// (CONTENT §10.2).
export const DISPATCH_MENU = {
  section: 'DELIVERY',
  dispatch: {
    menu: 'Dispatch',
    description: 'Delivery jobs, couriers on the map, assigning and prices.',
    attention: (n: number) => `${n} ${n === 1 ? 'job needs' : 'jobs need'} attention`,
  },
  tariffs: { menu: 'Tariffs', description: 'Delivery cities, areas, rates and average speeds.' },
  couriers: { menu: 'Couriers', description: 'Riders and drivers: accounts, vehicles and photos.' },
  cash: { menu: 'Cash & Mobile Money', description: 'Courier balances, handovers and mobile money to confirm, daily report.' },
} as const;
