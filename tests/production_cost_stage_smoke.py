from pathlib import Path
root = Path(__file__).parents[1]
finance = (root / 'src/main/services/finance.ts').read_text(encoding='utf-8')
main = (root / 'src/main/index.ts').read_text(encoding='utf-8')
preload = (root / 'src/preload/index.ts').read_text(encoding='utf-8')
types = (root / 'src/shared/types.d.ts').read_text(encoding='utf-8')
ui = (root / 'src/renderer/ui/FinancePanel.tsx').read_text(encoding='utf-8')
app = (root / 'src/renderer/ui/App.tsx').read_text(encoding='utf-8')
reports = (root / 'src/main/services/reports.ts').read_text(encoding='utf-8')
assert 'export function createProductionCost' in finance
assert 'Number.isSafeInteger(input.quantity)' in finance and 'Number.isSafeInteger(input.totalCost)' in finance
assert "INSERT INTO production_costs" in finance and "'production_cost'" in finance
assert "ronaq:finance:production-costs:create" in main and "ronaq:finance:production-costs:list" in main
assert 'createProductionCost:' in preload and 'productionCosts:' in preload
assert 'createProductionCost:' in types and 'productionCosts:' in types
assert "section==='production-costs'" in ui and 'window.ronaq.createProductionCost' in ui
assert "id:'production-costs'" in app and "section=\"production-costs\"" in app
assert 'costingComplete' in reports and 'costingMissingProducts' in reports
assert 'netProfit:net' in reports
print('production cost workflow and report costing guard: OK')
