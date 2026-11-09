// The TanEx services offered on the Quote and Ship forms (docs/CONTENT.md §3.1, §7.1). `name` is
// the value stored with the quote or shipment (English, as the console reads it); pages show the
// translated name and summary from their dictionary using `key`. The ids are the same as the
// Services page anchors (/services/<id>), so "Get a Quote" from a service preselects it.

export type ServiceOptionId = 'air' | 'maritime' | 'rail' | 'road' | 'warehousing' | 'local-delivery';

export interface ServiceOption {
  id: ServiceOptionId;
  /** Dictionary key (quote.services.<key>, ship.services.<key>). */
  key: 'air' | 'maritime' | 'rail' | 'road' | 'warehousing' | 'local';
  /** Stored value (English). */
  name: string;
  /** English summary (CONTENT §3.1), for places without a dictionary. */
  summary: string;
}

export const SERVICE_OPTIONS: ServiceOption[] = [
  { id: 'air', key: 'air', name: 'Air freight', summary: 'International air shipping for documents, parcels and time-sensitive cargo.' },
  { id: 'maritime', key: 'maritime', name: 'Maritime freight', summary: 'Ocean shipping in full containers (FCL) or shared containers (LCL) for larger and heavier loads.' },
  { id: 'rail', key: 'rail', name: 'Rail freight', summary: 'Inland transport for heavy and bulk cargo on routes served by rail, combined with road delivery at each end.' },
  { id: 'road', key: 'road', name: 'Road freight', summary: 'Truck and van transport between cities in Cameroon and to neighbouring countries.' },
  { id: 'warehousing', key: 'warehousing', name: 'Warehousing', summary: 'Secure storage for your goods, with receiving, stock checks, packing and dispatch.' },
  { id: 'local-delivery', key: 'local', name: 'Local delivery', summary: 'Same-city delivery by TanEx riders in Buea, Limbe and Douala, with live tracking.' },
];

/** The option whose id or name matches `value` (case-insensitive), or the first option. */
export function findServiceOption(value?: string): ServiceOption {
  const v = (value || '').trim().toLowerCase();
  return SERVICE_OPTIONS.find((s) => s.id === v || s.name.toLowerCase() === v) || SERVICE_OPTIONS[0];
}
