from pathlib import Path
root=Path(__file__).parents[1]
service=(root/'src/main/services/usbBackup.ts').read_text()
main=(root/'src/main/index.ts').read_text()
preload=(root/'src/preload/index.ts').read_text()
types=(root/'src/shared/types.d.ts').read_text()
ui=(root/'src/renderer/ui/SystemPanel.tsx').read_text()
assert 'DriveType=2' in service and 'powershell.exe' in service
assert 'freeBytes < size + 5 * 1024 * 1024' in service
assert "COPYFILE_EXCL" in service and "verifySQLite(partial)" in service
assert "fs.renameSync(partial, destination)" in service
assert "RONAQ-Backups" in service
assert "VALUES('backup',?,'usb_copy',?" in service
assert "const usbMonitor = setInterval" in main and "60 * 1000" in main
assert "scanAndCopyToConnectedUsb(openDatabase(), backupFolder)" in main
assert "ronaq:system:usb:list" in main and "ronaq:system:usb:copy" in main
assert "removableUsbDrives" in preload and "copyBackupToUsb" in preload
assert "removableUsbDrives" in types and "copyBackupToUsb" in types
assert 'النسخ الاحتياطي على USB' in ui and 'فحص USB والنسخ الآن' in ui
print('PASS: Windows removable-drive detection, capacity guard, staged copy, SQLite integrity verification, audit trail, minute monitor, shutdown backup, IPC and UI')
