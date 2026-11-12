import type Database from 'better-sqlite3';

export function listCustomers(db: Database.Database) {
  return db.prepare(`SELECT p.id,p.name,p.phone,p.address,p.notes,p.created_at,
    COUNT(DISTINCT CASE WHEN i.status='posted' THEN i.id END) invoice_count,
    COALESCE(SUM(CASE WHEN i.status='posted' THEN i.total_amount ELSE 0 END),0) total_sales,
    COALESCE(SUM(CASE WHEN i.status='posted' THEN i.paid_amount ELSE 0 END),0) total_paid,
    COALESCE(SUM(CASE WHEN i.status='posted' THEN i.total_amount-i.paid_amount ELSE 0 END),0) balance
    FROM parties p LEFT JOIN sales_invoices i ON i.party_id=p.id
    WHERE p.party_type='customer' AND p.is_active=1 GROUP BY p.id ORDER BY p.name`).all();
}

export function createCustomer(db: Database.Database, input: {name:string;phone?:string;address?:string;notes?:string}) {
  const name=input.name?.trim();
  if(!name || name.length<2) throw new Error('اكتب اسم الزبون بشكل صحيح');
  const phone=input.phone?.trim()||null;
  if(phone && phone.length>40) throw new Error('رقم الهاتف طويل أكثر من اللازم');
  const duplicate=db.prepare("SELECT id FROM parties WHERE party_type='customer' AND is_active=1 AND name=? COLLATE NOCASE").get(name);
  if(duplicate) throw new Error('هذا الزبون مسجل مسبقاً');
  const result=db.prepare("INSERT INTO parties(party_type,name,phone,address,notes) VALUES('customer',?,?,?,?)")
    .run(name,phone,input.address?.trim()||null,input.notes?.trim()||null);
  const id=Number(result.lastInsertRowid);
  db.prepare("INSERT INTO audit_log(entity_type,entity_id,action,new_values) VALUES('customer',?,'create',?)")
    .run(id,JSON.stringify({name,phone,address:input.address||null}));
  return {id,name};
}

export function getCustomerStatement(db: Database.Database, customerId:number, fromDate?:string, toDate?:string) {
  if(!Number.isInteger(customerId)||customerId<1) throw new Error('الزبون المحدد غير صحيح');
  const customer=db.prepare("SELECT id,name,phone,address,notes FROM parties WHERE id=? AND party_type='customer'").get(customerId) as any;
  if(!customer) throw new Error('الزبون غير موجود');
  const invoiceRows=db.prepare(`SELECT i.id,i.invoice_no,i.invoice_date,i.created_at,i.total_amount,i.paid_amount,
    i.total_amount-i.paid_amount remaining_amount,i.status,
    COALESCE((SELECT SUM(sp.amount) FROM sales_payments sp WHERE sp.invoice_id=i.id),0) payments_total
    FROM sales_invoices i WHERE i.party_id=? AND i.status='posted'
    AND (? IS NULL OR i.invoice_date>=?) AND (? IS NULL OR i.invoice_date<=?)
    ORDER BY i.invoice_date DESC,i.id DESC`).all(customerId,fromDate||null,fromDate||null,toDate||null,toDate||null) as any[];
  const getLines=db.prepare(`SELECT p.name product_name,p.unit,l.quantity,l.unit_price,l.line_total
    FROM sales_lines l JOIN products p ON p.id=l.product_id WHERE l.invoice_id=? ORDER BY l.id`);
  const invoices=invoiceRows.map(invoice=>({...invoice,lines:getLines.all(invoice.id)}));
  const totals=db.prepare(`SELECT COALESCE(SUM(total_amount),0) total_sales,COALESCE(SUM(paid_amount),0) total_paid,
    COALESCE(SUM(total_amount-paid_amount),0) balance,COUNT(*) invoice_count
    FROM sales_invoices WHERE party_id=? AND status='posted'`).get(customerId) as any;
  const payments=db.prepare(`SELECT sp.id,sp.payment_date,sp.created_at,sp.amount,sp.payment_method,sp.notes,i.invoice_no
    FROM sales_payments sp JOIN sales_invoices i ON i.id=sp.invoice_id
    WHERE i.party_id=? AND i.status='posted' AND (? IS NULL OR sp.payment_date>=?) AND (? IS NULL OR sp.payment_date<=?)
    ORDER BY sp.payment_date DESC,sp.id DESC`).all(customerId,fromDate||null,fromDate||null,toDate||null,toDate||null);
  return {customer,totals,invoices,payments};
}
