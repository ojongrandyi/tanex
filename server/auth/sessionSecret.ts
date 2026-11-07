// The secret that signs the session cookie. SESSION_SECRET from the environment when set (the
// documented setup, DEPLOYMENT §4). Without it the server never falls back to a value written in
// the code: it creates a random secret once, stores it next to the database (outside the deploy
// folder on Hostinger) with owner-only permissions, and reuses it after restarts, so sessions
// keep working and nobody can know the secret from the source.
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export const SESSION_SECRET_FILE = '.session-secret';
const MIN_LENGTH = 32;

export function resolveSessionSecret(dataDir: string, env: NodeJS.ProcessEnv = process.env): string {
  const fromEnv = (env.SESSION_SECRET || '').trim();
  if (fromEnv) {
    if (fromEnv.length < MIN_LENGTH) {
      console.warn(`[server] SESSION_SECRET is shorter than ${MIN_LENGTH} characters; generate a longer one (DEPLOYMENT §4).`);
    }
    return fromEnv;
  }

  const file = path.join(dataDir, SESSION_SECRET_FILE);
  try {
    const stored = fs.readFileSync(file, 'utf8').trim();
    if (stored.length >= MIN_LENGTH) {
      console.warn(`[server] SESSION_SECRET is not set; using the generated secret in ${file}. Set SESSION_SECRET (DEPLOYMENT §4).`);
      return stored;
    }
  } catch {
    // Not created yet.
  }
  const secret = crypto.randomBytes(48).toString('hex');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(file, secret + '\n', { encoding: 'utf8', mode: 0o600 });
  console.warn(`[server] SESSION_SECRET is not set; generated a random secret in ${file}. Set SESSION_SECRET (DEPLOYMENT §4).`);
  return secret;
}
