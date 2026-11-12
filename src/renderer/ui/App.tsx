import DistributorsPanel from './DistributorsPanel';
import SalesPanel from './SalesPanel';
import DriversPanel from './DriversPanel';
import FinancePanel from './FinancePanel';
import ReportsPanel from './ReportsPanel';
import CashPanel from './CashPanel';
import SystemPanel from './SystemPanel';
import CustomersPanel from './CustomersPanel';
import ProductionPanel from './ProductionPanel';
import WarehousePanel from './WarehousePanel';
import AttendancePanel from './AttendancePanel';
import { useEffect, useMemo, useState } from 'react';
import { Activity, Archive, Bell, Boxes, ChartNoAxesCombined, ChevronLeft, CircleDollarSign, ClipboardList, Factory, HandCoins, LayoutDashboard, Moon, Package, Plus, Search, Settings, ShoppingCart, Sun, Truck, Users, Wallet } from 'lucide-react';

type Module = { id: string; label: string; icon: typeof LayoutDashboard; group: string };
const modules: Module[] = [
  {id:'dashboard',label:'الرئيسية',icon:LayoutDashboard,group:'عام'},
  {id:'sales',label:'المبيعات',icon:ShoppingCart,group:'العمليات'},
  {id:'production',label:'الإنتاج',icon:Factory,group:'العمليات'},
  {id:'warehouse',label:'المخزن',icon:Boxes,group:'العمليات'},
  {id:'drivers',label:'السواق',icon:Truck,group:'العملاء والتوزيع'},
  {id:'distributors',label:'الموزعون',icon:Users,group:'العملاء والتوزيع'},
  {id:'customers',label:'العملاء والديون',icon:HandCoins,group:'العملاء والتوزيع'},
  {id:'purchases',label:'المشتريات',icon:Package,group:'المالية'},
  {id:'production-costs',label:'تكاليف الإنتاج',icon:CircleDollarSign,group:'المالية'},
  {id:'expenses',label:'المصروفات',icon:ClipboardList,group:'المالية'},
  {id:'cash',label:'الصندوق',icon:Wallet,group:'المالية'},
  {id:'payroll',label:'الموظفون والرواتب',icon:CircleDollarSign,group:'المالية'},
  {id:'attendance',label:'حضور وغياب العمال',icon:ClipboardList,group:'الإدارة'},
  {id:'reports',label:'التقارير',icon:ChartNoAxesCombined,group:'الإدارة'},
  {id:'settings',label:'الإعدادات',icon:Settings,group:'الإدارة'},
];
const money = new Intl.NumberFormat('en-US');
export default function App(){
 const [dbState,setDbState]=useState<'checking'|'ready'|'error'>('checking');
 const [theme,setTheme]=useState<'light'|'dark'>('light');
 useEffect(()=>{window.ronaq.settings().then(rows=>{const saved=rows.find((x:any)=>x.key==='ui.theme')?.value;setTheme(saved==='dark'?'dark':'light')}).catch(()=>{});},[]);
 useEffect(()=>{document.documentElement.dataset.theme=theme;},[theme]);
 useEffect(()=>{ window.ronaq.databaseStatus().then(s=>setDbState(s.connected && s.integrity==='ok'?'ready':'error')).catch(()=>setDbState('error')); },[]);
 const [tabs,setTabs]=useState<Array<{key:number;moduleId:string}>>([{key:1,moduleId:'dashboard'}]); const [activeKey,setActiveKey]=useState(1); const [nextTabKey,setNextTabKey]=useState(2); const [query,setQuery]=useState('');
 const active=tabs.find(t=>t.key===activeKey)?.moduleId||'dashboard';
 const [stock,setStock]=useState<Array<{id:number;code:string;name:string;unit:string;minimum_stock:number;balance:number;inboundToday:number;outboundToday:number;lowStock:boolean}>>([]);
 const [movements,setMovements]=useState<Array<{id:number;movement_type:string;quantity:number;notes:string|null;created_at:string;product_name:string;unit:string}>>([]);
 const [products,setProducts]=useState<Array<{id:number;code:string;name:string;unit:string;minimum_stock:number}>>([]);
 const [dashboard,setDashboard]=useState<any>(null);
 const [pendingReturns,setPendingReturns]=useState<any[]>([]);
 const [notice,setNotice]=useState(''); const [profileOpen,setProfileOpen]=useState(false);
 const refreshInventory=async()=>{const [s,p,m,r]=await Promise.all([window.ronaq.stockSummary(),window.ronaq.products(),window.ronaq.stockMovements(50),window.ronaq.pendingReturns()]);setStock(s);setProducts(p);setMovements(m);setPendingReturns(r)};
 const refreshDashboard=async()=>{try{setDashboard(await window.ronaq.dashboardSummary())}catch(e){setNotice(e instanceof Error?e.message:'تعذر تحديث لوحة الرئيسية')}};
 useEffect(()=>{refreshInventory().catch(e=>setNotice(e.message||'تعذر تحميل بيانات المخزن'));},[]);
 useEffect(()=>{if(active==='dashboard')refreshDashboard();if(active==='warehouse')refreshInventory().catch(e=>setNotice(e instanceof Error?e.message:'تعذر تحديث المخزن'));},[activeKey,active]);


 const current=modules.find(m=>m.id===active)!;
 const toggleTheme=async()=>{const next=theme==='light'?'dark':'light';setTheme(next);try{await window.ronaq.setSetting({key:'ui.theme',value:next})}catch(e){setNotice(e instanceof Error?e.message:'تعذر حفظ مظهر النظام')}};
 const open=(id:string)=>{const key=nextTabKey;setNextTabKey(v=>v+1);setTabs(t=>[...t,{key,moduleId:id}]);setActiveKey(key)};
 const close=(key:number)=>{const index=tabs.findIndex(t=>t.key===key);if(index<0)return;const target=tabs[index];if(target.key===1)return;const next=tabs.filter(t=>t.key!==key);setTabs(next.length?next:[{key:1,moduleId:'dashboard'}]);if(activeKey===key){const neighbor=next[Math.max(0,index-1)]||next[0];setActiveKey(neighbor.key)}};
 const filtered=useMemo(()=>modules.filter(m=>m.label.includes(query)),[query]);
 return <div className="app-shell">
  <header className="topbar"><div className="brand"><img className="brand-logo" src="/ronaQ-logo.jpg" alt="شعار رونق البصرة" onError={e=>{(e.currentTarget as HTMLImageElement).style.display="none"}} /></div><div className="top-search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="ابحث عن قسم..."/>{query&&<div className="search-results">{filtered.map(m=><button key={m.id} onClick={()=>{open(m.id);setQuery('')}}>{m.label}<ChevronLeft size={15}/></button>)}</div>}</div><div className="top-actions"><button className="icon-btn" title={theme==='light'?'تفعيل الوضع الداكن':'تفعيل الوضع الفاتح'} onClick={toggleTheme}>{theme==='light'?<Moon size={18}/>:<Sun size={18}/>}</button><button className="icon-btn" title="النسخ الاحتياطي وسجل النظام" onClick={()=>open('settings')}><Bell size={18}/><i/></button><button type="button" className="profile profile-button" aria-label="فتح ملف المحاسب" aria-expanded={profileOpen} onClick={()=>setProfileOpen(v=>!v)}><div className="avatar">م</div><span>المحاسب</span></button>{profileOpen&&<div className="profile-menu"><b>ملف المحاسب</b><span>المستخدم الحالي: المحاسب</span><button type="button" onClick={()=>{setProfileOpen(false);open("settings")}}>إعدادات النظام</button><button type="button" onClick={()=>setProfileOpen(false)}>إغلاق</button></div>}</div></header>
  <div className="tabs">{tabs.map(tab=>{const m=modules.find(x=>x.id===tab.moduleId)!;return <div className={'tab '+(activeKey===tab.key?'selected':'')} key={tab.key}><button onClick={()=>setActiveKey(tab.key)}>{m.label}</button>{tab.key!==1&&<button className="tab-close" onClick={()=>close(tab.key)} aria-label={'إغلاق '+m.label}>×</button>}</div>})}</div>
  <main className="main-content"><div className="page-heading"><div><span className="eyebrow">نظام إدارة المصنع</span><h1>{active==='dashboard'?'أهلاً بك في رونق البصرة':current.label}</h1><p>{active==='dashboard'?'نظرة عامة على حركة المصنع وأهم العمليات.':'إدارة عمليات المصنع وحساباته من مكان واحد.'}</p></div><div className="date-chip">{new Intl.DateTimeFormat('ar-IQ-u-nu-latn',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date())}</div></div>
  {tabs.map(tab=><div key={tab.key} className="tab-content" style={{display:activeKey===tab.key?'block':'none'}} aria-hidden={activeKey!==tab.key}>
  {tab.moduleId==='attendance'?<AttendancePanel/>:tab.moduleId==='sales'?<SalesPanel/>:tab.moduleId==='drivers'?<DriversPanel products={products}/>:tab.moduleId==='distributors'?<DistributorsPanel products={products}/>:tab.moduleId==='purchases'?<FinancePanel section="purchases"/>:tab.moduleId==='production-costs'?<FinancePanel section="production-costs"/>:tab.moduleId==='expenses'?<FinancePanel section="expenses"/>:tab.moduleId==='payroll'?<FinancePanel section="payroll"/>:tab.moduleId==='reports'?<ReportsPanel/>:tab.moduleId==='cash'?<CashPanel/>:tab.moduleId==='customers'?<CustomersPanel/>:tab.moduleId==='settings'?<SystemPanel/>:tab.moduleId==='production'?<ProductionPanel products={products} onSaved={async()=>{await refreshInventory();await refreshDashboard()}}/>:tab.moduleId==='warehouse'?<WarehousePanel stock={stock} products={products} movements={movements} pendingReturns={pendingReturns} onRefresh={refreshInventory} onOpenSettings={()=>open('settings')}/>:tab.moduleId==='dashboard'?<><section className="stats-grid">{[{label:'مبيعات اليوم',value:dashboard?money.format(dashboard.salesToday)+' د.ع':'—',sub:'إجمالي فواتير البيع المرحلة',icon:ShoppingCart},{label:'إنتاج اليوم',value:dashboard?money.format(dashboard.productionToday):'—',sub:'إجمالي الكميات المنتجة',icon:Factory},{label:'عدد أصناف المخزن',value:dashboard?money.format(dashboard.stock.length):'—',sub:'الأصناف الفعالة المسجلة',icon:Archive},{label:'رصيد الصندوق',value:dashboard?money.format(dashboard.cashBalance)+' د.ع':'—',sub:'الرصيد النقدي الحالي',icon:Wallet},{label:'ديون الزبائن والسواق',value:dashboard?money.format(dashboard.receivables)+' د.ع':'—',sub:'المبالغ المستحقة للمصنع',icon:HandCoins}].map((x,i)=><article className="stat-card" key={x.label}><div className="stat-icon"><x.icon size={19}/></div><span>{x.label}</span><strong>{x.value}</strong><small>{x.sub}</small></article>)}</section>
  <section className="dashboard-grid"><article className="panel modules-panel"><div className="panel-head"><div><h2>أقسام النظام</h2><p>اختر القسم الذي تريد العمل به</p></div><span className="soft-tag">القائمة الرئيسية</span></div><div className="module-grid">{modules.filter(m=>m.id!=='dashboard').map(m=><button className="module-tile" key={m.id} onClick={()=>open(m.id)}><span className="module-icon"><m.icon size={21}/></span><b>{m.label}</b><ChevronLeft size={15} className="tile-arrow"/></button>)}</div></article><aside className="side-panels"><article className="panel quick-panel"><h2>عمليات سريعة</h2><button onClick={()=>open('sales')}><Plus size={17}/> تسجيل عملية بيع</button><button onClick={()=>open('production')}><Plus size={17}/> تسجيل وجبة إنتاج</button><button onClick={()=>open('expenses')}><Plus size={17}/> تسجيل مصروف</button><button onClick={()=>open('cash')}><Plus size={17}/> تسجيل قبض أو صرف</button></article><article className="panel note-panel"><div className="note-icon"><Activity size={18}/></div><b>حالة النظام</b><p>الأرقام الرئيسية تُقرأ مباشرة من قاعدة البيانات المحلية. راجع التقارير قبل اعتماد النتائج المالية.</p></article></aside></section></>:<section className="panel placeholder"><div className="placeholder-icon"><current.icon size={28}/></div><h2>{current.label}</h2><p>تم تجهيز مكان هذا القسم ضمن الهيكل الأولي. الخطوة التالية هي بناء شاشة العمل، قاعدة البيانات، والتحقق من الحسابات الخاصة به.</p><button className="primary-btn" onClick={()=>open('dashboard')}>العودة للرئيسية</button></section>}
  </div>)}
  </main><footer className="footer"><span><i className="online-dot"/> {dbState==='ready'?'قاعدة البيانات متصلة':dbState==='checking'?'جارٍ فحص قاعدة البيانات':'تعذر فحص قاعدة البيانات'}</span><span className="designer-credit">Design by Alaa Wameed</span><span>RONAQ ERP · الإصدار 0.22.4</span></footer>
 </div>
}
