from pathlib import Path
import sqlite3
root=Path(__file__).resolve().parents[1]
schema=(root/'src/main/database/schema.ts').read_text().split('`',2)[1]
db=sqlite3.connect(':memory:')
db.executescript(schema)
db.execute("INSERT INTO workers(name,job_title) VALUES('عامل اختبار','إنتاج')")
db.execute("INSERT INTO worker_attendance(worker_id,work_date,status,check_in,check_out) VALUES(1,'2026-11-09','present','08:00','16:00')")
assert db.execute('SELECT check_in,check_out FROM worker_attendance').fetchone()==('08:00','16:00')
try:
 db.execute("INSERT INTO worker_attendance(worker_id,work_date,status) VALUES(1,'2026-11-09','absent')")
 raise AssertionError('duplicate attendance allowed')
except sqlite3.IntegrityError:pass
for file,token in [('src/main/services/attendance.ts','recordAttendance'),('src/renderer/ui/AttendancePanel.tsx','الأسبوع التالي'),('src/renderer/ui/App.tsx','AttendancePanel'),('src/main/index.ts','ronaq:attendance:record')]:
 assert token in (root/file).read_text(),file
print('PASS: weekly attendance schema, duplicate guard, UI and IPC contracts')
