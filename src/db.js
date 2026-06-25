import { mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const defaultDbPath = join(rootDir, "data", "app.db");
const fixturePath = join(rootDir, "data", "sample-fixtures.json");

export function getDbPath() {
  return process.env.APP_DB_PATH || defaultDbPath;
}

export async function openDatabase() {
  const dbPath = getDbPath();
  await mkdir(dirname(dbPath), { recursive: true });

  const db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS samples (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      source TEXT NOT NULL,
      tags_json TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  return db;
}

export async function seedSamples(db) {
  const database = db || (await openDatabase());
  const raw = await readFile(fixturePath, "utf8");
  const samples = JSON.parse(raw);
  const insert = database.prepare(`
    INSERT INTO samples (id, title, source, tags_json, body)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      source = excluded.source,
      tags_json = excluded.tags_json,
      body = excluded.body
  `);

  for (const sample of samples) {
    insert.run(sample.id, sample.title, sample.source, JSON.stringify(sample.tags), sample.body);
  }

  return samples.length;
}

export async function ensureSeeded(db) {
  const database = db || (await openDatabase());
  const count = database.prepare("SELECT COUNT(*) AS count FROM samples").get().count;
  if (count === 0) {
    await seedSamples(database);
  }
  return database;
}

export async function listSamples() {
  const db = await ensureSeeded();
  const rows = db
    .prepare("SELECT id, title, source, tags_json, created_at FROM samples ORDER BY created_at DESC, title ASC")
    .all();
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    source: row.source,
    tags: JSON.parse(row.tags_json),
    createdAt: row.created_at,
  }));
}

export async function getSample(id) {
  const db = await ensureSeeded();
  const row = db.prepare("SELECT * FROM samples WHERE id = ?").get(id);
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    source: row.source,
    tags: JSON.parse(row.tags_json),
    body: row.body,
    createdAt: row.created_at,
  };
}
