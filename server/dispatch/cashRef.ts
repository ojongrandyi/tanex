// Cash ledger references (TX-CSH-######, BRAND_GUIDE §7, DISPATCH_SPEC §3). The server allocates
// them; cash_ledger.ref is UNIQUE, and this picks one not already used.
import type { DatabaseSync } from 'node:sqlite';
import { generateReference } from '../../src/shared/references.js';

export function allocateCashRef(conn: DatabaseSync, random: () => string = () => generateReference('cash')): string {
  const exists = conn.prepare('SELECT 1 FROM cash_ledger WHERE ref = ?');
  for (let i = 0; i < 20; i++) {
    const ref = random();
    if (!exists.get(ref)) return ref;
  }
  throw new Error('Could not allocate a free cash ledger reference.');
}
