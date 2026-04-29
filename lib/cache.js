// L2 cache backed by SQLite (better-sqlite3, synchronous).
// Sits below the in-process Map caches in server.js. The Map is L1 (sub-µs
// reads, lost on restart); this is L2 (sub-ms reads, survives restart).
// Postgres is L3, the source of truth.
//
// Layout: one table, namespaced. Each consumer (loop_detail, summary, etc.)
// picks its own namespace string so values don't collide.
//
// TTL is enforced on read, not by a background sweep — simpler, and rows we
// never read again don't matter. A periodic vacuum keeps the file from
// growing unbounded if a namespace churns hard.

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const CACHE_DIR = path.join(__dirname, '..', 'cache');
const DB_FILE = path.join(CACHE_DIR, 'cache.db');

fs.mkdirSync(CACHE_DIR, { recursive: true });

const db = new Database(DB_FILE);

// WAL gives us concurrent readers + a single writer without blocking, and
// survives crashes cleanly. NORMAL sync is the usual WAL pairing — durable
// to OS crash, not to power loss; fine for a cache.
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS kv_cache (
    namespace TEXT NOT NULL,
    key       TEXT NOT NULL,
    value     TEXT NOT NULL,
    stored_at INTEGER NOT NULL,
    PRIMARY KEY (namespace, key)
  ) WITHOUT ROWID;
`);

// Prepared statements compile once; better-sqlite3 reuses them on every call.
const selectStmt = db.prepare(
  'SELECT value, stored_at FROM kv_cache WHERE namespace = ? AND key = ?'
);
const upsertStmt = db.prepare(`
  INSERT INTO kv_cache (namespace, key, value, stored_at)
  VALUES (?, ?, ?, ?)
  ON CONFLICT(namespace, key) DO UPDATE SET
    value = excluded.value,
    stored_at = excluded.stored_at
`);
const deleteStmt = db.prepare('DELETE FROM kv_cache WHERE namespace = ? AND key = ?');
const deleteExpiredStmt = db.prepare(
  'DELETE FROM kv_cache WHERE namespace = ? AND stored_at < ?'
);
const countStmt = db.prepare('SELECT COUNT(*) AS n FROM kv_cache WHERE namespace = ?');

function cacheGet(namespace, key, ttlMs) {
  const row = selectStmt.get(namespace, String(key));
  if (!row) return null;
  // >= so ttlMs=0 is "always stale" (matches the intuitive contract:
  // "is this fresher than 0ms old?" — answer must be no).
  if (ttlMs != null && Date.now() - row.stored_at >= ttlMs) return null;
  try {
    return JSON.parse(row.value);
  } catch {
    // Corrupt row — drop it and miss.
    deleteStmt.run(namespace, String(key));
    return null;
  }
}

function cacheSet(namespace, key, value) {
  const json = JSON.stringify(value);
  upsertStmt.run(namespace, String(key), json, Date.now());
}

function cacheDelete(namespace, key) {
  deleteStmt.run(namespace, String(key));
}

// Drop entries older than ttlMs in a namespace. Optional housekeeping —
// not required for correctness because reads check TTL on the way out.
function cachePurgeExpired(namespace, ttlMs) {
  const cutoff = Date.now() - ttlMs;
  return deleteExpiredStmt.run(namespace, cutoff).changes;
}

function cacheCount(namespace) {
  return countStmt.get(namespace).n;
}

function close() {
  db.close();
}

module.exports = {
  cacheGet,
  cacheSet,
  cacheDelete,
  cachePurgeExpired,
  cacheCount,
  close,
};
