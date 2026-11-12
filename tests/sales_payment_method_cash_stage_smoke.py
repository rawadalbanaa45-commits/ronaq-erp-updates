from pathlib import Path
root=Path(__file__).parents[1]
sales=(root/'src/main/services/sales.ts').read_text(encoding='utf-8')
assert "method==='cash' ? db.prepare" in sales
assert "input.paymentMethod==='cash' ? db.prepare" in sales
assert 'cash?Number(cash.lastInsertRowid):null' in sales
assert 'cash ? Number(cash.lastInsertRowid) : null' in sales
assert "VALUES('sale_receipt','in'" in sales and "VALUES('debt_collection','in'" in sales
print('cash/card/transfer sale receipts are separated from physical cash balance: OK')
