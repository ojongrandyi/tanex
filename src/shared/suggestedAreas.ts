// Suggested starting list of delivery areas (docs/DISPATCH_SPEC.md §3, owner to review). Offered as a
// one-click import in Console → Tariffs: it creates the city if missing and adds the areas it
// doesn't have yet, by name. Names only: no prices, no map pins (the admin adds both). DOM-free.

export interface SuggestedCity {
  name: string;
  areas: readonly string[];
}

export const SUGGESTED_AREAS: readonly SuggestedCity[] = [
  {
    name: 'Buea',
    areas: ['Molyko', 'Check Point', 'Bonduma', 'Great Soppo', 'Small Soppo', 'Bokwango', 'Buea Town', 'Mile 16',
      'Mile 17', 'Muea', 'Bomaka', 'Clerks Quarters', 'GRA'],
  },
  {
    name: 'Limbe',
    areas: ['Down Beach', 'Church Street', 'Mile 4', 'Bota', 'Mile 2', 'Ngeme', 'Batoke road', 'Middle Farms'],
  },
  {
    name: 'Douala',
    areas: ['Akwa', 'Bonanjo', 'Bonapriso', 'Bali', 'Deido', 'Bonaberi', 'Makepe', 'Bonamoussadi', 'Logbaba',
      'Ndokotti', 'Bepanda', 'Kotto', 'PK zones'],
  },
];

/** Case- and space-insensitive key for matching names (cities, areas). */
export function nameKey(name: string): string {
  return name.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en');
}
