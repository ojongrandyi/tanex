// Creates a Super Admin, or recovers an existing account as one (docs/IAM_RBAC_SPEC.md §8).
// Run on the server: `npm run create-super-admin`. Prompts for email, name and password and
// never prints the password or its hash. Also the recovery tool when every Super Admin is
// locked out: for an existing email it resets the password, re-enables the account, clears
// the lockout, ensures the Super Admin role and signs the account out everywhere.
//
// Compiled with the server (tsconfig.server.json) so it runs with plain `node` on the host.
import 'dotenv/config'; // must stay first: server/db.js reads DB_PATH when it is imported
import readline from 'node:readline';
import bcrypt from 'bcryptjs';
import { db, dbPath, initDatabase } from '../server/db.js';
import {
  BCRYPT_COST,
  DEFAULT_SUPER_ADMIN_NAME,
  createSuperAdmin,
  findSuperAdminRoleId,
  looksLikeEmail,
  normalizeEmail,
  recoverSuperAdmin
} from '../server/auth/bootstrap.js';
import { PASSWORD_MIN_LENGTH, checkNewPassword } from '../src/shared/passwordPolicy.js';

const ACTOR = 'create-super-admin script';
const isTTY = Boolean(process.stdin.isTTY);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: isTTY });
rl.on('SIGINT', () => {
  process.stdout.write('\nCancelled. Nothing changed.\n');
  process.exit(130);
});

// While muted, readline's echo of typed characters is swallowed (password entry).
let muted = false;
const rlInternal = rl as unknown as { _writeToOutput: (s: string) => void };
const writeToOutput = rlInternal._writeToOutput.bind(rl);
rlInternal._writeToOutput = (s: string) => { if (!muted) writeToOutput(s); };

const lines = rl[Symbol.asyncIterator]();

async function ask(prompt: string, hidden = false): Promise<string> {
  process.stdout.write(prompt);
  muted = hidden;
  const { value, done } = await lines.next();
  muted = false;
  if (hidden && isTTY) process.stdout.write('\n');
  if (done) throw new Error('Input ended before all answers were given.');
  return value as string;
}

async function confirm(prompt: string): Promise<boolean> {
  return /^y(es)?$/i.test((await ask(`${prompt} [y/N] `)).trim());
}

async function askNewPassword(email: string, phone: string | null): Promise<string> {
  for (;;) {
    const password = await ask(`New password (at least ${PASSWORD_MIN_LENGTH} characters): `, true);
    const problem = checkNewPassword(password, { email, phone });
    if (problem === 'too_short') { console.log(`  Too short: use at least ${PASSWORD_MIN_LENGTH} characters.`); continue; }
    if (problem === 'same_as_identifier') { console.log('  The password must not be the email address or phone number.'); continue; }
    const again = await ask('Repeat the password: ', true);
    if (again !== password) { console.log('  The two passwords do not match. Try again.'); continue; }
    return password;
  }
}

async function main(): Promise<number> {
  if (process.env.ADMIN_PROXY_TARGET) {
    console.error('ADMIN_PROXY_TARGET is set: this deployment has no database. Run this on the main app.');
    return 1;
  }

  initDatabase();
  if (!findSuperAdminRoleId(db)) {
    console.error('The Super Admin role is missing from the database. Nothing changed.');
    return 1;
  }
  const { c: activeSuperAdmins } = db.prepare(`
    SELECT COUNT(DISTINCT u.id) AS c FROM users u
    JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id
    WHERE r.is_locked = 1 AND u.status = 'ACTIVE'
  `).get() as { c: number };
  console.log(`Database: ${dbPath}`);
  console.log(`Active Super Admins: ${activeSuperAdmins}\n`);

  let email = '';
  while (!looksLikeEmail(email)) {
    email = normalizeEmail(await ask('Email: '));
    if (!looksLikeEmail(email)) console.log('  Enter a valid email address.');
  }

  const existing = db.prepare('SELECT id, display_name, status, phone FROM users WHERE email = ?')
    .get(email) as { id: string; display_name: string; status: string; phone: string | null } | undefined;

  if (existing) {
    console.log(`An account already exists for ${email} (${existing.display_name}, ${existing.status}).`);
    if (!(await confirm('Reset its password, re-enable it and make it a Super Admin?'))) {
      console.log('Nothing changed.');
      return 0;
    }
    const password = await askNewPassword(email, existing.phone);
    const mustChange = await confirm('Require a new password at next sign-in?');
    recoverSuperAdmin(db, {
      userId: existing.id,
      passwordHash: await bcrypt.hash(password, BCRYPT_COST),
      mustChangePassword: mustChange,
      actorName: ACTOR
    });
    console.log(`\nDone: ${email} is an active Super Admin with a new password. Its other sessions were signed out.`);
    return 0;
  }

  const name = (await ask(`Display name [${DEFAULT_SUPER_ADMIN_NAME}]: `)).trim() || DEFAULT_SUPER_ADMIN_NAME;
  const password = await askNewPassword(email, null);
  const mustChange = await confirm('Require a new password at first sign-in?');
  createSuperAdmin(db, {
    email,
    displayName: name,
    passwordHash: await bcrypt.hash(password, BCRYPT_COST),
    mustChangePassword: mustChange,
    actorName: ACTOR
  });
  console.log(`\nDone: Super Admin created for ${email} (${name}).`);
  return 0;
}

main()
  .then((code) => { process.exitCode = code; })
  .catch((err: unknown) => {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  })
  .finally(() => {
    rl.close();
    db.close();
  });
