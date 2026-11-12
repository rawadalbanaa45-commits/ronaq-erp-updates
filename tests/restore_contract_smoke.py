from pathlib import Path
root = Path(__file__).parents[1]
system = (root / 'src/main/services/system.ts').read_text()
main = (root / 'src/main/index.ts').read_text()
preload = (root / 'src/preload/index.ts').read_text()
panel = (root / 'src/renderer/ui/SystemPanel.tsx').read_text()
checks = {
    'restore accepts only successful registered backups': "row.status !== 'success'" in system,
    'restore restricts file to backup folder': 'source.startsWith(root)' in system,
    'integrity and foreign-key verification before restore': "pragma('integrity_check'" in system and "pragma('foreign_key_check')" in system,
    'safety backup before replacing database': 'safety = await createDatabaseBackup(db, backupRoot)' in system,
    'restore stages and rechecks the database': 'restore-ready' in system and 'stagedDb.pragma' in system,
    'app restarts after restore': 'app.relaunch(); app.exit(0);' in main,
    'renderer exposes restore action': 'restoreBackup:' in preload and 'window.ronaq.restoreBackup(id)' in panel,
    'periodic six-hour backups': '6 * 60 * 60 * 1000' in main,
    'backup on application quit': "app.on('before-quit'" in main and 'createDatabaseBackup(openDatabase()' in main,
}
for label, ok in checks.items():
    print(('PASS' if ok else 'FAIL') + ': ' + label)
assert all(checks.values())
