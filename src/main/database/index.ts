import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { app } from 'electron';
import { schema } from './schema';

let db: Database.Database | null = null;
export function openDatabase() {
  if (db) return db;
  const folder = path.join(app.getPath('userData'), 'data');
  fs.mkdirSync(folder, { recursive: true });
  db = new Database(path.join(folder, 'ronaq-erp.sqlite'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.exec(schema);
  db.prepare('INSERT OR IGNORE INTO schema_migrations(version) VALUES (?)').run(1);
  const seedProduct = db.prepare('INSERT OR IGNORE INTO products(code,name,unit) VALUES (?,?,?)');
  const seed = db.transaction(() => {
    seedProduct.run('JUG16', 'جلكان ماء 16 لتر', 'حبة');
    seedProduct.run('CUP180-40', 'كارتون أكواب 180 مل - 40', 'كارتون');
    seedProduct.run('CUP180-60', 'كارتون أكواب 180 مل - 60', 'كارتون');
  });
  seed();
  return db;
}
export function getDatabaseStatus() {
  const database = openDatabase();
  const integrity = database.pragma('quick_check', { simple: true }) as string;
  return { connected: true, integrity, path: path.join(app.getPath('userData'), 'data', 'ronaq-erp.sqlite') };
}
export function closeDatabase() { db?.close(); db = null; }
