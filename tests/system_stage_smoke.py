import sqlite3, pathlib, tempfile, json
schema = pathlib.Path(__file__).parents[1] / 'src/main/database/schema.ts'
s = schema.read_text()
sql = s.split('export const schema = `',1)[1].rsplit('`;',1)[0]
con = sqlite3.connect(':memory:')
con.execute('PRAGMA foreign_keys=ON')
con.executescript(sql)
# New system tables exist and constrain the initial balance batch.
for table in ('backup_history','opening_balance_batches','opening_party_balances'):
    assert con.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",(table,)).fetchone()
con.execute("INSERT INTO parties(party_type,name) VALUES('customer','زبون افتتاحي')")
party_id = con.execute('SELECT id FROM parties').fetchone()[0]
con.execute("INSERT INTO opening_balance_batches(balance_date,notes) VALUES('2026-11-07','test')")
batch_id = con.execute('SELECT id FROM opening_balance_batches').fetchone()[0]
con.execute("INSERT INTO opening_party_balances(batch_id,party_id,balance,direction) VALUES(?,?,?,'receivable')",(batch_id,party_id,125000))
assert con.execute('SELECT balance FROM opening_party_balances').fetchone()[0] == 125000
try:
    con.execute("INSERT INTO opening_party_balances(batch_id,party_id,balance,direction) VALUES(?,?,?,'receivable')",(batch_id,party_id,50000))
    raise AssertionError('duplicate opening party balance was accepted')
except sqlite3.IntegrityError:
    pass
con.execute("INSERT INTO backup_history(file_name,backup_path,status,verified_at) VALUES('x.sqlite','/tmp/x','success',datetime('now'))")
assert con.execute('SELECT status FROM backup_history').fetchone()[0] == 'success'
print('PASS: backup history, opening-balance batch, receivable/payable opening balances and duplicate protection')
