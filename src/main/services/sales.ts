import type Database from 'better-sqlite3';

type SaleLine = { productId: number; quantity: number; unitPrice: number };
type SaleInput = {
  invoiceDate?: string;
  partyId?: number | null;
  saleKind: 'walk_in' | 'named_customer' | 'distributor';
  lines: SaleLine[];
  paidAmount?: number;
  paymentMethod?: 'cash' | 'card' | 'transfer';
  notes?: string;
  createdBy?: number;
};
const localDate = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
function stockBalance(db: Database.Database, productId: number): number {
  const row = db.prepare(`SELECT COALESCE(SUM(CASE
    WHEN movement_type IN ('opening','production_in','good_return_in','damage_return_in','adjustment_in') THEN quantity
    WHEN movement_type IN ('sale_out','driver_load_out','adjustment_out') THEN -quantity ELSE 0 END),0) AS balance
    FROM stock_movements WHERE product_id=?`).get(productId) as {balance:number};
  return row.balance;
}
function nextInvoiceNo(db: Database.Database): string {
  const key = 'SI-SIMPLE';
  db.prepare('INSERT INTO document_sequences(sequence_key,last_value) VALUES(?,0) ON CONFLICT(sequence_key) DO NOTHING').run(key);
  const row = db.prepare('UPDATE document_sequences SET last_value=last_value+1 WHERE sequence_key=? RETURNING last_value').get(key) as {last_value:number};
  // Simple increasing numbers. Previously issued SI-YYYY-NNNNNN identifiers remain valid.
  return String(row.last_value);
}

