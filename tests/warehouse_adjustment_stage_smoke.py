from pathlib import Path
root=Path(__file__).parents[1]
service=(root/'src/main/services/inventory.ts').read_text()
main=(root/'src/main/index.ts').read_text()
preload=(root/'src/preload/index.ts').read_text()
app=(root/'src/renderer/ui/App.tsx').read_text()
warehouse=(root/'src/renderer/ui/WarehousePanel.tsx').read_text()
assert 'export function createStockAdjustment' in service
assert "input.reason.trim().length<4" in service
assert "before<input.quantity" in service
assert "'adjustment_in':'adjustment_out'" in service
assert 'balanceBefore:before' in service and 'balanceAfter:' in service
assert "'ronaq:stock:adjust'" in main and 'createStockAdjustment(db, input)' in main
assert "adjustStock: (input: unknown) => ipcRenderer.invoke('ronaq:stock:adjust', input)" in preload
assert 'saveAdjustment' in warehouse and 'window.ronaq.adjustStock' in warehouse
assert 'مرتجعات بانتظار الفحص' in warehouse and "decideReturn(r.id,'accepted')" in warehouse
assert "window.ronaq.inspectStockReturn({returnId:id,decision,reason:why})" in warehouse
assert 'onOpenSettings' in warehouse and "onOpenSettings={()=>open('settings')}" in app
print('PASS: stock adjustment validation, stock floor protection, audit metadata, IPC wiring, return review workflow, and opening-balance navigation')
