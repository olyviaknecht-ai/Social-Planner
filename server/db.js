import Database from 'better-sqlite3'
import pg from 'pg'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Use Postgres when DATABASE_URL is set (e.g. Render's free Postgres); otherwise
// fall back to a local SQLite file. Same async API either way.
const usePg = !!process.env.DATABASE_URL
let pool
let sdb

if (usePg) {
  pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
} else {
  const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data.db')
  sdb = new Database(DB_PATH)
  sdb.pragma('journal_mode = WAL')
}

// Postgres uses $1,$2… placeholders; our SQL is written with ? for both.
function toPg(sql) {
  let i = 0
  return sql.replace(/\?/g, () => `$${++i}`)
}

export const db = {
  async run(sql, params = []) {
    if (usePg) await pool.query(toPg(sql), params)
    else sdb.prepare(sql).run(...params)
  },
  async get(sql, params = []) {
    if (usePg) return (await pool.query(toPg(sql), params)).rows[0]
    return sdb.prepare(sql).get(...params)
  },
  async all(sql, params = []) {
    if (usePg) return (await pool.query(toPg(sql), params)).rows
    return sdb.prepare(sql).all(...params)
  },
  async exec(sql) {
    if (usePg) await pool.query(sql)
    else sdb.exec(sql)
  },
}

export async function initDb() {
  const idCol = usePg ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, name TEXT, created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS brands (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, owner_id TEXT NOT NULL,
      content TEXT, updated_at TEXT, updated_by TEXT
    );
    CREATE TABLE IF NOT EXISTS brand_members (
      brand_id TEXT, user_id TEXT, role TEXT, PRIMARY KEY (brand_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS invites (
      email TEXT, brand_id TEXT, role TEXT, created_at TEXT, PRIMARY KEY (email, brand_id)
    );
  `)
  await db.exec(`CREATE TABLE IF NOT EXISTS edits (id ${idCol}, brand_id TEXT, user_id TEXT, at TEXT, summary TEXT);`)
}
