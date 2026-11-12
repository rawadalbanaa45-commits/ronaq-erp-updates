export const schema = `
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  display_name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  avatar_path TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  minimum_stock INTEGER NOT NULL DEFAULT 0 CHECK (minimum_stock >= 0),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS workers (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL UNIQUE,
 job_title TEXT,
 is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
 created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS worker_attendance (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 worker_id INTEGER NOT NULL REFERENCES workers(id),
 work_date TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('present','absent','leave')),
 check_in TEXT,
 check_out TEXT,
 notes TEXT,
 updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
 UNIQUE(worker_id,work_date),
 CHECK(check_out IS NULL OR check_in IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON worker_attendance(work_date,worker_id);
CREATE TABLE IF NOT EXISTS stock_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id),
  movement_type TEXT NOT NULL CHECK (movement_type IN ('opening','production_in','sale_out','driver_load_out','good_return_in','damage_return_in','adjustment_in','adjustment_out')),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  reference_type TEXT,
  reference_id INTEGER,
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_stock_product_date ON stock_movements(product_id, created_at);
CREATE TABLE IF NOT EXISTS production_batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_no TEXT NOT NULL UNIQUE,
  production_date TEXT NOT NULL,
  meal_no INTEGER NOT NULL DEFAULT 1 CHECK (meal_no > 0),
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS production_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id INTEGER NOT NULL REFERENCES production_batches(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0)
);
CREATE TABLE IF NOT EXISTS parties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  party_type TEXT NOT NULL CHECK (party_type IN ('customer','distributor','supplier','employee','driver')),
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  notes TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_parties_name ON parties(name);
CREATE TABLE IF NOT EXISTS sales_invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_no TEXT NOT NULL UNIQUE,
  invoice_date TEXT NOT NULL,
  party_id INTEGER REFERENCES parties(id),
  sale_kind TEXT NOT NULL CHECK (sale_kind IN ('walk_in','named_customer','distributor')),
  status TEXT NOT NULL DEFAULT 'posted' CHECK (status IN ('draft','posted','voided')),
  total_amount INTEGER NOT NULL CHECK (total_amount >= 0),
  paid_amount INTEGER NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  CHECK (paid_amount <= total_amount)
);
CREATE TABLE IF NOT EXISTS sales_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL REFERENCES sales_invoices(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price INTEGER NOT NULL CHECK (unit_price >= 0),
  line_total INTEGER NOT NULL CHECK (line_total >= 0)
);
CREATE TABLE IF NOT EXISTS cash_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('opening','sale_receipt','debt_collection','driver_collection','expense','salary','supplier_payment','distributor_refund','other_receipt','other_payment')),
  direction TEXT NOT NULL CHECK (direction IN ('in','out')),
  amount INTEGER NOT NULL CHECK (amount > 0),
  party_id INTEGER REFERENCES parties(id),
  reference_type TEXT,
  reference_id INTEGER,
  voucher_no TEXT UNIQUE,
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  action TEXT NOT NULL,
  old_values TEXT,
  new_values TEXT,
  reason TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TRIGGER IF NOT EXISTS trg_sales_line_stock_guard
BEFORE INSERT ON sales_lines
BEGIN
  SELECT CASE WHEN COALESCE((SELECT SUM(CASE
    WHEN movement_type IN ('opening','production_in','good_return_in','damage_return_in','adjustment_in') THEN quantity
    WHEN movement_type IN ('sale_out','driver_load_out','adjustment_out') THEN -quantity ELSE 0 END)
    FROM stock_movements WHERE product_id=NEW.product_id),0) < NEW.quantity
    THEN RAISE(ABORT,'المخزون غير كافٍ') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_sales_line_stock_insert
AFTER INSERT ON sales_lines
WHEN (SELECT status FROM sales_invoices WHERE id=NEW.invoice_id) = 'posted'
BEGIN
  INSERT INTO stock_movements(product_id,movement_type,quantity,reference_type,reference_id,created_by)
  SELECT NEW.product_id,'sale_out',NEW.quantity,'sales_invoice',NEW.invoice_id,created_by
  FROM sales_invoices WHERE id=NEW.invoice_id;
END;
CREATE TRIGGER IF NOT EXISTS trg_production_line_stock_insert
AFTER INSERT ON production_lines
BEGIN
  INSERT INTO stock_movements(product_id,movement_type,quantity,reference_type,reference_id,created_by)
  SELECT NEW.product_id,'production_in',NEW.quantity,'production_batch',NEW.batch_id,created_by
  FROM production_batches WHERE id=NEW.batch_id;
END;
CREATE TABLE IF NOT EXISTS stock_returns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  return_no TEXT NOT NULL UNIQUE,
  source_type TEXT NOT NULL CHECK(source_type IN ('employee_driver','distributor')),
  source_id INTEGER REFERENCES parties(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected')),
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  inspected_at TEXT,
  inspected_by INTEGER REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS stock_return_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  return_id INTEGER NOT NULL REFERENCES stock_returns(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL CHECK(quantity > 0)
);

CREATE TABLE IF NOT EXISTS sales_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL REFERENCES sales_invoices(id),
  payment_date TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK(amount > 0),
  payment_method TEXT NOT NULL CHECK(payment_method IN ('cash','card','transfer')),
  notes TEXT,
  cash_movement_id INTEGER REFERENCES cash_movements(id),
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_sales_payments_invoice ON sales_payments(invoice_id, payment_date);
CREATE INDEX IF NOT EXISTS idx_sales_invoice_date ON sales_invoices(invoice_date, status);
CREATE TABLE IF NOT EXISTS production_costs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id),
  production_date TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK(quantity > 0),
  total_cost INTEGER NOT NULL CHECK(total_cost >= 0),
  unit_cost REAL NOT NULL CHECK(unit_cost >= 0),
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_production_costs_product_date ON production_costs(product_id, production_date);
CREATE TABLE IF NOT EXISTS driver_loads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  load_no TEXT NOT NULL UNIQUE,
  driver_id INTEGER NOT NULL REFERENCES parties(id),
  load_date TEXT NOT NULL,
  vehicle_name TEXT,
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS driver_load_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  load_id INTEGER NOT NULL REFERENCES driver_loads(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL CHECK(quantity > 0)
);
CREATE INDEX IF NOT EXISTS idx_driver_load_date ON driver_loads(driver_id,load_date);
CREATE TRIGGER IF NOT EXISTS trg_driver_load_stock_guard
BEFORE INSERT ON driver_load_lines
BEGIN
  SELECT CASE WHEN COALESCE((SELECT SUM(CASE
    WHEN movement_type IN ('opening','production_in','good_return_in','damage_return_in','adjustment_in') THEN quantity
    WHEN movement_type IN ('sale_out','driver_load_out','adjustment_out') THEN -quantity ELSE 0 END)
    FROM stock_movements WHERE product_id=NEW.product_id),0) < NEW.quantity
    THEN RAISE(ABORT,'المخزون غير كافٍ') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_driver_load_stock_insert
AFTER INSERT ON driver_load_lines
BEGIN
  INSERT INTO stock_movements(product_id,movement_type,quantity,reference_type,reference_id,notes,created_by)
  SELECT NEW.product_id,'driver_load_out',NEW.quantity,'driver_load',NEW.load_id,'تحميل سائق',created_by
  FROM driver_loads WHERE id=NEW.load_id;
END;
CREATE TABLE IF NOT EXISTS driver_daily_sheets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  driver_id INTEGER NOT NULL REFERENCES parties(id),
  sheet_date TEXT NOT NULL,
  cash_sales INTEGER NOT NULL DEFAULT 0 CHECK(cash_sales >= 0),
  credit_sales INTEGER NOT NULL DEFAULT 0 CHECK(credit_sales >= 0),
  old_debt_collected INTEGER NOT NULL DEFAULT 0 CHECK(old_debt_collected >= 0),
  expenses INTEGER NOT NULL DEFAULT 0 CHECK(expenses >= 0),
  cash_delivered INTEGER NOT NULL DEFAULT 0 CHECK(cash_delivered >= 0),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')),
  closed_at TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  UNIQUE(driver_id,sheet_date)
);
CREATE TABLE IF NOT EXISTS driver_sheet_sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sheet_id INTEGER NOT NULL REFERENCES driver_daily_sheets(id),
  customer_name TEXT NOT NULL,
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL CHECK(quantity > 0),
  unit_price INTEGER NOT NULL CHECK(unit_price >= 0),
  line_total INTEGER NOT NULL CHECK(line_total >= 0),
  payment_type TEXT NOT NULL CHECK(payment_type IN ('cash','credit')),
  receipt_no TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_driver_sheet_sales_sheet ON driver_sheet_sales(sheet_id);
CREATE INDEX IF NOT EXISTS idx_driver_sheet_sales_product ON driver_sheet_sales(product_id);
CREATE TABLE IF NOT EXISTS driver_sheet_expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sheet_id INTEGER NOT NULL REFERENCES driver_daily_sheets(id),
  expense_name TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK(amount > 0),
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_driver_sheet_date ON driver_daily_sheets(sheet_date,driver_id);
CREATE TABLE IF NOT EXISTS document_sequences (
  sequence_key TEXT PRIMARY KEY,
  last_value INTEGER NOT NULL DEFAULT 0 CHECK(last_value >= 0)
);

-- Distributor profiles and their own drivers (not factory employees)
CREATE TABLE IF NOT EXISTS distributor_drivers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  distributor_id INTEGER NOT NULL REFERENCES parties(id),
  name TEXT NOT NULL,
  phone TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_distributor_drivers ON distributor_drivers(distributor_id,is_active);
CREATE TABLE IF NOT EXISTS distributor_agreements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agreement_no TEXT NOT NULL UNIQUE,
  distributor_id INTEGER NOT NULL REFERENCES parties(id),
  agreement_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','completed','cancelled')),
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS distributor_agreement_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agreement_id INTEGER NOT NULL REFERENCES distributor_agreements(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL CHECK(quantity > 0),
  delivered_quantity INTEGER NOT NULL DEFAULT 0 CHECK(delivered_quantity >= 0 AND delivered_quantity <= quantity),
  unit_price INTEGER NOT NULL CHECK(unit_price >= 0),
  UNIQUE(agreement_id,product_id)
);
CREATE TABLE IF NOT EXISTS distributor_agreement_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agreement_id INTEGER NOT NULL REFERENCES distributor_agreements(id),
  payment_date TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK(amount > 0),
  payment_method TEXT NOT NULL CHECK(payment_method IN ('cash','card','transfer')),
  notes TEXT,
  cash_movement_id INTEGER REFERENCES cash_movements(id),
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_dist_payments_agreement ON distributor_agreement_payments(agreement_id,payment_date);
CREATE TABLE IF NOT EXISTS distributor_pickups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pickup_no TEXT NOT NULL UNIQUE,
  distributor_id INTEGER NOT NULL REFERENCES parties(id),
  distributor_driver_id INTEGER REFERENCES distributor_drivers(id),
  driver_name_snapshot TEXT,
  vehicle_name TEXT,
  pickup_date TEXT NOT NULL,
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS distributor_pickup_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pickup_id INTEGER NOT NULL REFERENCES distributor_pickups(id),
  agreement_line_id INTEGER NOT NULL REFERENCES distributor_agreement_lines(id),
  quantity INTEGER NOT NULL CHECK(quantity > 0)
);
CREATE TABLE IF NOT EXISTS distributor_refunds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  refund_no TEXT NOT NULL UNIQUE,
  agreement_id INTEGER NOT NULL REFERENCES distributor_agreements(id),
  refund_date TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK(amount > 0),
  notes TEXT,
  cash_movement_id INTEGER REFERENCES cash_movements(id),
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_dist_agreement_date ON distributor_agreements(distributor_id,agreement_date);


-- Supplier purchases and raw-material inventory are separate from operating expenses.
CREATE TABLE IF NOT EXISTS raw_materials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  unit TEXT NOT NULL DEFAULT 'وحدة',
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS raw_material_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  material_id INTEGER NOT NULL REFERENCES raw_materials(id),
  direction TEXT NOT NULL CHECK(direction IN ('in','out')),
  quantity INTEGER NOT NULL CHECK(quantity>0),
  reference_type TEXT NOT NULL,
  reference_id INTEGER,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_raw_material_movements ON raw_material_movements(material_id,created_at);
CREATE TABLE IF NOT EXISTS purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_no TEXT NOT NULL UNIQUE,
  supplier_id INTEGER NOT NULL REFERENCES parties(id),
  purchase_date TEXT NOT NULL,
  supplier_invoice_no TEXT,
  total_amount INTEGER NOT NULL CHECK(total_amount>=0),
  paid_amount INTEGER NOT NULL DEFAULT 0 CHECK(paid_amount>=0 AND paid_amount<=total_amount),
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS purchase_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_id INTEGER NOT NULL REFERENCES purchases(id),
  material_id INTEGER NOT NULL REFERENCES raw_materials(id),
  quantity INTEGER NOT NULL CHECK(quantity>0),
  unit_cost INTEGER NOT NULL CHECK(unit_cost>=0)
);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier_date ON purchases(supplier_id,purchase_date);
CREATE TABLE IF NOT EXISTS supplier_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id INTEGER NOT NULL REFERENCES parties(id),
  purchase_id INTEGER REFERENCES purchases(id),
  payment_date TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK(amount>0),
  payment_method TEXT NOT NULL CHECK(payment_method IN ('cash','card','transfer')),
  cash_movement_id INTEGER REFERENCES cash_movements(id),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_supplier_payments ON supplier_payments(supplier_id,payment_date);
CREATE TABLE IF NOT EXISTS expense_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  category_type TEXT NOT NULL DEFAULT 'general' CHECK(category_type IN ('general','fuel')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1))
);
INSERT OR IGNORE INTO expense_categories(name,category_type) VALUES
 ('وقود','fuel'),('صيانة','general'),('كهرباء وماء','general'),('نقل','general'),('مصروفات أخرى','general');
CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES expense_categories(id),
  expense_name TEXT NOT NULL,
  expense_date TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK(amount>0),
  beneficiary_driver_id INTEGER REFERENCES parties(id),
  vehicle_name TEXT,
  fuel_type TEXT,
  notes TEXT,
  cash_movement_id INTEGER REFERENCES cash_movements(id),
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date,category_id);
CREATE TABLE IF NOT EXISTS salary_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES parties(id),
  payment_date TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK(amount>0),
  cash_movement_id INTEGER REFERENCES cash_movements(id),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_salary_employee_date ON salary_payments(employee_id,payment_date);


CREATE TABLE IF NOT EXISTS backup_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_name TEXT NOT NULL,
  backup_path TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('success','failed')),
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  verified_at TEXT
);
CREATE TABLE IF NOT EXISTS opening_balance_batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  balance_date TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS opening_party_balances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id INTEGER NOT NULL REFERENCES opening_balance_batches(id),
  party_id INTEGER NOT NULL REFERENCES parties(id),
  balance INTEGER NOT NULL CHECK(balance>0),
  direction TEXT NOT NULL CHECK(direction IN ('receivable','payable')),
  UNIQUE(batch_id,party_id,direction)
);

`;
