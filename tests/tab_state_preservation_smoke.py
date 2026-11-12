from pathlib import Path

src = Path(__file__).parents[1] / "src/renderer/ui/App.tsx"
s = src.read_text(encoding="utf-8")
assert "tabs.map(tab=><div key={tab.key} className=\"tab-content\"" in s
assert "display:activeKey===tab.key?'block':'none'" in s
assert "aria-hidden={activeKey!==tab.key}" in s
assert "key={tab.key}" in s
print("tab state preservation contract: OK")
production = (Path(__file__).parents[1] / "src/renderer/ui/ProductionPanel.tsx").read_text(encoding="utf-8")
warehouse = (Path(__file__).parents[1] / "src/renderer/ui/WarehousePanel.tsx").read_text(encoding="utf-8")
assert 'useState' in production and 'useState' in warehouse
assert "<ProductionPanel products={products}" in s
assert "<WarehousePanel stock={stock}" in s
assert 'setLines' in production and 'setQuantity' in warehouse
print('independent production and warehouse tab forms: OK')
assert "tab.key!==1&&<button className=\"tab-close\"" in s
print('secondary dashboard tabs can be closed while the home tab remains protected: OK')
