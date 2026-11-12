import type Database from 'better-sqlite3';

const today = () => {const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
type LoadLine = { productId: number; quantity: number };

function ensureDriver(db: Database.Database, id: number) {
  const row = db.prepare("SELECT id FROM parties WHERE id=? AND party_type IN ('driver','employee') AND is_active=1").get(id);
  if (!row) throw new Error('السائق غير موجود أو غير فعال');
}

export function listDrivers(db: Database.Database) {
  return db.prepare("SELECT id,name,phone,notes FROM parties WHERE party_type IN ('driver','employee') AND is_active=1 ORDER BY name").all();
}

export function createDriver(db: Database.Database, input: { name: string; phone?: string; notes?: string }) {
  const name = String(input.name || '').trim();
  if (name.length < 2) throw new Error('اكتب اسم السائق بشكل صحيح');
  const result = db.prepare("INSERT INTO parties(party_type,name,phone,notes) VALUES('driver',?,?,?)")
    .run(name, input.phone?.trim() || null, input.notes?.trim() || null);
  const id = Number(result.lastInsertRowid);
  db.prepare("INSERT INTO audit_log(entity_type,entity_id,action,new_values) VALUES('driver',?,'create',?)")
    .run(id, JSON.stringify({ name, phone: input.phone || null }));
  return { id, name };
}

export function createDriverLoad(db: Database.Database, input: {
  driverId: number; loadDate?: string; vehicleName?: string; notes?: string; lines: LoadLine[]; createdBy?: number;
}) {
  ensureDriver(db, input.driverId);
  if (!input.lines?.length) throw new Error('أضف مادة واحدة على الأقل للتحميلة');
  if (new Set(input.lines.map(x => x.productId)).size !== input.lines.length) throw new Error('اجمع كمية المادة في سطر واحد');
  for (const line of input.lines) {
    if (!Number.isInteger(line.productId) || line.productId < 1 || !Number.isInteger(line.quantity) || line.quantity < 1)
      throw new Error('المادة أو كمية التحميل غير صحيحة');
  }
  return db.transaction(() => {
    const loadNo = `DL-${Date.now()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
    const result = db.prepare('INSERT INTO driver_loads(load_no,driver_id,load_date,vehicle_name,notes,created_by) VALUES(?,?,?,?,?,?)')
      .run(loadNo, input.driverId, input.loadDate || today(), input.vehicleName?.trim() || null, input.notes?.trim() || null, input.createdBy || null);
    const id = Number(result.lastInsertRowid);
    const add = db.prepare('INSERT INTO driver_load_lines(load_id,product_id,quantity) VALUES(?,?,?)');
    for (const line of input.lines) add.run(id, line.productId, line.quantity);
    db.prepare("INSERT INTO audit_log(entity_type,entity_id,action,new_values) VALUES('driver_load',?,'create',?)")
      .run(id, JSON.stringify(input));
    return { id, loadNo };
  })();
}

export function listDriverLoads(db: Database.Database, fromDate?: string, toDate?: string) {
  return db.prepare(`SELECT l.id,l.load_no,l.load_date,l.vehicle_name,l.created_at,p.name driver_name,
    (SELECT COUNT(*) FROM driver_load_lines x WHERE x.load_id=l.id) line_count,
    (SELECT COALESCE(SUM(quantity),0) FROM driver_load_lines x WHERE x.load_id=l.id) total_quantity
    FROM driver_loads l JOIN parties p ON p.id=l.driver_id
    WHERE (? IS NULL OR l.load_date>=?) AND (? IS NULL OR l.load_date<=?) ORDER BY l.id DESC LIMIT 300`)
    .all(fromDate || null, fromDate || null, toDate || null, toDate || null);
}

export function saveDriverDailySheet(db: Database.Database, input: {
  driverId: number; sheetDate?: string; cashSales: number; creditSales: number;
  oldDebtCollected: number; expenses: number; cashDelivered: number; notes?: string;
  expenseLines?: Array<{ expenseName: string; amount: number; notes?: string }>;
  salesLines?: Array<{customerName:string;productId:number;quantity:number;unitPrice:number;paymentType:'cash'|'credit';receiptNo?:string}>;
  createdBy?: number; correctionReason?: string;
}) {
  ensureDriver(db, input.driverId);
  const values = [input.cashSales, input.creditSales, input.oldDebtCollected, input.expenses, input.cashDelivered];
  if (values.some(v => !Number.isSafeInteger(v) || v < 0)) throw new Error('تأكد من إدخال مبالغ صحيحة وغير سالبة');
  const date = input.sheetDate || today();
  const expenseLines = input.expenseLines || [];
  const salesLines = input.salesLines || [];
  if (salesLines.some(x=>!x.customerName?.trim()||!Number.isSafeInteger(x.productId)||x.productId<1||!Number.isSafeInteger(x.quantity)||x.quantity<1||!Number.isSafeInteger(x.unitPrice)||x.unitPrice<0||!['cash','credit'].includes(x.paymentType)||!db.prepare('SELECT id FROM products WHERE id=? AND is_active=1').get(x.productId))) throw new Error('تفاصيل مبيعات السائق غير صحيحة');
  for(const x of salesLines){const configured=db.prepare('SELECT value FROM app_settings WHERE key=?').get(`driver.price.${x.productId}`) as {value:string}|undefined;if(configured&&configured.value.trim()!==''&&Number(configured.value)!==x.unitPrice)throw new Error(`سعر بيع السواق المعتمد لهذا المنتج هو ${Number(configured.value).toLocaleString('en-US')} دينار`)}
  if (salesLines.length) { const cashTotal=salesLines.filter(x=>x.paymentType==='cash').reduce((n,x)=>n+x.quantity*x.unitPrice,0);const creditTotal=salesLines.filter(x=>x.paymentType==='credit').reduce((n,x)=>n+x.quantity*x.unitPrice,0);if(!Number.isSafeInteger(cashTotal)||!Number.isSafeInteger(creditTotal)||cashTotal!==input.cashSales||creditTotal!==input.creditSales)throw new Error('مجاميع المبيعات النقدية والآجلة لا تطابق تفاصيل سطور البيع'); }
  if (expenseLines.some(x => !x.expenseName.trim() || !Number.isSafeInteger(x.amount) || x.amount <= 0))
    throw new Error('تفاصيل المصروفات غير صحيحة');
  if (expenseLines.length && expenseLines.reduce((a, x) => a + x.amount, 0) !== input.expenses)
    throw new Error('مجموع تفاصيل المصروفات لا يطابق مبلغ المصروفات');
  return db.transaction(() => {
    const existing = db.prepare('SELECT * FROM driver_daily_sheets WHERE driver_id=? AND sheet_date=?').get(input.driverId, date) as { id: number; status: string; [key: string]: unknown } | undefined;
    let id: number;
    if (existing) {
      if (existing.status === 'closed' && !input.correctionReason?.trim()) throw new Error('المطابقة مغلقة؛ يلزم ذكر سبب التعديل');
      db.prepare(`UPDATE driver_daily_sheets SET cash_sales=?,credit_sales=?,old_debt_collected=?,expenses=?,cash_delivered=?,notes=?,status='open',closed_at=NULL WHERE id=?`)
        .run(...values, input.notes || null, existing.id);
      id = existing.id;
      const oldSalesLines=db.prepare('SELECT customer_name,product_id,quantity,unit_price,line_total,payment_type,receipt_no FROM driver_sheet_sales WHERE sheet_id=?').all(id);
      db.prepare('DELETE FROM driver_sheet_sales WHERE sheet_id=?').run(id);
      db.prepare('DELETE FROM driver_sheet_expenses WHERE sheet_id=?').run(id);
      db.prepare("INSERT INTO audit_log(entity_type,entity_id,action,reason,old_values,new_values) VALUES('driver_daily_sheet',?,'update',?,?,?)")
        .run(id, input.correctionReason || 'تحديث قبل الإغلاق', JSON.stringify({...existing,salesLines:oldSalesLines}), JSON.stringify(input));
      const cashDelta = input.cashDelivered - Number(existing.cash_delivered || 0);
      if (cashDelta > 0) db.prepare("INSERT INTO cash_movements(movement_type,direction,amount,party_id,reference_type,reference_id,notes,created_by) VALUES('driver_collection','in',?,?,'driver_daily_sheet',?,?,?)")
        .run(cashDelta, input.driverId, id, `زيادة تسليم نقدي للمطابقة ${date}`, input.createdBy || null);
      else if (cashDelta < 0) db.prepare("INSERT INTO cash_movements(movement_type,direction,amount,party_id,reference_type,reference_id,notes,created_by) VALUES('other_payment','out',?,?,'driver_daily_sheet',?,?,?)")
        .run(Math.abs(cashDelta), input.driverId, id, `تصحيح نقص التسليم النقدي للمطابقة ${date}`, input.createdBy || null);
    } else {
      const r = db.prepare(`INSERT INTO driver_daily_sheets(driver_id,sheet_date,cash_sales,credit_sales,old_debt_collected,expenses,cash_delivered,notes,created_by)
        VALUES(?,?,?,?,?,?,?,?,?)`).run(input.driverId, date, ...values, input.notes || null, input.createdBy || null);
      id = Number(r.lastInsertRowid);
      if (input.cashDelivered > 0) db.prepare("INSERT INTO cash_movements(movement_type,direction,amount,party_id,reference_type,reference_id,notes,created_by) VALUES('driver_collection','in',?,?,'driver_daily_sheet',?,?,?,?)")
        .run(input.cashDelivered, input.driverId, id, `تسليم نقدي من السائق عن ${date}`, input.createdBy || null, `${date} 12:00:00`);
      db.prepare("INSERT INTO audit_log(entity_type,entity_id,action,new_values) VALUES('driver_daily_sheet',?,'create',?)").run(id, JSON.stringify(input));
    }
    const add = db.prepare('INSERT INTO driver_sheet_expenses(sheet_id,expense_name,amount,notes) VALUES(?,?,?,?)');
    for (const e of expenseLines) add.run(id, e.expenseName.trim(), e.amount, e.notes || null);
    const addSale=db.prepare('INSERT INTO driver_sheet_sales(sheet_id,customer_name,product_id,quantity,unit_price,line_total,payment_type,receipt_no) VALUES(?,?,?,?,?,?,?,?)');
    for(const x of salesLines)addSale.run(id,x.customerName.trim(),x.productId,x.quantity,x.unitPrice,x.quantity*x.unitPrice,x.paymentType,x.receiptNo?.trim()||null);
    return getDriverDailySheet(db, id);
  })();
}

export function closeDriverDailySheet(db: Database.Database, sheetId: number, reason?: string) {
  return db.transaction(() => {
    const sheet = db.prepare('SELECT id,status FROM driver_daily_sheets WHERE id=?').get(sheetId) as { id: number; status: string } | undefined;
    if (!sheet) throw new Error('مطابقة السائق غير موجودة');
    if (sheet.status === 'closed') throw new Error('المطابقة مغلقة مسبقاً');
    db.prepare("UPDATE driver_daily_sheets SET status='closed',closed_at=datetime('now','localtime') WHERE id=?").run(sheetId);
    db.prepare("INSERT INTO audit_log(entity_type,entity_id,action,reason) VALUES('driver_daily_sheet',?,'close',?)").run(sheetId, reason || null);
    return getDriverDailySheet(db, sheetId);
  })();
}

export function getDriverDailySheet(db: Database.Database, id: number) {
  const row = db.prepare(`SELECT s.*,p.name driver_name,
    (s.cash_sales+s.old_debt_collected-s.expenses) expected_cash,
    (s.cash_delivered-(s.cash_sales+s.old_debt_collected-s.expenses)) cash_difference
    FROM driver_daily_sheets s JOIN parties p ON p.id=s.driver_id WHERE s.id=?`).get(id);
  if (!row) throw new Error('مطابقة السائق غير موجودة');
  return { ...row as object, expenses_detail: db.prepare('SELECT id,expense_name,amount,notes FROM driver_sheet_expenses WHERE sheet_id=? ORDER BY id').all(id), sales_lines:db.prepare('SELECT s.*,p.name product_name,p.unit FROM driver_sheet_sales s JOIN products p ON p.id=s.product_id WHERE s.sheet_id=? ORDER BY s.id').all(id),
    loads: db.prepare('SELECT l.id,l.load_no,l.vehicle_name,l.load_date, p.name product_name,x.quantity,p.unit FROM driver_loads l JOIN driver_load_lines x ON x.load_id=l.id JOIN products p ON p.id=x.product_id WHERE l.driver_id=(SELECT driver_id FROM driver_daily_sheets WHERE id=?) AND l.load_date=(SELECT sheet_date FROM driver_daily_sheets WHERE id=?) ORDER BY l.id,x.id').all(id,id) };
}

export function listDriverDailySheets(db: Database.Database, fromDate?: string, toDate?: string) {
  return db.prepare(`SELECT s.id,s.sheet_date,s.status,p.name driver_name,s.cash_sales,s.credit_sales,s.old_debt_collected,s.expenses,s.cash_delivered,
    (s.cash_sales+s.old_debt_collected-s.expenses) expected_cash,
    (s.cash_delivered-(s.cash_sales+s.old_debt_collected-s.expenses)) cash_difference
    FROM driver_daily_sheets s JOIN parties p ON p.id=s.driver_id
    WHERE (? IS NULL OR s.sheet_date>=?) AND (? IS NULL OR s.sheet_date<=?) ORDER BY s.sheet_date DESC,s.id DESC LIMIT 300`)
    .all(fromDate || null, fromDate || null, toDate || null, toDate || null);
}
