import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
export type RemovableDrive = { drive: string; label: string; freeBytes: number };

export async function listRemovableDrives(): Promise<RemovableDrive[]> {
  if (process.platform !== 'win32') return [];
  const script = `$ErrorActionPreference='Stop'; Get-CimInstance Win32_LogicalDisk -Filter "DriveType=2" | Select-Object DeviceID,VolumeName,FreeSpace | ConvertTo-Json -Compress`;
  const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-Command',script], { timeout: 12000, windowsHide: true, maxBuffer: 1024 * 1024 });
  const raw = stdout.trim();
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  const rows = Array.isArray(parsed) ? parsed : [parsed];
  return rows.filter((x:any)=>typeof x.DeviceID==='string' && /^[A-Z]:$/i.test(x.DeviceID))
    .map((x:any)=>({drive:String(x.DeviceID).toUpperCase(),label:String(x.VolumeName||'USB'),freeBytes:Number(x.FreeSpace||0)}));
}

function verifySQLite(filePath: string) {
  const verify = new Database(filePath, { readonly: true, fileMustExist: true });
  try {
    if (verify.pragma('integrity_check', { simple: true }) !== 'ok') throw new Error('فشل فحص سلامة نسخة USB');
    if ((verify.pragma('foreign_key_check') as unknown[]).length) throw new Error('نسخة USB تحتوي على علاقات بيانات غير سليمة');
    if (!verify.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='schema_migrations'").get()) throw new Error('ملف النسخة ليس قاعدة RONAQ ERP');
  } finally { verify.close(); }
}

export function copyVerifiedBackupToUsb(
  db: Database.Database, drive: RemovableDrive, backupRoot: string
) {
  const latest = db.prepare(`SELECT id,file_name,backup_path FROM backup_history WHERE status='success' AND verified_at IS NOT NULL ORDER BY id DESC LIMIT 1`).get() as
    {id:number;file_name:string;backup_path:string}|undefined;
  if (!latest) throw new Error('لا توجد نسخة احتياطية محلية ناجحة لإرسالها إلى USB');
  const root = path.resolve(backupRoot) + path.sep;
  const source = path.resolve(latest.backup_path);
  if (!source.startsWith(root) || !fs.existsSync(source)) throw new Error('ملف النسخة المحلية غير موجود داخل مجلد النسخ');
  verifySQLite(source);
  const size = fs.statSync(source).size;
  if (drive.freeBytes < size + 5 * 1024 * 1024) throw new Error(`مساحة USB غير كافية. المطلوب تقريباً ${Math.ceil((size+5*1024*1024)/1024/1024)} MB`);
  const destinationRoot = path.join(drive.drive + path.sep, 'RONAQ-Backups');
  fs.mkdirSync(destinationRoot, { recursive: true });
  let destination = path.join(destinationRoot, latest.file_name);
  if (fs.existsSync(destination)) {
    try {
      if (fs.statSync(destination).size === size) {
        verifySQLite(destination);
        return { copied:false, alreadyPresent:true, fileName:path.basename(destination), drive:drive.drive, backupId:latest.id };
      }
    } catch { /* keep the damaged file and write a fresh generation beside it */ }
    const stamp = new Date().toISOString().replace(/[:.]/g,'-');
    destination = path.join(destinationRoot, `ronaq-usb-${stamp}.sqlite`);
  }
  const partial = `${destination}.${process.pid}.${Date.now()}.partial`;
  try {
    fs.copyFileSync(source, partial, fs.constants.COPYFILE_EXCL);
    if (fs.statSync(partial).size !== size) throw new Error('حجم الملف المنسوخ لا يطابق النسخة الأصلية');
    verifySQLite(partial);
    fs.renameSync(partial, destination);
    db.prepare(`INSERT INTO audit_log(entity_type,entity_id,action,new_values,reason)
      VALUES('backup',?,'usb_copy',?,'نسخ احتياطي تلقائي إلى USB بعد فحص السلامة')`).run(latest.id,JSON.stringify({drive:drive.drive,fileName:path.basename(destination)}));
    return { copied:true, alreadyPresent:false, fileName:path.basename(destination), drive:drive.drive, backupId:latest.id };
  } catch (error) {
    try { if (fs.existsSync(partial)) fs.unlinkSync(partial); } catch {}
    throw error;
  }
}

export async function scanAndCopyToConnectedUsb(db: Database.Database, backupRoot: string) {
  const drives = await listRemovableDrives();
  const results = drives.map(drive => {
    try { return { ...drive, result:copyVerifiedBackupToUsb(db,drive,backupRoot), error:null }; }
    catch (error) { return { ...drive, result:null, error:error instanceof Error?error.message:String(error) }; }
  });
  return { drives:results };
}
