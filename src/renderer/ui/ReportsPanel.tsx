import {useState} from 'react';
const fmt=(n:number)=>new Intl.NumberFormat('en-US').format(Math.round(n||0))+' د.ع';
const qty=(n:number)=>new Intl.NumberFormat('en-US').format(Math.round(n||0));
const today=(()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`})();
const month=today.slice(0,7)+'-01';
const weekStart=()=>{const d=new Date();d.setDate(d.getDate()-((d.getDay()+6)%7));return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
export default function ReportsPanel(){
 const [fromDate,setFrom]=useState(month),[toDate,setTo]=useState(today),[data,setData]=useState<any>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[view,setView]=useState<'manager'|'accountant'>('manager');
 const load=async()=>{try{setBusy(true);setError('');setData(await window.ronaq.financialReport({fromDate,toDate}))}catch(e){setError(e instanceof Error?e.message:'تعذر تحميل التقرير')}finally{setBusy(false)}};
 const setRange=(kind:'today'|'week'|'month')=>{if(kind==='today'){setFrom(today);setTo(today)}else if(kind==='week'){setFrom(weekStart());setTo(today)}else{setFrom(month);setTo(today)}};
 const netReady=data?.netProfit!==null&&data?.netProfit!==undefined;
 return <section className="panel report-print" style={{padding:24}}>
  <div className="panel-head report-controls"><div><h2>تقارير المعمل</h2><p>تقرير واضح للمدير، وتفاصيل إضافية للمحاسب</p></div><span className="soft-tag">رونق البصرة</span></div>
  <div className="report-controls" style={{display:'flex',gap:9,flexWrap:'wrap',alignItems:'end',margin:'18px 0'}}>
   <div className="report-presets"><button type="button" onClick={()=>setRange('today')}>اليوم</button><button type="button" onClick={()=>setRange('week')}>هذا الأسبوع</button><button type="button" onClick={()=>setRange('month')}>هذا الشهر</button></div>
   <label>من تاريخ<input type="date" value={fromDate} onChange={e=>setFrom(e.target.value)} style={{display:'block',padding:10,border:'1px solid #d9e2ec',borderRadius:8}}/></label>
   <label>إلى تاريخ<input type="date" value={toDate} onChange={e=>setTo(e.target.value)} style={{display:'block',padding:10,border:'1px solid #d9e2ec',borderRadius:8}}/></label>
   <button className="primary-btn" disabled={busy} onClick={load}>{busy?'جارٍ تجهيز التقرير':'عرض التقرير'}</button>
   {data&&<button type="button" onClick={()=>window.print()}>طباعة / حفظ PDF</button>}
  </div>
  {error&&<p role="alert" style={{color:'#b42318'}}>{error}</p>}
  {!data&&!busy&&!error&&<div className="manager-report-empty"><strong>اختار الفترة واضغط «عرض التقرير»</strong><span>راح يظهر ملخص المعمل بالأرقام وبكلام واضح.</span></div>}
  {data&&<>
   <header className="report-print-head" dir="rtl"><img src="/ronaQ-logo.jpg" alt="شعار رونق البصرة"/><div><h1>رونق البصرة</h1><p>{view==='manager'?'ملخص أداء المعمل':'التفاصيل المالية للمحاسب'}</p><small>من {fromDate} إلى {toDate} · تاريخ إعداد التقرير: {today}</small></div></header>
   <div className="report-view-switch report-controls"><button className={view==='manager'?'active':''} onClick={()=>setView('manager')}>ملخص المدير</button><button className={view==='accountant'?'active':''} onClick={()=>setView('accountant')}>تفاصيل المحاسب</button></div>
   {view==='manager'?<>
    <h3 className="manager-report-title">ملخص المعمل خلال الفترة</h3>
    <div className="manager-report-grid">
     <article className="manager-report-card"><span>إجمالي المبيعات</span><strong>{fmt(data.revenue)}</strong><small>كل المبيعات المسجلة خلال الفترة</small></article>
     <article className="manager-report-card"><span>المصاريف</span><strong>{fmt(data.expenses)}</strong><small>وقود وصيانة ومصاريف تشغيلية</small></article>
     <article className="manager-report-card"><span>الرواتب المدفوعة</span><strong>{fmt(data.salaries)}</strong><small>رواتب العمال والموظفين</small></article>
     <article className="manager-report-card manager-report-net"><span>صافي الربح التقديري</span><strong>{netReady?fmt(data.netProfit):'غير مكتمل'}</strong><small>{netReady?'بعد تكلفة البضاعة والمصاريف والرواتب':'تحتاج بعض المنتجات إلى تسجيل تكلفة إنتاجها أولاً'}</small></article>
    </div>
    <div className="manager-report-grid manager-report-grid-small">
     <article className="manager-report-card"><span>المبالغ المقبوضة فعلياً</span><strong>{fmt(data.periodReceipts)}</strong><small>الفلوس الداخلة للصندوق خلال الفترة</small></article>
     <article className="manager-report-card"><span>المبالغ المصروفة فعلياً</span><strong>{fmt(data.periodPayments)}</strong><small>الفلوس الخارجة من الصندوق خلال الفترة</small></article>
     <article className="manager-report-card"><span>رصيد الصندوق حالياً</span><strong>{fmt(data.cashBalance)}</strong><small>الموجود بالصندوق الآن</small></article>
     <article className="manager-report-card"><span>ديون الزبائن والسواق</span><strong>{fmt(data.receivables)}</strong><small>مبالغ بذمة الآخرين للمعمل</small></article>
    </div>
    <div className="manager-report-section"><h3>الإنتاج والمبيعات حسب المادة</h3><p>الكميات المسجلة لكل مادة خلال الفترة المحددة</p><div className="table-scroll"><table className="stock-table"><thead><tr><th>اسم المادة</th><th>الكمية المنتجة</th><th>الكمية المباعة</th><th>تكلفة المبيعات</th></tr></thead><tbody>{data.products.map((p:any)=><tr key={p.product_id}><td>{p.name}</td><td>{qty(p.produced||0)} {p.unit}</td><td>{qty(p.quantity)} {p.unit}</td><td>{p.cost?fmt(p.cost):'لم تسجل التكلفة'}</td></tr>)}</tbody></table></div></div>
    <div className="manager-report-note">{netReady?'الربح المعروض تقديري حسب تكاليف الإنتاج المسجلة بالنظام.':'ملاحظة: ما نعرض رقم ربح غير دقيق. حتى يطلع الربح، لازم المحاسب يسجل تكلفة إنتاج المواد المباعة.'} هذا التقرير ملخص إداري، والتفاصيل موجودة بتبويب «تفاصيل المحاسب».</div>
   </>:<>
    <div className="stats-grid">{[{label:'إجمالي الإيرادات',v:data.revenue},{label:'تكلفة البضاعة المباعة',v:data.cogs},{label:'مجمل الربح',v:data.grossProfit},{label:'صافي الربح التقديري',v:data.netProfit},{label:'المصروفات',v:data.expenses},{label:'الرواتب',v:data.salaries},{label:'رصيد الصندوق الحالي',v:data.cashBalance},{label:'ديون الزبائن والسواق',v:data.receivables},{label:'مستحقات المجهزين',v:data.supplierPayables}].map(x=><article className="stat-card" key={x.label}><span>{x.label}</span><strong style={{fontSize:18}}>{x.v===null?'غير متاح':fmt(x.v)}</strong></article>)}</div>
    <h3 className="report-subtitle">تفصيل الإيرادات</h3><div className="table-scroll"><table className="stock-table"><thead><tr><th>البيان</th><th>المبلغ</th></tr></thead><tbody><tr><td>مبيعات الفواتير</td><td>{fmt(data.sales)}</td></tr><tr><td>مبيعات الموزعين</td><td>{fmt(data.wholesale)}</td></tr><tr><td>مبيعات السواق الموظفين</td><td>{fmt(data.driverSales||0)}</td></tr><tr><th>إجمالي الإيرادات</th><th>{fmt(data.revenue)}</th></tr></tbody></table></div>
    <h3 className="report-subtitle">تكلفة الإنتاج والمبيعات حسب المنتج</h3><div className="table-scroll"><table className="stock-table"><thead><tr><th>المنتج</th><th>الكمية المباعة</th><th>متوسط تكلفة الوحدة</th><th>تكلفة المبيعات</th></tr></thead><tbody>{data.products.map((p:any)=><tr key={p.product_id}><td>{p.name}</td><td>{qty(p.quantity)} {p.unit}</td><td>{fmt(p.averageUnitCost)}</td><td>{fmt(p.cost)}</td></tr>)}</tbody></table></div>
    <h3 className="report-subtitle">المصاريف وحركة الصندوق</h3><div className="table-scroll"><table className="stock-table"><thead><tr><th>البيان</th><th>المبلغ</th></tr></thead><tbody><tr><td>المصروفات التشغيلية</td><td>{fmt(data.expenses)}</td></tr><tr><td>الرواتب</td><td>{fmt(data.salaries)}</td></tr><tr><td>مقبوضات الفترة</td><td>{fmt(data.periodReceipts)}</td></tr><tr><td>مدفوعات الفترة</td><td>{fmt(data.periodPayments)}</td></tr><tr><td>مستحقات المجهزين</td><td>{fmt(data.supplierPayables)}</td></tr><tr><td>مصروف الوقود ضمن المصروفات</td><td>{fmt(data.fuel)}</td></tr></tbody></table></div>
    <div className="warehouse-note report-note">{data.costingNote}{data.costingMissingProducts?.length?` المنتجات التي تحتاج إلى تكلفة: ${data.costingMissingProducts.join('، ')}.`:''} مبيعات الموزعين تُحتسب عند استلام البضاعة، ومبيعات السواق من المطابقة اليومية. لا تُدخل مبيعات السواق نفسها مرة ثانية كفواتير مستقلة حتى لا تتكرر الإيرادات. المشتريات لا تُخصم مباشرة من الربح.</div>
   </>}
   <footer className="report-footer">رونق البصرة · تقرير داخلي للإدارة · RONAQ ERP</footer>
  </>}
 </section>
}
