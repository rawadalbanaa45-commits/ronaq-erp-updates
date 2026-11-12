from pathlib import Path
root=Path(__file__).parents[1]
drivers=(root/'src/main/services/drivers.ts').read_text(encoding='utf-8')
reports=(root/'src/main/services/reports.ts').read_text(encoding='utf-8')
ui=(root/'src/renderer/ui/DriversPanel.tsx').read_text(encoding='utf-8')
report_ui=(root/'src/renderer/ui/ReportsPanel.tsx').read_text(encoding='utf-8')
assert "VALUES('driver_collection','in'" in drivers
assert "reference_type,reference_id" in drivers and "'driver_daily_sheet'" in drivers
assert 'cashDelta = input.cashDelivered - Number(existing.cash_delivered || 0)' in drivers
assert "VALUES('other_payment','out'" in drivers
assert 'cashDelivered:Number(delivered||0)' in ui
assert 'driverSales' in reports and 'driver_daily_sheets' in reports
assert 'مبيعات السواق الموظفين' in report_ui
print('driver cash delivery ledger and sales summary integration: OK')
