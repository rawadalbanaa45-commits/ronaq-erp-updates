from pathlib import Path
root=Path(__file__).resolve().parents[1]
service=(root/'src/main/services/customers.ts').read_text()
ui=(root/'src/renderer/ui/CustomersPanel.tsx').read_text()
assert 'i.created_at' in service and 'sp.created_at' in service
assert 'getLines=db.prepare' in service
assert 'lines:getLines.all(invoice.id)' in service
assert 'عرض المواد' in ui
assert 'expandedInvoice' in ui
assert 'line.product_name' in ui
assert 'line.quantity' in ui and 'line.unit_price' in ui and 'line.line_total' in ui
print('customer debt invoice detail smoke: OK')
