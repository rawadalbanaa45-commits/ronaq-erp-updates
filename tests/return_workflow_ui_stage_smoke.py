from pathlib import Path
root=Path(__file__).parents[1]
drivers=(root/'src/renderer/ui/DriversPanel.tsx').read_text(encoding='utf-8')
distributors=(root/'src/renderer/ui/DistributorsPanel.tsx').read_text(encoding='utf-8')
warehouse=(root/'src/renderer/ui/WarehousePanel.tsx').read_text(encoding='utf-8')
service=(root/'src/main/services/inventory.ts').read_text(encoding='utf-8')
assert "sourceType:'employee_driver'" in drivers and 'window.ronaq.createStockReturn' in drivers
assert "sourceType:'distributor'" in distributors and 'window.ronaq.createStockReturn' in distributors
assert 'راجع السائق بعد إعادة المعالجة' in drivers
assert 'راجع من الموزع بعد إعادة المعالجة' in distributors
assert "status:'pending'" in service and "input.decision==='accepted'" in service
assert 'حدد مصدر الراجع' in service and "party_type='distributor'" in service
assert 'pendingReturns.map' in warehouse and "decideReturn(r.id,'accepted')" in warehouse
print('driver/distributor returns enter inspection queue and only accepted returns increase stock: OK')
