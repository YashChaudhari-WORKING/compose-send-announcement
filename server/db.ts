import Database from "better-sqlite3";

/**
 * Creates a configured SQLite connection.
 *
 * The whole idempotency guarantee rests on this file:
 *   UNIQUE (idempotency_key, contact_id)
 * The database — not application code — enforces that a given send reaches a given recipient at
 * most once. Even under a double-click, a retry, or two requests racing in parallel, the second
 * write of the same (key, contact) pair cannot be committed.
 *
 * @param filename  A file path for durable state (the app uses "app.db"), or ":memory:" for tests.
 */
export function createDb(filename: string): Database.Database {
  const db = new Database(filename);

  // WAL improves read/write behaviour under concurrency. (No-op for an in-memory test DB.)
  db.pragma("journal_mode = WAL");
  // Defensive: if a second connection ever holds the write lock, retry for up to 5s instead of
  // throwing SQLITE_BUSY. With our single shared connection this never triggers, but it makes the
  // server robust if the DB is ever opened from elsewhere (e.g. a read connection in a test).
  db.pragma("busy_timeout = 5000");

  db.exec(`
    CREATE TABLE IF NOT EXISTS deliveries (
      id              INTEGER PRIMARY KEY,
      idempotency_key TEXT    NOT NULL,
      contact_id      TEXT    NOT NULL,   -- "c_001" from the fixture; contacts stay in JSON, not here
      subject         TEXT    NOT NULL,
      body            TEXT    NOT NULL,
      sent_at         TEXT    NOT NULL DEFAULT (datetime('now')),

      -- The single most important line in the codebase: one delivery per (send, recipient).
      UNIQUE (idempotency_key, contact_id)
    );
  `);

  return db;
}

export type DB = Database.Database;
