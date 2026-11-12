from pathlib import Path
root=Path(__file__).parents[1]
ui=(root/'src/renderer/ui/FinancePanel.tsx').read_text(encoding='utf-8')
service=(root/'src/main/services/finance.ts').read_text(encoding='utf-8')
preload=(root/'src/preload/index.ts').read_text(encoding='utf-8')
types=(root/'src/shared/types.d.ts').read_text(encoding='utf-8')
assert 'addSupplierPayment' in ui and 'تسديد مستحقات مجهز' in ui
assert 'supplierPurchaseId' in ui and 'supplierPayMethod' in ui
assert "purchaseId:supplierPurchaseId?Number(supplierPurchaseId):undefined" in ui
assert 'export function addSupplierPayment' in service
assert 'h.paid_amount+input.amount>h.total_amount' in service
assert 'addSupplierPayment:' in preload and 'addSupplierPayment:' in types
print('supplier payment workflow is available in the purchases UI: OK')
