from pathlib import Path
p=Path(__file__).resolve().parents[1]/'src/renderer/ui/ReportsPanel.tsx'
s=p.read_text(encoding='utf-8')
checks=['ملخص المدير','تفاصيل المحاسب','إجمالي المبيعات','المصاريف','الرواتب المدفوعة','صافي الربح التقديري','المبالغ المقبوضة فعلياً','المبالغ المصروفة فعلياً','رصيد الصندوق حالياً','ديون الزبائن والسواق','هذا الأسبوع','هذا الشهر','لم تسجل التكلفة','window.print()']
missing=[x for x in checks if x not in s]
assert not missing, f'missing manager report features: {missing}'
css=(Path(__file__).resolve().parents[1]/'src/renderer/ui/styles.css').read_text(encoding='utf-8')
assert '.manager-report-grid' in css and '@media print' in css
print('manager report UI smoke: OK')
