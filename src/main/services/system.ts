import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

export function listAuditLog(db: Database.Database, limit = 200) {
  return db.prepare(`SELECT id,entity_type,entity_id,action,old_values,new_values,reason,created_at
    FROM audit_log ORDER BY id DESC LIMIT ?`).all(Math.max(1, Math.min(1000, limit)));
}

export function getSettings(db: Database.Database) {
  return db.prepare('SELECT key,value,updated_at FROM app_settings ORDER BY key').all();
}

export function setSetting(db: Database.Database, key: string, value: string) {
  if (!key?.trim() || key.length > 100) throw new Error('مفتاح الإعداد غير صحيح');
  db.prepare(`INSERT INTO app_settings(key,value) VALUES(?,?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=datetime('now','localtime')`).run(key.trim(), String(value));
  db.prepare(`INSERT INTO audit_log(entity_type,entity_id,action,new_values,reason)
    VALUES('setting',NULL,'update',?,'تعديل إعدادات النظام')`).run(JSON.stringify({key,value}));
  return { key, value };
}

export function createDatabaseBackup(db: Database.Database, backupRoot: string) {
  fs.mkdirSync(backupRoot, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = path.join(backupRoot, `ronaq-backup-${stamp}.sqlite`);
  const temp = `${target}.partial`;
  try {
    return db.backup(temp).then(() => {
      const verify = new Database(temp, { readonly: true, fileMustExist: true });
      try {
        const integrity = verify.pragma('integrity_check', { simple: true });
        if (integrity !== 'ok') throw new Error(`فشل فحص النسخة الاحتياطية: ${integrity}`);
        const foreignKeyIssues = verify.pragma('foreign_key_check') as unknown[];
        if (foreignKeyIssues.length) throw new Error('النسخة تحتوي على علاقات بيانات غير سليمة');
      } finally { verify.close(); }
      fs.renameSync(temp, target);
      db.prepare(`INSERT INTO backup_history(file_name,backup_path,status,verified_at)
        VALUES(?,?,'success',datetime('now','localtime'))`).run(path.basename(target), target);
      const old = db.prepare(`SELECT id,backup_path FROM backup_history WHERE status='success' ORDER BY id DESC LIMIT -1 OFFSET 30`).all() as Array<{id:number;backup_path:string}>;
      const remove = db.prepare('DELETE FROM backup_history WHERE id=?');
      for (const item of old) { try { fs.unlinkSync(item.backup_path); } catch {} remove.run(item.id); }
      return { path: target, verified: true };
    }).catch((error) => {
      try { if (fs.existsSync(temp)) fs.unlinkSync(temp); } catch {}
      db.prepare(`INSERT INTO backup_history(file_name,backup_path,status,error_message)
        VALUES(?,?,'failed',?)`).run(path.basename(target), target, String(error));
      throw error;
    });
  } catch (error) {
    try { if (fs.existsSync(temp)) fs.unlinkSync(temp); } catch {}
    throw error;
  }
}

export function listBackupHistory(db: Database.Database) {
  return db.prepare(`SELECT id,file_name,backup_path,status,error_message,created_at,verified_at
    FROM backup_history ORDER BY id DESC LIMIT 100`).all();
}

export function recordOpeningBalances(db: Database.Database, input: {
  balanceDate: string; cash?: number; finishedGoods?: Array<{productId:number;quantity:number}>;
  rawMaterials?: Array<{materialId:number;quantity:number}>;
  partyBalances?: Array<{partyId:number;balance:number;direction:'receivable'|'payable'}>;
}) {
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(input.balanceDate) || Number.isNaN(Date.parse(input.balanceDate)) || new Date(input.balanceDate).toISOString().slice(0,10)!==input.balanceDate) throw new Error('تاريخ بداية النظام غير صحيح');
  if (input.cash !== undefined && (!Number.isSafeInteger(input.cash) || input.cash < 0)) throw new Error('رصيد الصندوق يجب أن يكون عدداً صحيحاً غير سالب');
  const run = db.transaction(() => {
    if (db.prepare("SELECT 1 FROM opening_balance_batches LIMIT 1").get()) throw new Error('تم تسجيل الأرصدة الافتتاحية مسبقاً. استخدم تسوية موثقة بدلاً من تكرارها.');
    const result = db.prepare(`INSERT INTO opening_balance_batches(balance_date,notes) VALUES(?,?)`).run(input.balanceDate, 'الأرصدة الافتتاحية عند بدء استخدام النظام');
    const batchId = Number(result.lastInsertRowid);
    const cash = input.cash || 0;
    if (cash > 0) db.prepare(`INSERT INTO cash_movements(movement_type,direction,amount,reference_type,reference_id,notes)
      VALUES('opening','in',?,'opening_balance',?,'رصيد الصندوق الافتتاحي')`).run(cash,batchId);
    const stock = db.prepare(`INSERT INTO stock_movements(product_id,movement_type,quantity,reference_type,reference_id,notes)
      VALUES(?,'opening',?,'opening_balance',?,'رصيد مخزون افتتاحي')`);
    const seenProducts = new Set<number>();
    for (const line of input.finishedGoods || []) {
      if (!Number.isSafeInteger(line.productId) || line.productId < 1 || !Number.isSafeInteger(line.quantity) || line.quantity <= 0 || seenProducts.has(line.productId)) throw new Error('تحقق من صنف وكمية المخزون الافتتاحي وتجنب تكرار الصنف');
      seenProducts.add(line.productId);
      stock.run(line.productId,line.quantity,batchId);
    }
    const raw = db.prepare(`INSERT INTO raw_material_movements(material_id,direction,quantity,reference_type,reference_id,notes)
      VALUES(?,'in',?,'opening_balance',?,'رصيد مواد أولية افتتاحي')`);
    const seenMaterials = new Set<number>();
    for (const line of input.rawMaterials || []) {
      if (!Number.isSafeInteger(line.materialId) || line.materialId < 1 || !Number.isSafeInteger(line.quantity) || line.quantity <= 0 || seenMaterials.has(line.materialId)) throw new Error('تحقق من المادة وكمية رصيدها الافتتاحي وتجنب تكرار المادة');
      seenMaterials.add(line.materialId);
      raw.run(line.materialId,line.quantity,batchId);
    }
    const party = db.prepare(`INSERT INTO opening_party_balances(batch_id,party_id,balance,direction)
      VALUES(?,?,?,?)`);
    const seenParties = new Set<string>();
    for (const line of input.partyBalances || []) {
      const key = `${line.partyId}:${line.direction}`;
      if (!Number.isSafeInteger(line.partyId) || line.partyId < 1 || !Number.isSafeInteger(line.balance) || line.balance <= 0 || !['receivable','payable'].includes(line.direction) || seenParties.has(key)) throw new Error('تحقق من الطرف ومبلغ رصيده الافتتاحي وتجنب تكرار نفس الرصيد');
      seenParties.add(key);
      party.run(batchId,line.partyId,line.balance,line.direction);
    }
    db.prepare(`INSERT INTO audit_log(entity_type,entity_id,action,new_values,reason)
      VALUES('opening_balance',?,'create',?,'تسجيل الأرصدة الافتتاحية')`).run(batchId,JSON.stringify(input));
    return { id: batchId };
  });
  return run();
}


