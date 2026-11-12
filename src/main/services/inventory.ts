import type Database from 'better-sqlite3';
type Line = { productId: number; quantity: number };
const today = () => {const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
function balance(db: Database.Database, id:number):number {
 const r=db.prepare(`SELECT COALESCE(SUM(CASE WHEN movement_type IN ('opening','production_in','good_return_in','damage_return_in','adjustment_in') THEN quantity WHEN movement_type IN ('sale_out','driver_load_out','adjustment_out') THEN -quantity ELSE 0 END),0) balance FROM stock_movements WHERE product_id=?`).get(id) as {balance:number};
 return r.balance;
}
function validate(db:Database.Database, lines:Line[]) {
 if(!lines?.length) throw new Error('أدخل صنفاً واحداً على الأقل');
 for(const l of lines) {
  if(!Number.isInteger(l.productId)||l.productId<1||!Number.isInteger(l.quantity)||l.quantity<1) throw new Error('الصنف أو الكمية غير صحيحة');
  if(!db.prepare('SELECT id FROM products WHERE id=? AND is_active=1').get(l.productId)) throw new Error('الصنف غير موجود أو غير فعال');
 }
}
export function listProducts(db:Database.Database) {
 return db.prepare('SELECT id,code,name,unit,minimum_stock FROM products WHERE is_active=1 ORDER BY id').all();
}
export function getStockSummary(db:Database.Database) {
 return (listProducts(db) as Array<{id:number;code:string;name:string;unit:string;minimum_stock:number}>).map(p=>({
  ...p,balance:balance(db,p.id),
  inboundToday:(db.prepare(`SELECT COALESCE(SUM(quantity),0) q FROM stock_movements WHERE product_id=? AND movement_type IN ('opening','production_in','good_return_in','damage_return_in','adjustment_in') AND date(created_at)=date('now','localtime')`).get(p.id) as {q:number}).q,
  outboundToday:(db.prepare(`SELECT COALESCE(SUM(quantity),0) q FROM stock_movements WHERE product_id=? AND movement_type IN ('sale_out','driver_load_out','adjustment_out') AND date(created_at)=date('now','localtime')`).get(p.id) as {q:number}).q,
  lowStock:balance(db,p.id)<=p.minimum_stock
 }));
}
export function createProductionBatch(db:Database.Database,input:{productionDate?:string;mealNo?:number;notes?:string;lines:Line[];createdBy?:number}) {
 validate(db,input.lines);
 if(new Set(input.lines.map(x=>x.productId)).size!==input.lines.length) throw new Error('اجمع كمية الصنف في سطر واحد');
 const run=db.transaction(()=>{
  const no=`PR-${Date.now()}`;
  const r=db.prepare('INSERT INTO production_batches(batch_no,production_date,meal_no,notes,created_by) VALUES(?,?,?,?,?)').run(no,input.productionDate||today(),input.mealNo||1,input.notes||null,input.createdBy||null);
  const id=Number(r.lastInsertRowid);
  const add=db.prepare('INSERT INTO production_lines(batch_id,product_id,quantity) VALUES(?,?,?)');
  for(const l of input.lines) add.run(id,l.productId,l.quantity);
  db.prepare(`INSERT INTO audit_log(entity_type,entity_id,action,new_values) VALUES('production_batch',?,'create',?)`).run(id,JSON.stringify(input));
  return {id,batchNo:no};
 });
 return run();
}
export function issueStock(db:Database.Database,input:{productId:number;quantity:number;kind:'sale_out'|'driver_load_out';referenceType?:string;referenceId?:number;notes?:string;createdBy?:number}) {
 return db.transaction(()=>{
  if(!Number.isInteger(input.quantity)||input.quantity<1) throw new Error('الكمية يجب أن تكون أكبر من صفر');
  const available=balance(db,input.productId);
  if(available<input.quantity) throw new Error(`الرصيد غير كافٍ، المتوفر ${available}`);
  db.prepare('INSERT INTO stock_movements(product_id,movement_type,quantity,reference_type,reference_id,notes,created_by) VALUES(?,?,?,?,?,?,?)').run(input.productId,input.kind,input.quantity,input.referenceType||null,input.referenceId||null,input.notes||null,input.createdBy||null);
  db.prepare(`INSERT INTO audit_log(entity_type,entity_id,action,new_values) VALUES('stock_movement',last_insert_rowid(),'issue',?)`).run(JSON.stringify(input));
  return {balance:available-input.quantity};
 })();
}
export function createStockReturn(db:Database.Database,input:{sourceType:'employee_driver'|'distributor';sourceId?:number;notes?:string;lines:Line[];createdBy?:number}) {
 validate(db,input.lines);
 if(!Number.isInteger(input.sourceId)||!input.sourceId||input.sourceId<1)throw new Error('حدد مصدر الراجع');
 const source=input.sourceType==='employee_driver'?db.prepare("SELECT id FROM parties WHERE id=? AND party_type IN ('driver','employee') AND is_active=1").get(input.sourceId):db.prepare("SELECT id FROM parties WHERE id=? AND party_type='distributor' AND is_active=1").get(input.sourceId);
 if(!source)throw new Error('مصدر الراجع غير موجود أو غير فعال');
 return db.transaction(()=>{
  const no=`RT-${Date.now()}`;
  const r=db.prepare('INSERT INTO stock_returns(return_no,source_type,source_id,notes,created_by) VALUES(?,?,?,?,?)').run(no,input.sourceType,input.sourceId||null,input.notes||null,input.createdBy||null);
  const id=Number(r.lastInsertRowid), add=db.prepare('INSERT INTO stock_return_lines(return_id,product_id,quantity) VALUES(?,?,?)');
  for(const l of input.lines) add.run(id,l.productId,l.quantity);
  return {id,returnNo:no,status:'pending'};
 })();
}
export function inspectStockReturn(db:Database.Database,input:{returnId:number;decision:'accepted'|'rejected';inspectedBy?:number;reason?:string}) {
 return db.transaction(()=>{
  const r=db.prepare('SELECT status FROM stock_returns WHERE id=?').get(input.returnId) as {status:string}|undefined;
  if(!r) throw new Error('سجل الراجع غير موجود');
  if(r.status!=='pending') throw new Error('تم فحص هذا الراجع مسبقاً');
  if(input.decision==='accepted') {
   const lines=db.prepare('SELECT product_id,quantity FROM stock_return_lines WHERE return_id=?').all(input.returnId) as Array<{product_id:number;quantity:number}>;
   const add=db.prepare(`INSERT INTO stock_movements(product_id,movement_type,quantity,reference_type,reference_id,notes,created_by) VALUES(?,'good_return_in',?,'stock_return',?,'راجع صالح بعد الفحص',?)`);
   for(const l of lines) add.run(l.product_id,l.quantity,input.returnId,input.inspectedBy||null);
  }
  db.prepare("UPDATE stock_returns SET status=?,inspected_at=datetime('now','localtime'),inspected_by=? WHERE id=?").run(input.decision,input.inspectedBy||null,input.returnId);
  db.prepare("INSERT INTO audit_log(entity_type,entity_id,action,reason) VALUES('stock_return',?,?,?)").run(input.returnId,input.decision,input.reason||null);
  return {id:input.returnId,status:input.decision};
 })();
}
export function listRecentMovements(db:Database.Database,limit=100) {
 return db.prepare('SELECT sm.id,sm.movement_type,sm.quantity,sm.notes,sm.created_at,p.name product_name,p.unit FROM stock_movements sm JOIN products p ON p.id=sm.product_id ORDER BY sm.id DESC LIMIT ?').all(Math.min(Math.max(limit,1),500));
}
export function listPendingReturns(db:Database.Database) {
 return db.prepare("SELECT r.id,r.return_no,r.source_type,r.source_id,r.notes,r.created_at,p.name source_name,(SELECT COUNT(*) FROM stock_return_lines l WHERE l.return_id=r.id) line_count FROM stock_returns r LEFT JOIN parties p ON p.id=r.source_id WHERE r.status='pending' ORDER BY r.id DESC").all();
}


export function createStockAdjustment(db:Database.Database,input:{productId:number;direction:'in'|'out';quantity:number;reason:string;createdBy?:number}) {
 if(!Number.isInteger(input.productId)||input.productId<1) throw new Error('اختر الصنف');
 if(!Number.isInteger(input.quantity)||input.quantity<1) throw new Error('الكمية يجب أن تكون أكبر من صفر');
 if(!input.reason||input.reason.trim().length<4) throw new Error('اكتب سبب التسوية بشكل واضح');
 return db.transaction(()=>{
  const product=db.prepare('SELECT id FROM products WHERE id=? AND is_active=1').get(input.productId);
  if(!product) throw new Error('الصنف غير موجود أو غير فعال');
  const before=balance(db,input.productId);
  if(input.direction==='out'&&before<input.quantity) throw new Error(`لا يمكن صرف ${input.quantity}، الرصيد المتوفر ${before}`);
  const type=input.direction==='in'?'adjustment_in':'adjustment_out';
  const r=db.prepare('INSERT INTO stock_movements(product_id,movement_type,quantity,reference_type,notes,created_by) VALUES(?,?,?,?,?,?)').run(input.productId,type,input.quantity,'manual_adjustment',input.reason.trim(),input.createdBy||null);
  db.prepare("INSERT INTO audit_log(entity_type,entity_id,action,new_values,reason,created_by) VALUES('stock_movement',?,'adjustment',?,?,?)").run(Number(r.lastInsertRowid),JSON.stringify({productId:input.productId,direction:input.direction,quantity:input.quantity,balanceBefore:before,balanceAfter:before+(input.direction==='in'?input.quantity:-input.quantity)}),input.reason.trim(),input.createdBy||null);
  return {balance:before+(input.direction==='in'?input.quantity:-input.quantity)};
 })();
}
export function getStockReturnDetails(db:Database.Database,returnId:number) {
 if(!Number.isInteger(returnId)||returnId<1) throw new Error('رقم الراجع غير صحيح');
 return db.prepare('SELECT l.product_id,l.quantity,p.name product_name,p.unit FROM stock_return_lines l JOIN products p ON p.id=l.product_id WHERE l.return_id=? ORDER BY l.id').all(returnId);
}

export function createProduct(db:Database.Database,input:{name:string;unit:string;minimumStock?:number}){
 const name=input.name?.trim(),unit=input.unit?.trim();if(!name||!unit||name.length>120||unit.length>40)throw new Error('أدخل اسم الصنف ووحدة القياس');
 const minimum=Number(input.minimumStock||0);if(!Number.isInteger(minimum)||minimum<0)throw new Error('الحد الأدنى غير صحيح');
 return db.transaction(()=>{const code=`CUSTOM-${Date.now()}-${Math.floor(Math.random()*100000)}`;const r=db.prepare('INSERT INTO products(code,name,unit,minimum_stock) VALUES(?,?,?,?)').run(code,name,unit,minimum);db.prepare("INSERT INTO audit_log(entity_type,entity_id,action,new_values) VALUES('product',?,'create',?)").run(r.lastInsertRowid,JSON.stringify({name,unit,minimum}));return {id:Number(r.lastInsertRowid),name,unit}})();
}
