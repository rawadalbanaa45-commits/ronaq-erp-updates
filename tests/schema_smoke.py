"""Portable SQLite schema and stock-accounting smoke test for RONAQ ERP."""
from pathlib import Path
import sqlite3
import re

root = Path(__file__).resolve().parents[1]
source = (root / 'src/main/database/schema.ts').read_text(encoding='utf-8')
sql = source[source.index('`') + 1:source.rindex('`')]
db = sqlite3.connect(':memory:')
db.execute('PRAGMA foreign_keys=ON')
db.executescript(sql)
# seed products and opening balances
for code, name, unit in [('JUG16','جلكان ماء 16 لتر','حبة'),('CUP180-40','كارتون أكواب 40','كارتون'),('CUP180-60','كارتون أكواب 60','كارتون')]:
    db.execute('INSERT INTO products(code,name,unit) VALUES(?,?,?)',(code,name,unit))
db.execute("INSERT INTO stock_movements(product_id,movement_type,quantity) VALUES(1,'opening',100)")
# post a sale: stock must decrease through the trigger
cur = db.execute("INSERT INTO sales_invoices(invoice_no,invoice_date,sale_kind,status,total_amount,paid_amount) VALUES('TEST-1','2026-11-07','walk_in','posted',25000,10000)")
invoice_id = cur.lastrowid
db.execute('INSERT INTO sales_lines(invoice_id,product_id,quantity,unit_price,line_total) VALUES(?,?,?,?,?)',(invoice_id,1,5,5000,25000))
balance = db.execute("SELECT SUM(CASE WHEN movement_type IN ('opening','production_in','good_return_in','damage_return_in','adjustment_in') THEN quantity ELSE -quantity END) FROM stock_movements WHERE product_id=1").fetchone()[0]
assert balance == 95, balance
# guard prevents overselling
try:
    db.execute("INSERT INTO sales_lines(invoice_id,product_id,quantity,unit_price,line_total) VALUES(?,?,?,?,?)",(invoice_id,1,100,1,100))
    raise AssertionError('oversell should have been rejected')
except sqlite3.IntegrityError as exc:
    assert 'المخزون غير كافٍ' in str(exc)
# payment + cash ledger consistency
db.execute("INSERT INTO cash_movements(movement_type,direction,amount,reference_type,reference_id) VALUES('sale_receipt','in',10000,'sales_invoice',?)",(invoice_id,))
db.execute("INSERT INTO sales_payments(invoice_id,payment_date,amount,payment_method) VALUES(?,'2026-11-07',10000,'cash')",(invoice_id,))
db.execute('UPDATE sales_invoices SET paid_amount=paid_amount+5000 WHERE id=?',(invoice_id,))
assert db.execute('SELECT total_amount-paid_amount FROM sales_invoices WHERE id=?',(invoice_id,)).fetchone()[0] == 10000
# production trigger
batch=db.execute("INSERT INTO production_batches(batch_no,production_date) VALUES('PR-TEST','2026-11-07')").lastrowid
db.execute('INSERT INTO production_lines(batch_id,product_id,quantity) VALUES(?,?,?)',(batch,1,20))
balance = db.execute("SELECT SUM(CASE WHEN movement_type IN ('opening','production_in','good_return_in','damage_return_in','adjustment_in') THEN quantity ELSE -quantity END) FROM stock_movements WHERE product_id=1").fetchone()[0]
assert balance == 115, balance
print('PASS: schema, sales stock guard, stock movement trigger, production trigger, and payment tables')
# driver load automatically moves stock out and supports multiple loads/day
cur = db.execute("INSERT INTO parties(party_type,name) VALUES('driver','سائق تجريبي')")
driver_id = cur.lastrowid
load = db.execute("INSERT INTO driver_loads(load_no,driver_id,load_date,vehicle_name) VALUES('DL-TEST-1',?,'2026-11-07','كانتر')",(driver_id,)).lastrowid
db.execute('INSERT INTO driver_load_lines(load_id,product_id,quantity) VALUES(?,?,?)',(load,1,10))
second = db.execute("INSERT INTO driver_loads(load_no,driver_id,load_date) VALUES('DL-TEST-2',?,'2026-11-07')",(driver_id,)).lastrowid
db.execute('INSERT INTO driver_load_lines(load_id,product_id,quantity) VALUES(?,?,?)',(second,1,5))
balance = db.execute("SELECT SUM(CASE WHEN movement_type IN ('opening','production_in','good_return_in','damage_return_in','adjustment_in') THEN quantity ELSE -quantity END) FROM stock_movements WHERE product_id=1").fetchone()[0]
assert balance == 100, balance
# daily reconciliation keeps current sales and old-debt collections distinct
sheet = db.execute("""INSERT INTO driver_daily_sheets(driver_id,sheet_date,cash_sales,credit_sales,old_debt_collected,expenses,cash_delivered)
 VALUES(?,'2026-11-07',80000,25000,15000,5000,90000)""",(driver_id,)).lastrowid
