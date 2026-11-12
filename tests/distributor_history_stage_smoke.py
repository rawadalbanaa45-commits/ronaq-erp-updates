from pathlib import Path
root=Path(__file__).parents[1]
service=(root/'src/main/services/distributors.ts').read_text(encoding='utf-8')
ui=(root/'src/renderer/ui/DistributorsPanel.tsx').read_text(encoding='utf-8')
assert 'pickups:db.prepare' in service and 'payments:db.prepare' in service and 'refunds:db.prepare' in service
for phrase in ['سجل الدفعات','سجل الاستلامات','سجل الاسترجاعات']:
 assert phrase in ui
assert 'driverId:pickupDriverId?Number(pickupDriverId):undefined' in ui
assert 'drivers.map((d:any)' in ui
print('distributor agreement payment, pickup, refund history and saved-driver selection: OK')