export function createSalesInvoice(db: Database.Database, input: SaleInput) {
  if (!input || !['walk_in','named_customer','distributor'].includes(input.saleKind)) throw new Error('نوع البيع غير صحيح');
  if (!Array.isArray(input.lines) || input.lines.length === 0) throw new Error('أضف مادة واحدة على الأقل');
  if (input.saleKind !== 'walk_in' && (!Number.isInteger(input.partyId) || !input.partyId)) throw new Error('اختر اسم الزبون أو الموزع');
  if (input.partyId) {
    const party = db.prepare('SELECT party_type FROM parties WHERE id=? AND is_active=1').get(input.partyId) as {party_type:string}|undefined;
    if (!party) throw new Error('الجهة المحددة غير موجودة أو غير فعالة');
    if (input.saleKind === 'distributor' && party.party_type !== 'distributor') throw new Error('الجهة المحددة ليست موزعاً');
    if (input.saleKind === 'named_customer' && party.party_type !== 'customer') throw new Error('الجهة المحددة ليست زبوناً');
  }
  const seen = new Set<number>();
  let total = 0;
  for (const line of input.lines) {
    if (!Number.isInteger(line.productId) || line.productId < 1 || !Number.isInteger(line.quantity) || line.quantity < 1 || !Number.isSafeInteger(line.unitPrice) || line.unitPrice < 0) throw new Error('تحقق من المادة والكمية والسعر');
    if (seen.has(line.productId)) throw new Error('اجمع كمية المادة في سطر واحد');
    seen.add(line.productId);
    if (!db.prepare('SELECT id FROM products WHERE id=? AND is_active=1').get(line.productId)) throw new Error('إحدى المواد غير موجودة أو غير فعالة');
    if (stockBalance(db,line.productId) < line.quantity) throw new Error(`المخزون غير كافٍ للمادة رقم ${line.productId}`);
    total += line.quantity * line.unitPrice;
    if (!Number.isSafeInteger(total)) throw new Error('قيمة الفاتورة أكبر من الحد المسموح');
  }
  const paid = input.paidAmount ?? total;
  if (!Number.isSafeInteger(paid) || paid < 0 || paid > total) throw new Error('مبلغ المقبوض غير صحيح');
  if (paid < total && !input.partyId) throw new Error('البيع بالدين أو الدفعة الجزئية يتطلب تسجيل اسم الزبون');
  if (paid > 0 && !['cash','card','transfer'].includes(input.paymentMethod ?? 'cash')) throw new Error('طريقة القبض غير صحيحة');
  return db.transaction(() => {
    const invoiceNo = nextInvoiceNo(db);
    const date = input.invoiceDate || localDate();
    const result = db.prepare(`INSERT INTO sales_invoices(invoice_no,invoice_date,party_id,sale_kind,status,total_amount,paid_amount,notes,created_by)
      VALUES(?,?,?,?,'posted',?,?,?,?)`).run(invoiceNo,date,input.partyId || null,input.saleKind,total,paid,input.notes || null,input.createdBy || null);
    const invoiceId = Number(result.lastInsertRowid);
    const addLine = db.prepare('INSERT INTO sales_lines(invoice_id,product_id,quantity,unit_price,line_total) VALUES(?,?,?,?,?)');
    for (const line of input.lines) addLine.run(invoiceId,line.productId,line.quantity,line.unitPrice,line.quantity*line.unitPrice);
    if (paid > 0) {
      const method=input.paymentMethod || 'cash';
      const cash = method==='cash' ? db.prepare(`INSERT INTO cash_movements(movement_type,direction,amount,party_id,reference_type,reference_id,notes,created_by)
        VALUES('sale_receipt','in',?,?,'sales_invoice',?,?,?)`).run(paid,input.partyId || null,invoiceId,`قبض فاتورة ${invoiceNo}`,input.createdBy || null) : null;
      db.prepare(`INSERT INTO sales_payments(invoice_id,payment_date,amount,payment_method,cash_movement_id,created_by)
        VALUES(?,?,?,?,?,?)`).run(invoiceId,date,paid,method,cash?Number(cash.lastInsertRowid):null,input.createdBy || null);
    }
    db.prepare(`INSERT INTO audit_log(entity_type,entity_id,action,new_values,created_by)
      VALUES('sales_invoice',?,'create',?,?)`).run(invoiceId,JSON.stringify({invoiceNo,total,paid,partyId:input.partyId || null,lines:input.lines}),input.createdBy || null);
    return { id: invoiceId, invoiceNo, totalAmount: total, paidAmount: paid, remainingAmount: total-paid };
  })();
}
export function collectInvoicePayment(db: Database.Database, input: {invoiceId:number; amount:number; paymentDate?:string; paymentMethod:'cash'|'card'|'transfer'; notes?:string; createdBy?:number}) {
  if (!Number.isInteger(input.invoiceId) || input.invoiceId < 1 || !Number.isSafeInteger(input.amount) || input.amount < 1) throw new Error('مبلغ التحصيل غير صحيح');
  if (!['cash','card','transfer'].includes(input.paymentMethod)) throw new Error('طريقة القبض غير صحيحة');
  return db.transaction(() => {
    const invoice = db.prepare('SELECT invoice_no,total_amount,paid_amount,party_id,status FROM sales_invoices WHERE id=?').get(input.invoiceId) as {invoice_no:string;total_amount:number;paid_amount:number;party_id:number|null;status:string}|undefined;
    if (!invoice || invoice.status !== 'posted') throw new Error('الفاتورة غير موجودة أو غير فعالة');
    const remaining = invoice.total_amount - invoice.paid_amount;
    if (input.amount > remaining) throw new Error(`المبلغ أكبر من الدين المتبقي (${remaining})`);
    const cash = input.paymentMethod==='cash' ? db.prepare(`INSERT INTO cash_movements(movement_type,direction,amount,party_id,reference_type,reference_id,notes,created_by)
      VALUES('debt_collection','in',?,?,'sales_invoice',?,?,?)`).run(input.amount,invoice.party_id,input.invoiceId,input.notes || `تحصيل من فاتورة ${invoice.invoice_no}`,input.createdBy || null) : null;
    const cashId = cash ? Number(cash.lastInsertRowid) : null;
    db.prepare(`INSERT INTO sales_payments(invoice_id,payment_date,amount,payment_method,notes,cash_movement_id,created_by)
      VALUES(?,?,?,?,?,?,?)`).run(input.invoiceId,input.paymentDate || localDate(),input.amount,input.paymentMethod,input.notes || null,cashId,input.createdBy || null);
    const newPaid = invoice.paid_amount + input.amount;
    db.prepare('UPDATE sales_invoices SET paid_amount=? WHERE id=?').run(newPaid,input.invoiceId);
    db.prepare(`INSERT INTO audit_log(entity_type,entity_id,action,new_values,created_by)
      VALUES('sales_invoice',?,'payment',?,?)`).run(input.invoiceId,JSON.stringify({amount:input.amount,newPaid}),input.createdBy || null);
    return {invoiceId:input.invoiceId,paidAmount:newPaid,remainingAmount:invoice.total_amount-newPaid};
  })();
}
export function listSalesInvoices(db: Database.Database, fromDate?:string, toDate?:string, limit=200) {
  return db.prepare(`SELECT i.id,i.invoice_no,i.invoice_date,i.sale_kind,i.total_amount,i.paid_amount,
    i.total_amount-i.paid_amount AS remaining_amount,i.status,i.created_at,COALESCE(p.name,'زبون نقدي') AS party_name
    FROM sales_invoices i LEFT JOIN parties p ON p.id=i.party_id
    WHERE i.invoice_date BETWEEN ? AND ? ORDER BY i.id DESC LIMIT ?`).all(fromDate || '0001-01-01',toDate || '9999-12-31',Math.min(Math.max(limit,1),1000));
}
export function getSalesSummary(db: Database.Database, fromDate?:string, toDate?:string) {
  const from = fromDate || localDate(), to = toDate || localDate();
  return db.prepare(`SELECT COUNT(*) invoice_count,COALESCE(SUM(total_amount),0) sales_total,
    COALESCE(SUM(paid_amount),0) received_total,COALESCE(SUM(total_amount-paid_amount),0) debt_total
    FROM sales_invoices WHERE status='posted' AND invoice_date BETWEEN ? AND ?`).get(from,to);
}
export function listSaleParties(db: Database.Database) {
  return db.prepare(`SELECT id,name,party_type FROM parties WHERE is_active=1 AND party_type IN ('customer','distributor') ORDER BY name`).all();
}


export function getSalesInvoiceDetails(db: Database.Database, invoiceId: number) {
  if (!Number.isInteger(invoiceId) || invoiceId < 1) throw new Error('رقم الفاتورة غير صحيح');
  const invoice = db.prepare(`SELECT i.id,i.invoice_no,i.invoice_date,i.sale_kind,i.total_amount,i.paid_amount,
    i.total_amount-i.paid_amount AS remaining_amount,i.notes,i.status,i.created_at,COALESCE(p.name,'زبون نقدي') AS party_name,
    p.phone AS party_phone,p.address AS party_address
    FROM sales_invoices i LEFT JOIN parties p ON p.id=i.party_id WHERE i.id=?`).get(invoiceId) as any;
  if (!invoice) throw new Error('الفاتورة غير موجودة');
  const lines = db.prepare(`SELECT l.id,l.quantity,l.unit_price,l.line_total,p.name AS product_name,p.unit
    FROM sales_lines l JOIN products p ON p.id=l.product_id WHERE l.invoice_id=? ORDER BY l.id`).all(invoiceId);
  const payments = db.prepare(`SELECT payment_date,amount,payment_method,notes FROM sales_payments WHERE invoice_id=? ORDER BY id`).all(invoiceId);
  return { ...invoice, lines, payments };
}
