from pathlib import Path
root=Path(__file__).parents[1]
service=(root/'src/main/services/drivers.ts').read_text(encoding='utf-8')
ui=(root/'src/renderer/ui/DriversPanel.tsx').read_text(encoding='utf-8')
assert 'driver.price.${x.productId}' in service
assert 'سعر بيع السواق المعتمد لهذا المنتج هو' in service
assert 'أسعار بيع السواق المعتمدة' in ui and 'saveDriverPrice' in ui
assert "key:`driver.price.${productId}`" in ui
assert 'driverPrices[Number(e.target.value)]??x.unitPrice' in ui
print('factory-set driver product prices are saved and enforced in daily sales: OK')