/** Restore only a verified backup already registered in backup_history.
 * A fresh safety backup is created first; the app then restarts onto the restored file.
 */
export async function restoreDatabaseBackup(
  db: Database.Database, backupId: number, backupRoot: string, databasePath: string,
  closeDatabase: () => void, restartApplication: () => void
) {
  const row = db.prepare(`SELECT id,backup_path,file_name,status FROM backup_history WHERE id=?`).get(backupId) as
    {id:number;backup_path:string;file_name:string;status:string}|undefined;
  if (!row || row.status !== 'success') throw new Error('النسخة المحددة غير موجودة أو غير معتمدة');
  const root = path.resolve(backupRoot) + path.sep;
  const source = path.resolve(row.backup_path);
  if (!source.startsWith(root) || !fs.existsSync(source)) throw new Error('ملف النسخة الاحتياطية غير موجود داخل مجلد النسخ');
  const verify = new Database(source, { readonly: true, fileMustExist: true });
  try {
    const integrity = verify.pragma('integrity_check', { simple: true });
    if (integrity !== 'ok') throw new Error('فشل فحص سلامة النسخة؛ لم يتم إجراء الاستعادة');
    const fk = verify.pragma('foreign_key_check') as unknown[];
    if (fk.length) throw new Error('النسخة تحتوي على علاقات غير سليمة؛ لم يتم إجراء الاستعادة');
    const hasSchema = verify.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='schema_migrations'").get();
    if (!hasSchema) throw new Error('الملف المحدد ليس نسخة من نظام رونق');
  } finally { verify.close(); }

  const staged = `${databasePath}.restore-ready`;
  let safety: {path:string;verified:boolean} | null = null;
  try {
    // Stage the selected backup before creating the safety copy: retention may prune old generations.
    fs.copyFileSync(source, staged);
    const stagedDb = new Database(staged, { readonly: true, fileMustExist: true });
    try {
      if (stagedDb.pragma('integrity_check', { simple: true }) !== 'ok') throw new Error('تعذر التحقق من الملف المرحلي');
      if ((stagedDb.pragma('foreign_key_check') as unknown[]).length) throw new Error('الملف المرحلي يحتوي على علاقات غير سليمة');
    } finally { stagedDb.close(); }
    safety = await createDatabaseBackup(db, backupRoot);
    closeDatabase();
    for (const suffix of ['', '-wal', '-shm']) {
      const target = `${databasePath}${suffix}`;
      if (fs.existsSync(target)) fs.unlinkSync(target);
    }
    fs.renameSync(staged, databasePath);
    restartApplication();
    return { restored: true, safetyBackup: safety!.path, restartRequired: true };
  } catch (error) {
    try { if (fs.existsSync(staged)) fs.unlinkSync(staged); } catch {}
    // If replacement failed after closing the connection, recover the live DB from the safety copy.
    if (!fs.existsSync(databasePath) && safety && fs.existsSync(safety.path)) fs.copyFileSync(safety.path, databasePath);
    throw error;
  }
}


