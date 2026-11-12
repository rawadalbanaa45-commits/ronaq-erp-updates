import type Database from 'better-sqlite3';
const dateOK=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00'));
const timeOK=(s:string)=>/^([01]\d|2[0-3]):[0-5]\d$/.test(s);
export function workers(db:Database.Database){return db.prepare('SELECT * FROM workers WHERE is_active=1 ORDER BY name').all()}
export function addWorker(db:Database.Database,input:{name:string;jobTitle?:string}){
 const name=input.name?.trim();if(!name||name.length>120)throw new Error('اكتب اسم العامل');
 const r=db.prepare('INSERT INTO workers(name,job_title) VALUES(?,?)').run(name,input.jobTitle?.trim()||null);
 db.prepare("INSERT INTO audit_log(entity_type,entity_id,action,new_values) VALUES('worker',?,'create',?)").run(r.lastInsertRowid,JSON.stringify(input));return {id:Number(r.lastInsertRowid),name};
}
export function attendanceWeek(db:Database.Database,fromDate:string){
 if(!dateOK(fromDate))throw new Error('تاريخ بداية الأسبوع غير صحيح');
 const start=new Date(fromDate+'T12:00:00');const end=new Date(start);end.setDate(end.getDate()+6);
 const endDate=`${end.getFullYear()}-${String(end.getMonth()+1).padStart(2,'0')}-${String(end.getDate()).padStart(2,'0')}`;
 return db.prepare('SELECT a.*,w.name worker_name FROM worker_attendance a JOIN workers w ON w.id=a.worker_id WHERE work_date BETWEEN ? AND ? ORDER BY work_date,worker_name').all(fromDate,endDate);
}
export function recordAttendance(db:Database.Database,input:{workerId:number;workDate:string;status:'present'|'absent'|'leave';checkIn?:string;checkOut?:string;notes?:string}){
 if(!Number.isInteger(input.workerId)||!db.prepare('SELECT id FROM workers WHERE id=? AND is_active=1').get(input.workerId))throw new Error('اختر العامل');
 if(!dateOK(input.workDate))throw new Error('التاريخ غير صحيح');
 if(!['present','absent','leave'].includes(input.status))throw new Error('حالة الحضور غير صحيحة');
 const checkIn=input.status==='present'?(input.checkIn||null):null;
 const checkOut=input.status==='present'?(input.checkOut||null):null;
 if(checkIn&&!timeOK(checkIn)||checkOut&&!timeOK(checkOut)||checkOut&&!checkIn)throw new Error('أدخل وقت حضور وانصراف صحيح');
 return db.transaction(()=>{
  const old=db.prepare('SELECT * FROM worker_attendance WHERE worker_id=? AND work_date=?').get(input.workerId,input.workDate);
  db.prepare(`INSERT INTO worker_attendance(worker_id,work_date,status,check_in,check_out,notes) VALUES(?,?,?,?,?,?) ON CONFLICT(worker_id,work_date) DO UPDATE SET status=excluded.status,check_in=excluded.check_in,check_out=excluded.check_out,notes=excluded.notes,updated_at=datetime('now','localtime')`).run(input.workerId,input.workDate,input.status,checkIn,checkOut,input.notes?.trim()||null);
  const row=db.prepare('SELECT * FROM worker_attendance WHERE worker_id=? AND work_date=?').get(input.workerId,input.workDate) as {id:number};
  db.prepare("INSERT INTO audit_log(entity_type,entity_id,action,old_values,new_values) VALUES('worker_attendance',?,?,?,?)").run(row.id,old?'update':'create',old?JSON.stringify(old):null,JSON.stringify(row));return row;
 })();
}
