from pathlib import Path
root = Path(__file__).resolve().parents[1]
app = (root / 'src/renderer/ui/App.tsx').read_text()
assert "Array<{key:number;moduleId:string}>" in app
assert 'activeKey' in app and 'nextTabKey' in app
assert "key={tab.key}" in app
assert 'close(tab.key)' in app
assert "const active=tabs.find(t=>t.key===activeKey)?.moduleId||'dashboard'" in app
assert "setActive(" not in app
assert "RONAQ ERP · الإصدار 0.20.0" in app
print('tab identity stage smoke: OK')
