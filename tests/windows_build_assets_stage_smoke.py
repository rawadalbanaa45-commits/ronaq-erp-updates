from pathlib import Path
import json
root=Path(__file__).parents[1]
pkg=json.loads((root/'package.json').read_text(encoding='utf-8'))
assert pkg['build']['win']['icon']=='public/ronaQ-icon.ico'
assert pkg['build']['nsis']['createDesktopShortcut'] is True
assert pkg['build']['nsis']['createStartMenuShortcut'] is True
assert (root/'public/ronaQ-icon.ico').exists()
bat=(root/'build-windows.bat').read_text(encoding='utf-8')
for token in ['npm install','npm run typecheck','npm run dist:win']:
 assert token in bat
print('Windows installer build script, factory icon and shortcuts are configured: OK')
