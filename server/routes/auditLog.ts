// Audit log reader (docs/IAM_RBAC_SPEC.md §6, §9): filter by person, action, record and date
// range; newest first; paginated. Rows were stripped of secrets when written (server/audit.ts).
import { Router, Request, Response } from 'express';
import { db } from '../db.js';
import { requirePermission } from '../middleware/auth.js';

export const AUDIT_PAGE_SIZE = 50;
export const AUDIT_PAGE_SIZE_MAX = 100;

interface AuditRow {
  id: string;
  at_ts: number;
  actor_user_id: string | null;
  actor_name: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  summary: string | null;
  before_json: string | null;
  after_json: string | null;
  ip: string | null;
}

function parseJson(value: string | null): unknown {
  if (!value) return null;
  try { return JSON.parse(value); } catch { return null; }
}

const str = (v: unknown, max = 200): string | null =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;

const int = (v: unknown): number | null => {
  if (typeof v !== 'string' || !/^\d{1,16}$/.test(v)) return null;
  return Number(v);
};

export const auditRouter = Router();

// GET /api/audit?actor=&action=&entityType=&entityId=&from=&to=&page=&pageSize=
// from/to are epoch ms (to is exclusive). page starts at 1.
auditRouter.get('/', requirePermission('audit.view'), (req: Request, res: Response) => {
  const q = req.query as Record<string, unknown>;
  const where: string[] = [];
  const args: (string | number)[] = [];

  const actor = str(q.actor);
  if (actor) { where.push('actor_user_id = ?'); args.push(actor); }
  const action = str(q.action);
  if (action) { where.push('action = ?'); args.push(action); }
  const entityType = str(q.entityType);
  if (entityType) { where.push('entity_type = ?'); args.push(entityType); }
  const entityId = str(q.entityId);
  if (entityId) { where.push('entity_id = ? COLLATE NOCASE'); args.push(entityId); }
  const from = int(q.from);
  if (from !== null) { where.push('at_ts >= ?'); args.push(from); }
  const to = int(q.to);
  if (to !== null) { where.push('at_ts < ?'); args.push(to); }

  const pageSize = Math.min(Math.max(int(q.pageSize) ?? AUDIT_PAGE_SIZE, 1), AUDIT_PAGE_SIZE_MAX);
  const page = Math.max(int(q.page) ?? 1, 1);
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const { c: total } = db.prepare(`SELECT COUNT(*) AS c FROM audit_log ${clause}`).get(...args) as { c: number };
  const rows = db.prepare(`
    SELECT * FROM audit_log ${clause} ORDER BY at_ts DESC, id DESC LIMIT ? OFFSET ?
  `).all(...args, pageSize, (page - 1) * pageSize) as unknown as AuditRow[];

  res.json({
    success: true,
    data: {
      total,
      page,
      pageSize,
      items: rows.map((r) => ({
        id: r.id,
        at: r.at_ts,
        actorUserId: r.actor_user_id,
        actorName: r.actor_name,
        action: r.action,
        entityType: r.entity_type,
        entityId: r.entity_id,
        summary: r.summary,
        before: parseJson(r.before_json),
        after: parseJson(r.after_json),
        ip: r.ip
      }))
    }
  });
});

// GET /api/audit/filters: the values the filter menus offer (actions, record types, people).
auditRouter.get('/filters', requirePermission('audit.view'), (_req: Request, res: Response) => {
  const actions = (db.prepare('SELECT DISTINCT action FROM audit_log ORDER BY action').all() as unknown as { action: string }[])
    .map((r) => r.action);
  const entityTypes = (db.prepare('SELECT DISTINCT entity_type AS t FROM audit_log WHERE entity_type IS NOT NULL ORDER BY t').all() as unknown as { t: string }[])
    .map((r) => r.t);
  // Current name when the account still exists, otherwise the name the log recorded last.
  const actors = db.prepare(`
    SELECT a.actor_user_id AS id, COALESCE(u.display_name, MAX(a.actor_name)) AS name
    FROM audit_log a LEFT JOIN users u ON u.id = a.actor_user_id
    WHERE a.actor_user_id IS NOT NULL
    GROUP BY a.actor_user_id ORDER BY name COLLATE NOCASE
  `).all() as unknown as { id: string; name: string }[];
  res.json({ success: true, data: { actions, entityTypes, actors } });
});
