"""Smoke test for invoice detail query used by the printable A5 invoice."""
from pathlib import Path
import sqlite3
root = Path(__file__).resolve().parents[1]
schema_source = (root / 'src/main/database/schema.ts').read_text(encoding='utf-8')
sql = schema_source[schema_source.index('`') + 1:schema_source.rindex('`')]
db = sqlite3.connect(':memory:')
db.execute('PRAGMA foreign_keys=ON')
db.executescript(sql)
db.execute("INSERT INTO products(code,name,unit) VALUES('P1','جلكان 16 لتر','حبة')")
db.execute("INSERT INTO stock_movements(product_id,movement_type,quantity) VALUES(1,'opening',10)")
db.execute("INSERT INTO parties(party_type,name,phone) VALUES('customer','زبون تجريبي','07700000000')")
party_id = db.execute('SELECT id FROM parties').fetchone()[0]
invoice_id = db.execute("INSERT INTO sales_invoices(invoice_no,invoice_date,party_id,sale_kind,status,total_amount,paid_amount,notes) VALUES('SI-TEST','2026-11-07',?,'named_customer','posted',10000,4000,'تجربة طباعة')", (party_id,)).lastrowid
db.execute('INSERT INTO sales_lines(invoice_id,product_id,quantity,unit_price,line_total) VALUES(?,1,2,5000,10000)', (invoice_id,))
db.execute("INSERT INTO sales_payments(invoice_id,payment_date,amount,payment_method) VALUES(?,'2026-11-07',4000,'cash')", (invoice_id,))
invoice = db.execute("""SELECT i.invoice_no,i.invoice_date,i.total_amount,i.paid_amount,i.total_amount-i.paid_amount AS remaining_amount,COALESCE(p.name,'زبون نقدي') AS party_name,p.phone AS party_phone FROM sales_invoices i LEFT JOIN parties p ON p.id=i.party_id WHERE i.id=?""", (invoice_id,)).fetchone()
lines = db.execute("SELECT l.quantity,l.unit_price,l.line_total,p.name,p.unit FROM sales_lines l JOIN products p ON p.id=l.product_id WHERE l.invoice_id=?", (invoice_id,)).fetchall()
payments = db.execute('SELECT amount,payment_method FROM sales_payments WHERE invoice_id=?', (invoice_id,)).fetchall()
assert invoice[0]=='SI-TEST' and invoice[4]==6000 and invoice[5]=='زبون تجريبي', invoice
assert lines==[(2,5000,10000,'جلكان 16 لتر','حبة')], lines
assert payments==[(4000,'cash')], payments
ui = (root/'src/renderer/ui/SalesPanel.tsx').read_text(encoding='utf-8')
css = (root/'src/renderer/ui/styles.css').read_text(encoding='utf-8')
assert 'window.print()' in ui and 'invoice-print' in ui and '@page{size:A5 portrait' in css
assert 'fonts.googleapis.com' not in css, 'offline UI must not fetch fonts from the internet'
print('PASS: invoice detail data, line items, payment history, A5 print layout, and offline font loading')
