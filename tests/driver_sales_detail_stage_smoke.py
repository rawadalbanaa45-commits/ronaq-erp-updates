from pathlib import Path
root=Path(__file__).parents[1]
schema=(root/'src/main/database/schema.ts').read_text(encoding='utf-8')
service=(root/'src/main/services/drivers.ts').read_text(encoding='utf-8')
ui=(root/'src/renderer/ui/DriversPanel.tsx').read_text(encoding='utf-8')
reports=(root/'src/main/services/reports.ts').read_text(encoding='utf-8')
types=(root/'src/shared/types.d.ts').read_text(encoding='utf-8')
assert 'CREATE TABLE IF NOT EXISTS driver_sheet_sales' in schema
assert 'customer_name TEXT NOT NULL' in schema and "payment_type TEXT NOT NULL CHECK(payment_type IN ('cash','credit'))" in schema
assert 'salesLines?: Array<' in service and 'مجاميع المبيعات النقدية والآجلة لا تطابق' in service
assert 'INSERT INTO driver_sheet_sales' in service and 'sales_lines:' in service
assert 'اسم المحل / الزبون' in ui and 'رقم الوصل' in ui and 'عرض التفاصيل' in ui
assert 'driver_sheet_sales' in reports and 'driverUndetailedSales' in reports
assert 'salesLines?:Array<' in types
print('driver daily sheet itemized customer/product sales, receipts, payment types and report costing: OK')