export function getOpeningBalanceStatus(db: Database.Database) {
  const batch = db.prepare(`SELECT id,balance_date,created_at,notes FROM opening_balance_batches ORDER BY id DESC LIMIT 1`).get() as
    {id:number;balance_date:string;created_at:string;notes:string|null}|undefined;
  return { recorded: !!batch, batch: batch || null };
}

export function listOpeningBalanceParties(db: Database.Database) {
  return db.prepare(`SELECT id,party_type,name,phone FROM parties WHERE is_active=1 ORDER BY party_type,name`).all();
}


/** Destructive reset for commissioning: caller MUST create a verified backup first. */
export function resetAllBusinessData(db: Database.Database) {
  const keep = new Set(['schema_migrations','app_settings','backup_history']);
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as Array<{name:string}>;
  db.pragma('foreign_keys = OFF');
  try {
    const reset = db.transaction(() => {
      for (const {name} of tables) {
        if (keep.has(name)) continue;
        // Table names come only from sqlite_master, never from user input.
        db.exec(`DELETE FROM "${name.replace(/"/g,'""')}"`);
      }
      try { db.exec("DELETE FROM sqlite_sequence"); } catch {}
      db.prepare('INSERT OR IGNORE INTO products(code,name,unit) VALUES (?,?,?)').run('JUG16','جلكان ماء 16 لتر','حبة');
      db.prepare('INSERT OR IGNORE INTO products(code,name,unit) VALUES (?,?,?)').run('CUP180-40','كارتون أكواب 180 مل - 40','كارتون');
      db.prepare('INSERT OR IGNORE INTO products(code,name,unit) VALUES (?,?,?)').run('CUP180-60','كارتون أكواب 180 مل - 60','كارتون');
    });
    reset();
  } finally { db.pragma('foreign_keys = ON'); }
  return { reset:true };
}
