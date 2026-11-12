from pathlib import Path
root=Path(__file__).parents[1]
panel=(root/'src/renderer/ui/ReportsPanel.tsx').read_text()
css=(root/'src/renderer/ui/styles.css').read_text()
assert 'window.print()' in panel and 'طباعة / حفظ PDF' in panel
assert 'ronaQ-logo.jpg' in panel and 'من {fromDate} إلى {toDate}' in panel
for label in ['تفصيل الإيرادات','تكلفة الإنتاج والمبيعات حسب المنتج','المصاريف وحركة الصندوق','الكمية المنتجة']:
    assert label in panel
assert 'report-print' in css and '@page report{size:A4 portrait' in css
assert '@page invoice{size:A5 portrait' in css
assert '.report-controls{display:none!important}' in css
print('PASS: Arabic management report, date range, factory logo, revenue/cost/expense/cash sections, browser Save-as-PDF and A4 print layout; invoice A5 print retained')
