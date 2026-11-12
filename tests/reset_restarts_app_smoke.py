from pathlib import Path
p = Path(__file__).parents[1] / 'src/renderer/ui/SystemPanel.tsx'
s = p.read_text()
assert "await window.ronaq.resetAllBusinessData();" in s
assert "await window.ronaq.restartApp();" in s
assert "await refresh();" not in s[s.index('const resetAll='):s.index('const syncUsb=')]
print('PASS: reset triggers a full app restart so dashboard and cached screens reload from the cleared database')
