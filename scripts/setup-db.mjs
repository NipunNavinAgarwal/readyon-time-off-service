import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

loadDotEnv();

const databaseUrl = process.env.DATABASE_URL ?? 'file:./dev.db';
const dbPath = resolveDatabasePath(databaseUrl);
const migrationPath = resolve('prisma/migrations/20260603000000_init/migration.sql');

mkdirSync(dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);
try {
  db.exec(readFileSync(migrationPath, 'utf8'));
  console.log(`SQLite schema is ready at ${dbPath}`);
} finally {
  db.close();
}

function resolveDatabasePath(url) {
  if (!url.startsWith('file:')) {
    throw new Error('Only file: SQLite DATABASE_URL values are supported by this setup script.');
  }

  const filePath = url.slice('file:'.length);
  if (isAbsolute(filePath)) {
    return filePath;
  }

  return resolve(join('prisma', filePath));
}

function loadDotEnv() {
  const envPath = resolve('.env');
  if (!existsSync(envPath)) {
    return;
  }

  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const index = trimmed.indexOf('=');
    if (index === -1) {
      continue;
    }
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, '');
    process.env[key] ??= value;
  }
}
