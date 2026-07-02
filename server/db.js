import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// DB_PATH lets Render point this at a persistent disk. Defaults next to the app.
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data.db')

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')

db.exec(`
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
CREATE TABLE IF NOT EXISTS edits (
  id INTEGER PRIMARY KEY AUTOINCREMENT, brand_id TEXT, user_id TEXT, at TEXT, summary TEXT
);
`)

export default db
