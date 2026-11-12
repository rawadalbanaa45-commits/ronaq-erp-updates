from pathlib import Path
import json
root=Path(__file__).resolve().parents[1]
pkg=json.loads((root/'package.json').read_text())
assert pkg['version']=='0.22.1'
assert 'electron-updater' in pkg['dependencies']
assert pkg['build']['publish'][0]['provider']=='generic'
main=(root/'src/main/index.ts').read_text()
preload=(root/'src/preload/index.ts').read_text()
ui=(root/'src/renderer/ui/SystemPanel.tsx').read_text()
types=(root/'src/shared/types.d.ts').read_text()
for token in ["ronaq:app:restart", "ronaq:updates:configure", "ronaq:updates:check", "ronaq:updates:download", "ronaq:updates:install", "autoUpdater.on('update-downloaded'", "updates.feedUrl", "12 * 60 * 60 * 1000"]:
    assert token in main or token in ui, token
for token in ['restartApp:', 'configureUpdates:', 'checkUpdates:', 'downloadUpdate:', 'installUpdate:', 'onUpdateStatus:']:
    assert token in preload, token
for token in ['restartApp:', 'configureUpdates:', 'checkUpdates:', 'downloadUpdate:', 'installUpdate:', 'onUpdateStatus:']:
    assert token in types, token
for token in ['إعادة تشغيل التطبيق', 'رابط خادم التحديثات', 'فحص وجود تحديث', 'تنزيل التحديث', 'تثبيت التحديث وإعادة التشغيل']:
    assert token in ui, token
assert 'safe.verified' in ui
print('app update/restart static smoke: PASS')
