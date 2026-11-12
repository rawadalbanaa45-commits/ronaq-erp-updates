from pathlib import Path
root=Path(__file__).parents[1]
app=(root/'src/renderer/ui/App.tsx').read_text(encoding='utf-8')
css=(root/'src/renderer/ui/styles.css').read_text(encoding='utf-8')
assert "key==='ui.theme'" in app and 'window.ronaq.settings()' in app
assert "window.ronaq.setSetting({key:'ui.theme',value:next})" in app
assert "document.documentElement.dataset.theme=theme" in app
assert 'data-theme="dark"' in css and 'color-scheme:dark' in css
print('light/dark theme toggle persists in local application settings: OK')
