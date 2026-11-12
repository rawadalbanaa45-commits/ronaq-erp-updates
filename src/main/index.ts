import { app, BrowserWindow, ipcMain, Notification } from 'electron';
import { autoUpdater } from 'electron-updater';
import { addWorker, attendanceWeek, recordAttendance, workers } from './services/attendance';
import path from 'node:path';
import { closeDatabase, getDatabaseStatus, openDatabase } from './database';
import { createProductionBatch, getStockSummary, inspectStockReturn, issueStock, listPendingReturns, listProducts, listRecentMovements, createStockReturn, createStockAdjustment, createProduct, getStockReturnDetails } from './services/inventory';
import { collectInvoicePayment, createSalesInvoice, getSalesSummary, listSalesInvoices, listSaleParties, getSalesInvoiceDetails } from './services/sales';
import { addDistributorDriver, addDistributorPayment, createDistributor, createDistributorAgreement, createDistributorPickup, getDistributorAgreement, listDistributorAgreements, listDistributorDrivers, listDistributors, refundDistributorAgreement } from './services/distributors';
import { closeDriverDailySheet, createDriver, createDriverLoad, getDriverDailySheet, listDriverDailySheets, listDriverLoads, listDrivers, saveDriverDailySheet } from './services/drivers';
import { createCashVoucher, getDashboardSummary, getFinancialReport, listCashMovements } from './services/reports';
import { createDatabaseBackup, getSettings, listAuditLog, listBackupHistory, recordOpeningBalances, restoreDatabaseBackup, setSetting, getOpeningBalanceStatus, listOpeningBalanceParties, resetAllBusinessData } from './services/system';
import { listRemovableDrives, scanAndCopyToConnectedUsb } from './services/usbBackup';
import { createCustomer, getCustomerStatement, listCustomers } from './services/customers';
import { addExpenseCategory, addSupplierPayment, createEmployee, createExpense, createPurchase, createRawMaterial, createSupplier, getFinanceSummary, listEmployees, listExpenseCategories, listExpenses, listPurchases, listRawMaterials, listSalaryPayments, listSuppliers, paySalary, createProductionCost, listProductionCosts } from './services/finance';

const sendUpdateStatus = (payload: {status:string; message?:string; percent?:number; version?:string}) => {
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send('ronaq:updates:status', payload);
};

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.on('checking-for-update', () => sendUpdateStatus({status:'checking', message:'جارٍ التحقق من وجود تحديثات...'}));
autoUpdater.on('update-available', (info) => {
  sendUpdateStatus({status:'available', version:info.version, message:`يتوفر تحديث جديد ${info.version}`});
  if (Notification.isSupported()) new Notification({title:'RONAQ ERP', body:`يتوفر تحديث جديد ${info.version}. افتح الإعدادات لفحصه وتنزيله.`}).show();
});
autoUpdater.on('update-not-available', (info) => sendUpdateStatus({status:'latest', version:info.version, message:'البرنامج محدّث إلى آخر إصدار.'}));
autoUpdater.on('download-progress', (progress) => sendUpdateStatus({status:'downloading', percent:Math.round(progress.percent), message:`جارٍ تنزيل التحديث ${Math.round(progress.percent)}%`}));
autoUpdater.on('update-downloaded', (info) => sendUpdateStatus({status:'downloaded', version:info.version, message:`اكتمل تنزيل الإصدار ${info.version}. أصبح جاهزاً للتثبيت.`}));
autoUpdater.on('error', (error) => sendUpdateStatus({status:'error', message:`تعذر التحديث: ${error.message}`}));

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1100, minHeight: 720,
    title: 'رونق البصرة ERP', backgroundColor: '#f6f8fb',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: true
    }
  });
  if (process.env.VITE_DEV_SERVER_URL) win.loadURL(process.env.VITE_DEV_SERVER_URL);
  else win.loadFile(path.join(__dirname, '../renderer/index.html'));
};

