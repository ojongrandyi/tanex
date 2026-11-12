// Small helpers for the Blog studio: permissions as the server applies them (server/routes/blog.ts),
// Africa/Douala times for scheduling, and status chips.
import { OFFICE_TIME_ZONE } from '../../config/brand';
import { formatDateTime } from '../../i18n/format';
import type { BlogPostSummary, PostStatus } from './blogApi';
import type { PermissionKey } from '../../shared/permissions';

type CanFn = (key: PermissionKey) => boolean;

/** A writer without blog.edit_any edits own posts only while they are drafts or in review. */
export function canEditPost(post: BlogPostSummary, userId: string | undefined, can: CanFn): boolean {
  if (can('blog.edit_any')) return true;
  return can('blog.write') && post.author.id === userId && (post.status === 'DRAFT' || post.status === 'IN_REVIEW');
}

export function seesAllPosts(can: CanFn): boolean {
  return can('blog.view') || can('blog.edit_any') || can('blog.publish');
}


export function statusChipClass(status: PostStatus): string {
  switch (status) {
    case 'PUBLISHED': return 'tx-iam-chip ok';
    case 'IN_REVIEW': return 'tx-iam-chip warn';
    case 'SCHEDULED': return 'tx-iam-chip tx-blog-chip--scheduled';
    case 'ARCHIVED': return 'tx-iam-chip off';
    default: return 'tx-iam-chip';
  }
}

export function when(ts: number | null | undefined): string {
  return ts ? formatDateTime(ts, 'en') : '';
}

/** Offset of Africa/Douala from UTC at a moment, in ms (WAT, UTC+1; computed, not assumed). */
function zoneOffsetMs(at: number): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: OFFICE_TIME_ZONE, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).formatToParts(new Date(at));
  const n = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'), n('second'));
  return asUtc - Math.floor(at / 1000) * 1000;
}

/** "2026-11-20T09:30" read as Africa/Douala time → epoch ms, or null. */
export function officeInputToEpoch(value: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  return guess - zoneOffsetMs(guess);
}

/** Epoch ms → "YYYY-MM-DDTHH:MM" in Africa/Douala, for a datetime-local input. */
export function epochToOfficeInput(ts: number): string {
  const d = new Date(ts + zoneOffsetMs(ts));
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

export function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
