from pathlib import Path
s=(Path(__file__).parents[1]/'src/main/services/distributors.ts').read_text(encoding='utf-8')
assert 'deliveredValue+x.quantity*line.unit_price>paid-refunded' in s
assert 'لا يمكن تسليم كمية تتجاوز المبلغ المدفوع فعلياً على الاتفاقية' in s
assert 'distributor_agreement_payments' in s and 'distributor_refunds' in s
print('prepaid distributor pickup is capped by net agreement payments: OK')