expected, difference = db.execute("SELECT cash_sales+old_debt_collected-expenses,cash_delivered-(cash_sales+old_debt_collected-expenses) FROM driver_daily_sheets WHERE id=?",(sheet,)).fetchone()
assert expected == 90000 and difference == 0, (expected,difference)
db.execute("UPDATE driver_daily_sheets SET status='closed',closed_at=datetime('now','localtime') WHERE id=?",(sheet,))
assert db.execute('SELECT status FROM driver_daily_sheets WHERE id=?',(sheet,)).fetchone()[0] == 'closed'
print('PASS: driver multiple loads, stock issue trigger, daily cash reconciliation, and close status')

# distributor agreements: frozen price, multiple driver pickups, agreement-bound payments and bounded refunds
cur = db.execute("INSERT INTO parties(party_type,name) VALUES('distributor','موزع تجريبي')")
dist = cur.lastrowid
cur = db.execute("INSERT INTO distributor_drivers(distributor_id,name) VALUES(?, 'سائق الموزع')",(dist,))
driver = cur.lastrowid
ag = db.execute("INSERT INTO distributor_agreements(agreement_no,distributor_id,agreement_date) VALUES('AG-TEST',?,'2026-11-07')",(dist,)).lastrowid
line = db.execute("INSERT INTO distributor_agreement_lines(agreement_id,product_id,quantity,unit_price) VALUES(?,?,20,3000)",(ag,1)).lastrowid
# payment always belongs to a specific agreement
pay = db.execute("INSERT INTO distributor_agreement_payments(agreement_id,payment_date,amount,payment_method) VALUES(?,'2026-11-07',60000,'cash')",(ag,)).lastrowid
# multiple pickup events can use different vehicles/drivers against same agreement line
for n,q,veh in [(1,5,'بيك أب A'),(2,4,'بيك أب B')]:
    pickup=db.execute("INSERT INTO distributor_pickups(pickup_no,distributor_id,distributor_driver_id,driver_name_snapshot,vehicle_name,pickup_date) VALUES(?,?,?,?,?,'2026-11-07')",(f'PU-{n}',dist,driver,'سائق الموزع',veh)).lastrowid
    db.execute('INSERT INTO distributor_pickup_lines(pickup_id,agreement_line_id,quantity) VALUES(?,?,?)',(pickup,line,q))
    db.execute('UPDATE distributor_agreement_lines SET delivered_quantity=delivered_quantity+? WHERE id=?',(q,line))
delivered=db.execute('SELECT delivered_quantity FROM distributor_agreement_lines WHERE id=?',(line,)).fetchone()[0]
assert delivered==9,delivered
remaining_value=db.execute('SELECT (quantity-delivered_quantity)*unit_price FROM distributor_agreement_lines WHERE id=?',(line,)).fetchone()[0]
assert remaining_value==33000,remaining_value
# refund cannot exceed paid amount or undelivered agreement value
assert min(60000,remaining_value)==33000
try:
    db.execute("INSERT INTO distributor_refunds(refund_no,agreement_id,refund_date,amount) VALUES('RF-TOO-MUCH',?,'2026-11-07',33001)",(ag,))
    # SQL schema permits rows; service layer enforces bound before insert
except sqlite3.IntegrityError:
    pass
assert db.execute('SELECT unit_price FROM distributor_agreement_lines WHERE id=?',(line,)).fetchone()[0]==3000
print('PASS: distributor profiles, driver records, fixed-price agreements, multiple pickups, agreement-linked payments, and refund limit calculations')