app.whenReady().then(() => {
  const db = openDatabase();
  ipcMain.handle('ronaq:database-status', () => getDatabaseStatus());
  ipcMain.handle('ronaq:app:restart', () => { app.relaunch(); app.quit(); return {restarting:true}; });
  ipcMain.handle('ronaq:app:version', () => app.getVersion());
  ipcMain.handle('ronaq:updates:configure', async (_event, feedUrl:string) => {
    if (!app.isPackaged) throw new Error('فحص التحديثات متاح في النسخة المثبتة فقط.');
    let parsed:URL;
    try { parsed = new URL(String(feedUrl || '').trim()); } catch { throw new Error('أدخل رابط خادم تحديثات صحيحاً.'); }
    if (parsed.protocol !== 'https:') throw new Error('لأمان البرنامج يجب أن يبدأ رابط التحديثات بـ https://');
    autoUpdater.setFeedURL({provider:'generic', url:parsed.toString().replace(/\/?$/, '/')});
    return {configured:true};
  });
  ipcMain.handle('ronaq:updates:check', async () => {
    if (!app.isPackaged) throw new Error('فحص التحديثات متاح في النسخة المثبتة فقط.');
    return autoUpdater.checkForUpdates();
  });
  ipcMain.handle('ronaq:updates:download', async () => autoUpdater.downloadUpdate());
  ipcMain.handle('ronaq:updates:install', () => { autoUpdater.quitAndInstall(false, true); return {installing:true}; });
  ipcMain.handle('ronaq:system:backup:create', () => createDatabaseBackup(db, path.join(app.getPath('userData'), 'backups')));
  ipcMain.handle('ronaq:system:reset-all', async () => {
    const safety = await createDatabaseBackup(db, path.join(app.getPath('userData'), 'backups'));
    if (!safety.verified) throw new Error('تعذر التحقق من النسخة الاحتياطية؛ لم يتم حذف أي بيانات.');
    resetAllBusinessData(db);
    return {reset:true, safetyBackup:safety.path};
  });
  ipcMain.handle('ronaq:system:backup:list', () => listBackupHistory(db));
  ipcMain.handle('ronaq:system:usb:list', () => listRemovableDrives());
  ipcMain.handle('ronaq:system:usb:copy', () => scanAndCopyToConnectedUsb(db, path.join(app.getPath('userData'), 'backups')));
  ipcMain.handle('ronaq:system:backup:restore', async (_event, backupId:number) => restoreDatabaseBackup(
    db, backupId, path.join(app.getPath('userData'), 'backups'),
    path.join(app.getPath('userData'), 'data', 'ronaq-erp.sqlite'), closeDatabase,
    () => { app.relaunch(); app.exit(0); }
  ));
  ipcMain.handle('ronaq:system:audit:list', (_event, limit?:number) => listAuditLog(db, limit));
  ipcMain.handle('ronaq:system:settings:list', () => getSettings(db));
  ipcMain.handle('ronaq:system:settings:set', (_event,input) => setSetting(db,input.key,input.value));
  ipcMain.handle('ronaq:system:opening-balances:create', (_event,input) => recordOpeningBalances(db,input));
  ipcMain.handle('ronaq:system:opening-balances:status', () => getOpeningBalanceStatus(db));
  ipcMain.handle('ronaq:system:opening-balances:parties', () => listOpeningBalanceParties(db));
  ipcMain.handle('ronaq:workers:list', () => workers(db));
  ipcMain.handle('ronaq:workers:create', (_event,input) => addWorker(db,input));
  ipcMain.handle('ronaq:attendance:week', (_event,fromDate:string) => attendanceWeek(db,fromDate));
  ipcMain.handle('ronaq:attendance:record', (_event,input) => recordAttendance(db,input));
  ipcMain.handle('ronaq:stock-summary', () => getStockSummary(db));
  ipcMain.handle('ronaq:products:create', (_event,input) => createProduct(db,input));
  ipcMain.handle('ronaq:products', () => listProducts(db));
  ipcMain.handle('ronaq:stock-movements', (_event, limit?: number) => listRecentMovements(db, limit));
  ipcMain.handle('ronaq:production:create', (_event, input) => createProductionBatch(db, input));
  ipcMain.handle('ronaq:stock:issue', (_event, input) => issueStock(db, input));
  ipcMain.handle('ronaq:stock:adjust', (_event, input) => createStockAdjustment(db, input));
  ipcMain.handle('ronaq:returns:create', (_event, input) => createStockReturn(db, input));
  ipcMain.handle('ronaq:returns:pending', () => listPendingReturns(db));
  ipcMain.handle('ronaq:returns:details', (_event, id:number) => getStockReturnDetails(db,id));
  ipcMain.handle('ronaq:returns:inspect', (_event, input) => inspectStockReturn(db, input));
  ipcMain.handle('ronaq:sales:create', (_event, input) => createSalesInvoice(db, input));
  ipcMain.handle('ronaq:sales:collect', (_event, input) => collectInvoicePayment(db, input));
  ipcMain.handle('ronaq:sales:list', (_event, input) => listSalesInvoices(db, input?.fromDate, input?.toDate, input?.limit));
  ipcMain.handle('ronaq:sales:summary', (_event, input) => getSalesSummary(db, input?.fromDate, input?.toDate));
  ipcMain.handle('ronaq:sales:parties', () => listSaleParties(db));
  ipcMain.handle('ronaq:customers:list', () => listCustomers(db));
  ipcMain.handle('ronaq:customers:create', (_event,input) => createCustomer(db,input));
  ipcMain.handle('ronaq:customers:statement', (_event,input) => getCustomerStatement(db,input.customerId,input.fromDate,input.toDate));
  ipcMain.handle('ronaq:sales:details', (_event, id:number) => getSalesInvoiceDetails(db,id));
  ipcMain.handle('ronaq:drivers:list', () => listDrivers(db));
  ipcMain.handle('ronaq:drivers:create', (_event, input) => createDriver(db, input));
  ipcMain.handle('ronaq:drivers:loads:create', (_event, input) => createDriverLoad(db, input));
  ipcMain.handle('ronaq:drivers:loads:list', (_event, input) => listDriverLoads(db, input?.fromDate, input?.toDate));
  ipcMain.handle('ronaq:drivers:sheets:save', (_event, input) => saveDriverDailySheet(db, input));
  ipcMain.handle('ronaq:drivers:sheets:list', (_event, input) => listDriverDailySheets(db, input?.fromDate, input?.toDate));
  ipcMain.handle('ronaq:drivers:sheets:get', (_event, id: number) => getDriverDailySheet(db, id));
  ipcMain.handle('ronaq:drivers:sheets:close', (_event, input) => closeDriverDailySheet(db, input.id, input.reason));

  ipcMain.handle('ronaq:distributors:list', () => listDistributors(db));
  ipcMain.handle('ronaq:distributors:create', (_event,input) => createDistributor(db,input));
  ipcMain.handle('ronaq:distributors:drivers:list', (_event,id:number) => listDistributorDrivers(db,id));
  ipcMain.handle('ronaq:distributors:drivers:add', (_event,input) => addDistributorDriver(db,input));
  ipcMain.handle('ronaq:distributors:agreements:create', (_event,input) => createDistributorAgreement(db,input));
  ipcMain.handle('ronaq:distributors:agreements:list', (_event,id?:number) => listDistributorAgreements(db,id));
  ipcMain.handle('ronaq:distributors:agreements:get', (_event,id:number) => getDistributorAgreement(db,id));
  ipcMain.handle('ronaq:distributors:payments:add', (_event,input) => addDistributorPayment(db,input));
  ipcMain.handle('ronaq:distributors:pickups:create', (_event,input) => createDistributorPickup(db,input));
  ipcMain.handle('ronaq:distributors:refunds:create', (_event,input) => refundDistributorAgreement(db,input));

  ipcMain.handle('ronaq:finance:summary', () => getFinanceSummary(db));
  ipcMain.handle('ronaq:finance:production-costs:create', (_event,input) => createProductionCost(db,input));
  ipcMain.handle('ronaq:finance:production-costs:list', (_event,input) => listProductionCosts(db,input?.fromDate,input?.toDate));
  ipcMain.handle('ronaq:reports:dashboard', () => getDashboardSummary(db));
  ipcMain.handle('ronaq:reports:financial', (_event,input) => getFinancialReport(db,input.fromDate,input.toDate));
  ipcMain.handle('ronaq:cash:list', (_event,input) => listCashMovements(db,input?.fromDate,input?.toDate));
  ipcMain.handle('ronaq:cash:create', (_event,input) => createCashVoucher(db,input));
  ipcMain.handle('ronaq:finance:suppliers:list', () => listSuppliers(db));
  ipcMain.handle('ronaq:finance:suppliers:create', (_event,input) => createSupplier(db,input));
  ipcMain.handle('ronaq:finance:suppliers:payment', (_event,input) => addSupplierPayment(db,input));
  ipcMain.handle('ronaq:finance:materials:list', () => listRawMaterials(db));
  ipcMain.handle('ronaq:finance:materials:create', (_event,input) => createRawMaterial(db,input));
  ipcMain.handle('ronaq:finance:purchases:create', (_event,input) => createPurchase(db,input));
  ipcMain.handle('ronaq:finance:purchases:list', (_event,input) => listPurchases(db,input?.fromDate,input?.toDate));
  ipcMain.handle('ronaq:finance:categories:list', () => listExpenseCategories(db));
  ipcMain.handle('ronaq:finance:categories:create', (_event,input) => addExpenseCategory(db,input));
  ipcMain.handle('ronaq:finance:expenses:create', (_event,input) => createExpense(db,input));
  ipcMain.handle('ronaq:finance:expenses:list', (_event,input) => listExpenses(db,input?.fromDate,input?.toDate));
  ipcMain.handle('ronaq:finance:employees:list', () => listEmployees(db));
  ipcMain.handle('ronaq:finance:employees:create', (_event,input) => createEmployee(db,input));
  ipcMain.handle('ronaq:finance:salaries:pay', (_event,input) => paySalary(db,input));
  ipcMain.handle('ronaq:finance:salaries:list', (_event,input) => listSalaryPayments(db,input?.fromDate,input?.toDate));


  const backupFolder = path.join(app.getPath('userData'), 'backups');
  const periodicBackup = setInterval(() => {
    createDatabaseBackup(db, backupFolder).catch((error) => console.error('RONAQ periodic backup failed:', error));
  }, 6 * 60 * 60 * 1000);
  periodicBackup.unref();

  // Detect removable USB drives on startup and every minute. A verified local
  // generation is copied once per drive; incomplete copies are never promoted.
  let usbScanRunning = false;
  const scanUsb = async () => {
    if (usbScanRunning) return;
    usbScanRunning = true;
    try { await scanAndCopyToConnectedUsb(db, backupFolder); }
    catch (error) { console.error('RONAQ USB backup scan failed:', error); }
    finally { usbScanRunning = false; }
  };
  void scanUsb();
  const usbMonitor = setInterval(() => { void scanUsb(); }, 60 * 1000);
  usbMonitor.unref();

  createWindow();
  // If the accountant has configured a secure update feed before, check on startup
  // and then every 12 hours. A failed/offline check never blocks normal ERP use.
  const savedFeed = (getSettings(db) as any[]).find((row: any) => row.key === 'updates.feedUrl')?.value as string | undefined;
  if (app.isPackaged && savedFeed) {
    try {
      const parsed = new URL(savedFeed);
      if (parsed.protocol === 'https:') {
        autoUpdater.setFeedURL({provider:'generic', url:parsed.toString().replace(/\/?$/, '/')});
        setTimeout(() => autoUpdater.checkForUpdates().catch((error) => console.error('RONAQ update check failed:', error)), 8000).unref();
        const updateTimer = setInterval(() => autoUpdater.checkForUpdates().catch((error) => console.error('RONAQ update check failed:', error)), 12 * 60 * 60 * 1000);
        updateTimer.unref();
      }
    } catch (error) { console.error('Invalid RONAQ update feed URL:', error); }
  }
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
let quitAfterBackup = false;
app.on('before-quit', (event) => {
  if (quitAfterBackup) { closeDatabase(); return; }
  event.preventDefault();
  const backupFolder = path.join(app.getPath('userData'), 'backups');
  createDatabaseBackup(openDatabase(), backupFolder)
    .then(() => scanAndCopyToConnectedUsb(openDatabase(), backupFolder))
    .catch((error) => console.error('RONAQ closing/USB backup failed:', error))
    .finally(() => { quitAfterBackup = true; closeDatabase(); app.quit(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
