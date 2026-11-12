from pathlib import Path
root=Path(__file__).resolve().parents[1]
service=(root/'src/main/services/customers.ts').read_text()
main=(root/'src/main/index.ts').read_text()
preload=(root/'src/preload/index.ts').read_text()
types=(root/'src/shared/types.d.ts').read_text()
ui=(root/'src/renderer/ui/CustomersPanel.tsx').read_text()
app=(root/'src/renderer/ui/App.tsx').read_text()
checks={
 'customer directory is limited to customer parties': "p.party_type='customer'" in service,
 'duplicate active customer names rejected': 'هذا الزبون مسجل مسبقاً' in service,
 'balances use posted invoices only': "i.status='posted'" in service,
 'customer statement exposes invoice and payment history': 'sales_payments' in service and 'invoice_no' in service,
 'collection uses existing invoice payment workflow': 'collectInvoicePayment' in ui,
 'customer service IPC registered': "ronaq:customers:statement" in main and "ronaq:customers:create" in main,
 'preload customer APIs exposed': 'customerStatement:' in preload and 'createCustomer:' in preload,
 'renderer API types declared': 'customerStatement:' in types,
 'customer module mounted in app': "tab.moduleId==='customers'?<CustomersPanel/>" in app,
 'customer UI supports date filters and print': 'fromDate' in ui and 'window.print()' in ui,
}
for label,ok in checks.items(): print(('PASS' if ok else 'FAIL')+' '+label)
if not all(checks.values()): raise SystemExit(1)
