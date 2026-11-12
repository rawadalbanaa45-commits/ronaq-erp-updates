from pathlib import Path
import sqlite3
import re
root=Path(__file__).parents[1]
schema_src=(root/'src/main/database/schema.ts').read_text(encoding='utf-8')
sql=schema_src[schema_src.index('`')+1:schema_src.rindex('`')]
db=sqlite3.connect(':memory:');db.execute('PRAGMA foreign_keys=ON');db.executescript(sql)
for code,name,unit in [('JUG16','جلكان 16 لتر','حبة'),('C40','كارتون 40','كارتون')]:db.execute('INSERT INTO products(code,name,unit) VALUES(?,?,?)',(code,name,unit))
driver=db.execute("INSERT INTO parties(party_type,name) VALUES('driver','سائق تجريبي')").lastrowid
sheet=db.execute("INSERT INTO driver_daily_sheets(driver_id,sheet_date,cash_sales,credit_sales,old_debt_collected,expenses,cash_delivered) VALUES(?,'2026-11-07',80000,25000,15000,5000,90000)",(driver,)).lastrowid
db.execute("INSERT INTO cash_movements(movement_type,direction,amount,party_id,reference_type,reference_id,notes) VALUES('driver_collection','in',?,?,'driver_daily_sheet',?,'تسليم نقدي')",(90000,driver,sheet))
assert db.execute("SELECT SUM(CASE WHEN direction='in' THEN amount ELSE -amount END) FROM cash_movements").fetchone()[0]==90000
# A correction is posted as a new delta, never by editing/deleting the old movement.
db.execute("UPDATE driver_daily_sheets SET cash_delivered=95000 WHERE id=?",(sheet,))
db.execute("INSERT INTO cash_movements(movement_type,direction,amount,party_id,reference_type,reference_id,notes) VALUES('driver_collection','in',5000,?,'driver_daily_sheet',?,'فرق تصحيح')",(driver,sheet))
assert db.execute("SELECT SUM(CASE WHEN direction='in' THEN amount ELSE -amount END) FROM cash_movements").fetchone()[0]==95000
# Production costing uses the accountant's entered total and quantity.
db.execute("INSERT INTO production_costs(product_id,production_date,quantity,total_cost,unit_cost) VALUES(1,'2026-11-07',100,250000,2500)")
avg=db.execute('SELECT SUM(total_cost)*1.0/SUM(quantity) FROM production_costs WHERE product_id=1 AND production_date<=?',('2026-11-07',)).fetchone()[0]
assert avg==2500,avg
# Daily driver sales and outstanding driver credit remain separately measurable.
driver_sales=db.execute('SELECT SUM(cash_sales+credit_sales) FROM driver_daily_sheets WHERE sheet_date BETWEEN ? AND ?',('2026-11-01','2026-11-30')).fetchone()[0]
driver_debt=db.execute('SELECT SUM(credit_sales-old_debt_collected) FROM driver_daily_sheets').fetchone()[0]
assert driver_sales==105000 and driver_debt==10000,(driver_sales,driver_debt)
db.execute("INSERT INTO driver_sheet_sales(sheet_id,customer_name,product_id,quantity,unit_price,line_total,payment_type,receipt_no) VALUES(?,?,?,?,?,?,?,?)",(sheet,'محل تجريبي',1,10,8000,80000,'cash','R-1'))
db.execute("INSERT INTO driver_sheet_sales(sheet_id,customer_name,product_id,quantity,unit_price,line_total,payment_type,receipt_no) VALUES(?,?,?,?,?,?,?,?)",(sheet,'زبون آجل',1,5,5000,25000,'credit','R-2'))
itemized=db.execute("SELECT SUM(CASE WHEN payment_type='cash' THEN line_total ELSE 0 END),SUM(CASE WHEN payment_type='credit' THEN line_total ELSE 0 END) FROM driver_sheet_sales WHERE sheet_id=?",(sheet,)).fetchone()
assert itemized==(80000,25000),itemized
print('driver cash ledger corrections, production unit cost, driver sales and driver receivables SQL: OK')
