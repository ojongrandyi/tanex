// Rate-sheet editing helpers for Console → Tariffs (DISPATCH_SPEC §5). Pure functions, kept apart
// from the view so they can be unit-tested. A cell key is "<fromZoneId|*>><toZoneId|*>", where *
// is "any other area". Rates stay directional in the database and in src/shared/localPricing.ts;
// "Same price both ways" (tracker #155) only fills the return cell while editing.

export type Cell = { price: string; express: string };
export type CellField = keyof Cell;

export const ANY = '*';
export const cellKey = (from: string | null, to: string | null) => `${from ?? ANY}>${to ?? ANY}`;
/** The return trip of a cell: A>B → B>A (a diagonal cell is its own return trip). */
export const mirrorKey = (key: string) => key.split('>').reverse().join('>');

/** "" → null, "1 500" / "1500,5" → number, anything else → NaN. */
export function parseAmount(text: string): number | null {
  const t = text.replace(/[\s  ]/g, '').replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

const EMPTY: Cell = { price: '', express: '' };

const sameCell = (a: Cell | undefined, b: Cell | undefined) =>
  parseAmount(a?.price ?? '') === parseAmount(b?.price ?? '') && parseAmount(a?.express ?? '') === parseAmount(b?.express ?? '');

/** True when every cell equals its return-trip cell (an empty sheet is symmetric). */
export function isSymmetricSheet(cells: Record<string, Cell>): boolean {
  return Object.keys(cells).every((k) => sameCell(cells[k], cells[mirrorKey(k)]));
}

/** Sets one field of one cell; with `twoWay` the return-trip cell gets the same value. */
export function setCellValue(cells: Record<string, Cell>, key: string, field: CellField, value: string, twoWay: boolean): Record<string, Cell> {
  const next = { ...cells, [key]: { ...(cells[key] ?? EMPTY), [field]: value } };
  const back = mirrorKey(key);
  if (twoWay && back !== key) next[back] = { ...(cells[back] ?? EMPTY), [field]: value };
  return next;
}

/** Compares sheets by their numbers, ignoring empty cells and spacing. */
export const sheetSignature = (cells: Record<string, Cell>, currency: string) =>
  currency + '|' + Object.keys(cells).sort()
    .filter((k) => cells[k].price.trim() !== '' || cells[k].express.trim() !== '')
    .map((k) => `${k}=${parseAmount(cells[k].price)}/${parseAmount(cells[k].express)}`).join(';');