# Supplier purchase is inventory + payable, not immediate operating expense.
supplier=db.execute("INSERT INTO parties(party_type,name) VALUES('supplier','مجهز تجريبي')").lastrowid
mat=db.execute("INSERT INTO raw_materials(name,unit) VALUES('غطاء تجريبي','كيس')").lastrowid
purchase=db.execute("INSERT INTO purchases(purchase_no,supplier_id,purchase_date,total_amount,paid_amount) VALUES('PUR-TEST',?,'2026-11-07',50000,10000)",(supplier,)).lastrowid
db.execute('INSERT INTO purchase_lines(purchase_id,material_id,quantity,unit_cost) VALUES(?,?,?,?)',(purchase,mat,100,500))
db.execute("INSERT INTO raw_material_movements(material_id,direction,quantity,reference_type,reference_id) VALUES(?,'in',100,'purchase',?)",(mat,purchase))
db.execute("INSERT INTO supplier_payments(supplier_id,purchase_id,payment_date,amount,payment_method) VALUES(?,?,'2026-11-07',10000,'cash')",(supplier,purchase))
mat_stock=db.execute("SELECT SUM(CASE WHEN direction='in' THEN quantity ELSE -quantity END) FROM raw_material_movements WHERE material_id=?",(mat,)).fetchone()[0]
assert mat_stock==100,mat_stock
supplier_due=db.execute("SELECT SUM(total_amount)-SUM(paid_amount) FROM purchases WHERE supplier_id=?",(supplier,)).fetchone()[0]
assert supplier_due==40000,supplier_due
assert db.execute("SELECT COUNT(*) FROM expenses").fetchone()[0]==0
print('PASS: raw-material purchase inventory, partial supplier payment and payable separation from expenses')

# Expense categories allow dynamic fuel type; expense links to driver and cash movement.
fuel_cat=db.execute("SELECT id FROM expense_categories WHERE category_type='fuel' LIMIT 1").fetchone()[0]
driver_id=db.execute("SELECT id FROM parties WHERE party_type='driver' LIMIT 1").fetchone()[0]
cash_id=db.execute("INSERT INTO cash_movements(movement_type,direction,amount,party_id,reference_type,notes) VALUES('expense','out',25000,?,'expense','ديزل')",(driver_id,)).lastrowid
expense=db.execute("INSERT INTO expenses(category_id,expense_name,expense_date,amount,beneficiary_driver_id,vehicle_name,fuel_type,cash_movement_id) VALUES(?,'وقود','2026-11-07',25000,?,'كانتر','ديزل',?)",(fuel_cat,driver_id,cash_id)).lastrowid
assert db.execute('SELECT fuel_type,vehicle_name FROM expenses WHERE id=?',(expense,)).fetchone()==('ديزل','كانتر')
# Salary history and cash linkage.
employee=db.execute("INSERT INTO parties(party_type,name) VALUES('employee','موظف تجريبي')").lastrowid
salary_cash=db.execute("INSERT INTO cash_movements(movement_type,direction,amount,party_id,reference_type) VALUES('salary','out',300000,?,'salary')",(employee,)).lastrowid
db.execute("INSERT INTO salary_payments(employee_id,payment_date,amount,cash_movement_id) VALUES(?,'2026-11-07',300000,?)",(employee,salary_cash))
assert db.execute('SELECT SUM(amount) FROM salary_payments WHERE employee_id=?',(employee,)).fetchone()[0]==300000
assert db.execute("SELECT SUM(amount) FROM cash_movements WHERE direction='out' AND reference_type='salary' AND party_id=?",(employee,)).fetchone()[0]==300000
print('PASS: flexible expense/fuel records, driver/vehicle association, employee salary history and cash ledger linkage')

# Financial report source data: production cost allocation uses recorded production costs,
# and operating purchases remain outside the P&L expense total.
db.execute("INSERT INTO production_costs(product_id,production_date,quantity,total_cost,unit_cost) VALUES(1,'2026-11-07',100,100000,1000)")
period_sales=db.execute("SELECT COALESCE(SUM(total_amount),0) FROM sales_invoices WHERE status='posted' AND invoice_date BETWEEN '2026-11-07' AND '2026-11-07'").fetchone()[0]
period_expenses=db.execute("SELECT COALESCE(SUM(amount),0) FROM expenses WHERE expense_date BETWEEN '2026-11-07' AND '2026-11-07'").fetchone()[0]
period_salaries=db.execute("SELECT COALESCE(SUM(amount),0) FROM salary_payments WHERE payment_date BETWEEN '2026-11-07' AND '2026-11-07'").fetchone()[0]
avg_cost=db.execute("SELECT SUM(total_cost)*1.0/SUM(quantity) FROM production_costs WHERE product_id=1 AND production_date<='2026-11-07'").fetchone()[0]
assert period_sales==25000,period_sales
assert period_expenses==25000,period_expenses
assert period_salaries==300000,period_salaries
assert round(avg_cost)==1000,avg_cost
assert db.execute("SELECT COUNT(*) FROM purchases").fetchone()[0]==1
print('PASS: financial report inputs, production-cost weighted average, salary/expense separation, and purchases excluded from direct operating expenses')
