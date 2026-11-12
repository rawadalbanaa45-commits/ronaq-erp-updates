from pathlib import Path
root=Path(__file__).parents[1]
files=['src/main/services/inventory.ts','src/main/services/drivers.ts','src/main/services/distributors.ts','src/main/services/finance.ts','src/renderer/ui/DriversPanel.tsx','src/renderer/ui/DistributorsPanel.tsx','src/renderer/ui/CashPanel.tsx','src/renderer/ui/ReportsPanel.tsx','src/renderer/ui/SystemPanel.tsx','src/renderer/ui/FinancePanel.tsx']
for f in files:
 s=(root/f).read_text(encoding='utf-8')
 assert 'toISOString().slice(0,10)' not in s, f
print('local machine date is used for business-day defaults across modules: OK')
