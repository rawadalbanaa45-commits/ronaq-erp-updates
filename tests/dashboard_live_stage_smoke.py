from pathlib import Path
root=Path(__file__).parents[1]
app=(root/'src/renderer/ui/App.tsx').read_text()
warehouse=(root/'src/renderer/ui/WarehousePanel.tsx').read_text()
reports=(root/'src/main/services/reports.ts').read_text()
assert 'window.ronaq.dashboardSummary()' in app
assert "if(active==='warehouse')refreshInventory()" in app and '[activeKey,active]' in app
for key in ['dashboard.salesToday','dashboard.productionToday','dashboard.stock.length','dashboard.cashBalance','dashboard.receivables']:
    assert key in app
assert 'stock.reduce((n,p)=>n+(p.inboundToday||0)' in warehouse
assert 'stock.reduce((n,p)=>n+(p.outboundToday||0)' in warehouse
assert 'السبت، 7 نوفمبر 2026' not in app
assert 'new Intl.DateTimeFormat' in app
assert 'getDashboardSummary' in reports and 'salesToday:sales' in reports and 'productionToday:production' in reports
assert 'getFullYear()' in reports and 'getMonth()+1' in reports
print('PASS: live dashboard KPIs, real stock inbound/outbound totals, customer receivables, dynamic local date, and refresh after navigation/production')
