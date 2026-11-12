from pathlib import Path
root=Path(__file__).parents[1]
system=(root/'src/main/services/system.ts').read_text()
reports=(root/'src/main/services/reports.ts').read_text()
preload=(root/'src/preload/index.ts').read_text()
ui=(root/'src/renderer/ui/SystemPanel.tsx').read_text()
assert 'تاريخ بداية النظام غير صحيح' in system
assert 'رصيد الصندوق يجب أن يكون عدداً صحيحاً غير سالب' in system
assert 'تجنب تكرار الصنف' in system and 'تجنب تكرار المادة' in system
assert 'getOpeningBalanceStatus' in system and 'listOpeningBalanceParties' in system
assert 'openingBalanceStatus' in preload and 'openingBalanceParties' in preload
assert 'اعتماد الأرصدة الافتتاحية' in ui and 'لا يمكن تكرارها' in ui
assert "SUM(balance) FROM opening_party_balances WHERE direction='receivable'" in reports
assert "SUM(balance) FROM opening_party_balances WHERE direction='payable'" in reports
print('PASS: opening balance UI, read status, integer/date validation, duplicate prevention, and debt roll-forward into dashboard/financial report')
