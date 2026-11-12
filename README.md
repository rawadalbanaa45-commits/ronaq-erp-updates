# RONAQ ERP — نظام إدارة مصنع رونق البصرة

تطبيق سطح مكتب محلي يعمل دون اتصال بالإنترنت، مبني باستخدام Electron وReact وTypeScript وSQLite.

## ما يعمل في الإصدار 0.4.0
- واجهة عربية RTL مع هوية المصنع الأصلية.
- قاعدة بيانات SQLite محلية مع تفعيل المفاتيح الأجنبية وWAL.
- تسجيل وجبات إنتاج متعددة الأصناف، وتحديث المخزون تلقائياً.
- أرصدة المخزن وحركاته اليومية.
- تسجيل الراجع بحالة انتظار، ولا يدخل المخزون إلا بعد قبوله بالفحص.
- إنشاء فواتير البيع للزبون المباشر أو الزبون المعروف أو الموزع.
- أسعار مرنة لكل فاتورة مع حفظ السعر التاريخي.
- بيع نقدي أو آجل أو جزئي، مع تسجيل المقبوض في الصندوق والدفعات في سجل مستقل.
- منع البيع الذي يتجاوز الرصيد حتى على مستوى SQLite.
- ترقيم فواتير متسلسل حسب السنة، وسجل تدقيق للعمليات الأساسية.

## غير مكتمل بعد
إدارة السواق والمطابقات اليومية، اتفاقيات الموزعين وسحوباتهم، المشتريات والموردون، المصروفات والرواتب، التكاليف الإنتاجية، التقارير المالية النهائية، النسخ الاحتياطي والاستعادة المجربة، وإعدادات التشغيل. لذلك هذا الإصدار تطويري ولا يُستخدم بعد كنسخة تشغيل رسمية للمصنع.

## المتطلبات
- Windows 10/11 x64 لبناء وتشغيل النسخة النهائية.
- Node.js LTS وnpm.

## التطوير
```bash
npm install
npm run dev
```

## الفحص
```bash
npm run test:db
npm run typecheck
npm run build
```

## إنشاء مثبت Windows
من جهاز Windows بعد تثبيت الاعتماديات:
```bash
npm run dist:win
```
ينتج المثبت داخل مجلد `release/`. يجب اختبار المثبت على جهاز Windows نظيف قبل تسليم بيانات المصنع الحقيقية.

## البيانات
قاعدة البيانات تحفظ داخل مجلد بيانات المستخدم الخاص بالتطبيق، وليس داخل مجلد تثبيت البرنامج. لا تحذف مجلد البيانات عند تحديث التطبيق.

## 0.5.0 — Driver operations (development build)
- Driver records are stored as parties with the driver type.
- Each driver can receive multiple loads per day. Every load can include several products and is deducted from central stock by a database trigger in the same transaction.
- Daily sheets keep cash sales, credit sales, collections of old debts, expenses, and cash delivered as separate values.
- Expected cash and the cash difference are calculated from the saved figures. A sheet can be closed; changing a closed sheet requires a correction reason and creates an audit entry.
- Driver screens are now connected to the local database. This is still a development build: distributor agreements, full accounting integration, backups/restore, reports, and Windows packaging remain unfinished and must be tested.


## 0.6.0 development scope
- Distributor profiles and distributor-owned driver records.
- Multiple concurrent agreements with product-specific frozen unit prices and quantities.
- Agreement-specific payments and cash-box entries.
- Multiple pickups per agreement with driver/vehicle snapshots and stock deduction.
- Partial refunds limited by both paid amount and value of undelivered goods.
- This is a development build; full Electron/Windows installer and target-machine acceptance tests remain outstanding.


## Version 0.7.0 development additions
- Supplier master records, raw-material catalogue and quantity ledger.
- Purchase invoices with partial payments and supplier balances. Purchase invoices add to raw-material inventory and supplier payable; they are not posted directly as operating expense or COGS.
- Flexible expense categories, fuel subtype, driver/vehicle association and cash-out linkage.
- Employee records and salary payment history linked to cash-out.
- Finance services exposed through the isolated Electron preload bridge.

This remains a development build. The UI and SQLite smoke tests are not a substitute for Windows packaging and factory acceptance testing.

## Version 0.8.0 — Cash box and management reports
- Cash box screen lists receipts and payments and allows a manual receipt/payment voucher with a business date and description.
- A one-time opening cash balance is supported; the service prevents recording a second opening balance.
- Financial report supports a custom date range and summarizes invoice revenue, distributor pickups, recorded production cost, operating expenses, salaries, cash balance, receivables and supplier payables.
- Product cost-of-sales is currently an estimate using the weighted average of manually recorded production costs per product through the report end date. The report explicitly labels this limitation; the result must not be treated as a final audited profit figure until the factory confirms its costing policy and enters complete production costs.
- Dashboard summary API exposes today's sales, production quantity, current cash, stock balances and invoice receivables.
- Reports and cash-box UI are connected to the local SQLite service layer.

## Current release status
0.8.0 is a development build. SQLite schema and accounting-input smoke tests pass. The Electron/React TypeScript build has not yet been verified in this environment because dependencies are not installed here. Windows installer creation, backup/restore, PDF/printing, complete opening balances (including customer/distributor/supplier balances and stock valuation), and factory acceptance testing remain to be completed. Do not use it as the factory's official accounting system yet.

## 0.9.0-dev — النظام والنسخ الاحتياطي والأرصدة الافتتاحية

- أضيفت خدمة إنشاء نسخة SQLite متسقة باستخدام واجهة النسخ الاحتياطي للمكتبة، ثم فتح النسخة للقراءة وفحص `integrity_check` و`foreign_key_check` قبل اعتماد اسمها النهائي.
- تُحفظ النسخ المحلية داخل مجلد `backups` ضمن بيانات المستخدم، ويُحتفظ بآخر 30 نسخة ناجحة. النسخ الفاشلة لا تستبدل النسخ السليمة.
- أضيف سجل للنسخ الاحتياطية الناجحة والفاشلة، وسجل تدقيق قابل للعرض، وواجهة أولية ضمن الإعدادات.
- أضيفت جداول وخدمة تسجيل دفعة الأرصدة الافتتاحية: الصندوق، مخزون المنتجات الجاهزة، المواد الأولية، وأرصدة الأطراف المدينة/الدائنة. تمنع الخدمة إنشاء دفعة افتتاحية ثانية؛ التصحيحات اللاحقة يجب أن تتم كتسويات موثقة.
- أضيفت واجهات IPC وpreload لهذه الوظائف.

### ما لم يكتمل بعد في هذه النسخة

- واجهة إدخال الأرصدة الافتتاحية التفصيلية وربط أرصدة الأطراف بكشوف الحساب والتقارير.
- جدولة النسخ التلقائي اليومية وأثناء العمل، واكتشاف USB والنسخ إليه.
- استعادة النسخة الاحتياطية بعملية تحقق ونسخة أمان قبل الاستعادة.
- اختبار TypeScript/Electron وبناء مثبت Windows؛ لا توجد `node_modules` في بيئة البناء الحالية، لذلك لم يتم ادعاء نجاح build أو installer.

### الاختبارات

شغّل `npm run test:db` لاختبارات المخطط الأساسية. كما يمكن تشغيل `python tests/system_stage_smoke.py` لاختبار جداول سجل النسخ والأرصدة الافتتاحية. هذه اختبارات SQLite وليست بديلاً عن اختبار التطبيق على Windows.


## الإصدار 0.10.0 — الاستعادة والنسخ التلقائي
- نسخ احتياطي دوري كل 6 ساعات أثناء تشغيل التطبيق.
- محاولة إنشاء نسخة احتياطية وفحصها قبل إغلاق التطبيق.
- استعادة نسخة ناجحة مسجلة فقط، بعد فحص سلامة SQLite والعلاقات المرجعية.
- إنشاء نسخة أمان من قاعدة البيانات الحالية قبل الاستعادة.
- نسخ الملف المستعاد إلى ملف مرحلي وإعادة فحصه قبل استبدال قاعدة البيانات.
- إعادة تشغيل التطبيق بعد نجاح الاستعادة.

**حدود الاختبار:** اختبارات SQLite النصية واختبارات عقد الاستعادة نجحت في بيئة التطوير. لم يُختبر بعد سلوك إغلاق Electron وإعادة تشغيله أو استعادة قاعدة البيانات على Windows فعلياً؛ يجب إجراء اختبار قبول على نسخة تجريبية قبل اعتماد بيانات المصنع. النسخ إلى USB عند توصيله ما زال غير مكتمل.


## 0.10.0-dev — الاستعادة الآمنة والنسخ الدوري
- نسخ احتياطي تلقائي كل 6 ساعات أثناء تشغيل البرنامج.
- محاولة إنشاء نسخة احتياطية وفحصها قبل إغلاق التطبيق.
- استعادة النسخ الناجحة المسجلة فقط؛ لا يقبل النظام مسار ملف عشوائياً من الواجهة.
- التحقق من `integrity_check` و`foreign_key_check` قبل الاستعادة.
- تجهيز النسخة في ملف مرحلي وإعادة فحصها، ثم إنشاء نسخة أمان من البيانات الحالية قبل الاستبدال.
- إعادة تشغيل التطبيق بعد نجاح الاستعادة.
- إصلاح تهيئة قاعدة البيانات بحيث تُفتح مرة واحدة عند بدء التطبيق.

### الاختبارات والحدود
نجحت اختبارات SQLite واختبارات عقد الاستعادة والنسخ الدوري في بيئة التطوير. لم يُنفذ بعد اختبار فعلي لعملية Electron relaunch أو استعادة قاعدة البيانات على Windows، ولم يُبنَ مثبت Windows في هذه البيئة لعدم تثبيت الاعتماديات. اكتشاف USB والنسخ إليه ما زالان غير مكتملين. لا تعتمد هذه النسخة لتشغيل المصنع قبل اختبار قبول على جهاز Windows ونسخة بيانات تجريبية.


## الإصدار 0.11.0-dev — طباعة فواتير البيع
- إضافة استعلام آمن لتفاصيل الفاتورة يتضمن بيانات الجهة، بنود الفاتورة، الدفعات، والمقبوض والمتبقي.
- إضافة زر «عرض / طباعة» لكل فاتورة في قائمة مبيعات اليوم.
- إنشاء معاينة فاتورة عربية RTL بشعار رونق البصرة، جدول المواد، الأسعار، الإجمالي، المقبوض والمتبقي.
- دعم طباعة A5 أو اختيار «Save as PDF» من نافذة الطباعة في Windows.
- إزالة الاعتماد على Google Fonts وقت التشغيل؛ خط Cairo يُحمّل من حزمة `@fontsource/cairo` المحلية حتى تبقى الواجهة مستقلة عن الإنترنت.

### الاختبارات والحدود
اختبارات SQLite السابقة واختبار بيانات الفاتورة وتنسيق A5 نجحت. تعذر إكمال تثبيت حزم Node ضمن مهلة البيئة، لذلك لم يتم تأكيد فحص TypeScript أو بناء Electron أو إنشاء مثبت Windows. يجب اختبار الطباعة الفعلية على طابعة المصنع وLBP6030، وضبط إعداد الورق وهوامش الطباعة قبل التسليم.


## 0.12.0 development notes
- Added a complete opening-balance entry workflow in System Settings for cash, finished goods, raw materials, and party receivable/payable balances.
- Added read-only opening-balance status and party-list IPC endpoints.
- Added strict date/integer validation and duplicate-line prevention for opening balances.
- Rolled forward opening receivables/payables into dashboard and financial-report outstanding balances.
- Added `tests/opening_balance_stage_smoke.py`.
- SQLite/schema smoke tests pass in the available Python environment. Electron/TypeScript build and Windows installer remain unverified because Node.js/npm are not available in this runtime.


## 0.13.0 development notes
- Added Windows removable USB drive detection using the built-in PowerShell/CIM logical-disk provider (DriveType=2).
- The app checks connected removable drives at startup and every 60 seconds, copies the latest verified local SQLite backup to `RONAQ-Backups`, checks free space, stages as a unique `.partial` file, rechecks SQLite integrity/foreign keys, and only then promotes the file.
- Existing valid generations are retained; an invalid destination is not overwritten. USB copies are recorded in the audit log.
- A final local backup is copied to a connected USB on application exit.
- Added USB status/manual scan controls to System Settings.
- Added an Arabic management financial report with factory logo and browser print / Save as PDF (A4); invoice print remains A5.
- Added smoke tests for USB backup and report printing.


## 0.14.0 development notes
- Dashboard KPIs now load from the local database: today's posted sales, today's production, active product count, current cash balance, and customer receivables including opening balances.
- Warehouse overview now calculates today's inbound and outbound quantities from stock-summary data instead of placeholder dashes.
- Dashboard refreshes when returning to the home tab and after production is recorded.
- Replaced the hard-coded dashboard date with the current local date; backend report date uses local machine date rather than UTC date.
- Added `tests/dashboard_live_stage_smoke.py`.

## 0.15.0-dev — تسويات المخزن وفحص المرتجعات
- ربط زر الرصيد الافتتاحي مباشرة بواجهة الأرصدة الافتتاحية ضمن الإعدادات بدلاً من تركه دون إجراء.
- إضافة تسوية مخزنية بالزيادة أو النقصان، مع اشتراط سبب واضح، والتحقق من الصنف والكمية، ومنع خفض الرصيد إلى قيمة سالبة.
- حفظ قيمة الرصيد قبل التسوية وبعدها في سجل التدقيق، وتسجيل الحركة ضمن سجل حركات المخزن.
- عرض المرتجعات المعلقة في شاشة المخزن، مع قبولها بعد الفحص لإضافة الكميات المقبولة فقط، أو رفضها دون تغيير الرصيد.
- إضافة تسميات واضحة لحركات التسوية في سجل المخزن.
- أضيف اختبار تعاقدي `warehouse_adjustment_stage_smoke.py`، ونجحت اختبارات smoke التسعة في هذه المرحلة.

**حدود هذه النسخة:** الاختبارات الحالية تتحقق من العقود والربط وبعض قواعد SQLite، لكنها لا تثبت تشغيل واجهة Electron فعلياً. لم يُنفذ بعد build للواجهة أو مثبت Windows في هذه البيئة، ولم يتم اختبار أجهزة المصنع أو طباعة فعلية. هذه نسخة تطوير وليست نسخة تشغيل نهائية.


## 0.16.0-dev — العملاء وكشوف الحساب والتحصيل

- إضافة شاشة فعلية للعملاء المسجلين، مع إنشاء ملف زبون ومنع تكرار الاسم النشط.
- عرض إجمالي المبيعات والمقبوض والدين المتبقي اعتماداً على فواتير البيع المرحلة فقط.
- كشف حساب لكل زبون يتضمن الفواتير والتحصيلات، مع تصفية بالتاريخ وطباعة الكشف.
- تسجيل تحصيل جزئي أو كامل مرتبط بفاتورة محددة، باستخدام مسار التحصيل النقدي الموجود حتى يبقى رصيد الصندوق وسجل التدقيق متزامنين.
- إضافة اختبارات تحقق من ربط الخدمة وواجهة IPC والواجهة الأمامية.
- إصلاح أخطاء تركيبية كانت تمنع تحليل TypeScript في تسوية المخزون وملف الإعدادات، واستكمال تعريفات واجهة المخزون في الأنواع المشتركة.

**حدود التحقق:** اجتازت اختبارات التحقق النصية/الهيكلية العشرة، لكن لم ينفذ بناء Electron/React بعد في هذه البيئة لعدم توفر `node_modules`. يجب تشغيل `npm install` ثم `npm run build` على جهاز التطوير، وبعدها اختبار البرنامج وقاعدة بيانات تجريبية على Windows قبل اعتماد نسخة تشغيل للمصنع.

## 0.17.0-dev — هوية التبويبات وإدارة الإغلاق

- تحويل التبويبات من الاعتماد على اسم القسم وحده إلى معرف فريد لكل تبويب؛ يمكن فتح أكثر من نسخة من القسم نفسه دون تضارب في مفاتيح React.
- جعل التبديل والإغلاق يعتمد على هوية التبويب، مع اختيار التبويب المجاور عند إغلاق التبويب النشط.
- منع إغلاق تبويب الرئيسية الأساسي، وتحديث أزرار الانتقال الداخلي لتفتح تبويباً واضحاً بدلاً من تغيير اسم القسم النشط مباشرة.
- إضافة اختبار `tab_identity_stage_smoke.py` للتحقق من هوية التبويبات وإدارة الإغلاق.

**حدود هذه المرحلة:** التبويبات أصبحت مميزة ويمكن فتح نسخ متعددة من القسم، لكن محتوى الشاشة لا يزال يعاد تركيبه عند التبديل؛ لذلك لا نعتبر حفظ حالة النماذج غير المحفوظة مكتملاً بعد. المرحلة التالية مخصصة لإبقاء شاشات التبويبات مركبة وحفظ حالة كل نسخة بشكل مستقل، ثم اختبار البناء الفعلي.


## 0.19.0-dev — الاحتفاظ بحالة التبويبات

- إبقاء محتوى كل تبويب مركباً أثناء الانتقال بين التبويبات، وإخفاء التبويبات غير النشطة بدلاً من إلغاء تركيب مكوناتها. هذا يحافظ على حالة النماذج المحلية ومحتوى الشاشات المفتوحة عند التنقل.
- دعم فتح أكثر من تبويب من القسم نفسه مع فصل حالة المكونات ذات الحالة المحلية عبر مفتاح التبويب الفريد.
- السماح بإغلاق تبويب رئيسية إضافي، مع حماية تبويب الرئيسية الأساسي فقط.
- إضافة اختبار عقدي للتحقق من استمرار تركيب محتويات التبويبات.

**حدود التحقق:** لا يزال يلزم بناء React/Electron وتشغيل اختبارات تكامل واجهة المستخدم على Windows. النماذج المبنية على حالة مشتركة في مكون App (مثل نموذج الإنتاج/تسوية المخزن) تبقى محفوظة عند التنقل، لكنها ليست مستقلة بين نسختين من القسم نفسه؛ يجري فصلها في مراجعة لاحقة.


## 0.19.0-dev — حفظ التبويبات وتكاليف الإنتاج

- إبقاء محتوى كل تبويب مركباً أثناء التنقل، حتى لا تفقد النماذج المفتوحة حالتها عند الانتقال إلى قسم آخر.
- فصل نموذج الإنتاج وتسوية المخزون إلى مكونات مستقلة؛ كل نسخة مفتوحة من القسم تحتفظ بمدخلاتها الخاصة.
- إضافة قسم تكاليف الإنتاج: يسجل المحاسب المنتج وتاريخ الإنتاج والكمية وإجمالي التكلفة، ويحسب النظام تكلفة الوحدة ويحتفظ بسجل تدقيق.
- تحسين التقرير المالي: لا يعرض صافي ربح معتمد إذا كانت تكلفة أي منتج مباع غير مسجلة؛ يوضح المنتجات الناقصة بدلاً من إظهار ربح مضلل.
- توحيد تاريخ اليوم الافتراضي على التاريخ المحلي للجهاز في المبيعات التشغيلية والإنتاج والسواق والموزعين والصندوق والإعدادات والتقارير.
- إضافة اختبارات عقدية لحفظ التبويبات وتكاليف الإنتاج وحماية التقرير المالي وفحص التواريخ المحلية.

**نتيجة التحقق:** نجحت اختبارات Python العقدية، كما اجتاز 25 ملف TypeScript/TSX فحص التحويل النحوي دون أخطاء. تعذر تثبيت اعتماديات npm ضمن مهلة بيئة العمل؛ لذلك لم يكتمل فحص الأنواع الكامل أو بناء Electron/Windows Installer.

- ربط النقد الذي يسلّمه السائق فعلياً بالمطابقة اليومية بحركة قبض في الصندوق، وربط أي تعديل لاحق بحركة فرق مستقلة دون حذف الحركة الأصلية.
- إضافة مبيعات السواق المسجلة بالمطابقة إلى تفصيل إيرادات التقرير، مع إيقاف عرض صافي الربح إذا لم تتوفر كميات وتكلفة تفصيلية تسمح بحساب تكلفة هذه المبيعات.

- إضافة شاشة تسديد لاحق للمجهزين، مع اختيار الفاتورة المستحقة أو تسجيل دفعة عامة على رصيد المجهز، وتحديث سجل الدفعات ورصيد المجهز.
- إضافة تسجيل البضاعة الراجعة من السائقين والموزعين، وإرسالها إلى قائمة الفحص بالمخزن؛ لا تزيد الأرصدة إلا بعد قبولها.
- ربط النقد المسلّم من السائق بالمطابقة اليومية بحركة قبض فعلية في الصندوق، وإنشاء حركة فرق مستقلة عند تصحيح قيمة التسليم.
- إدراج مبيعات السواق وذممهم الإجمالية في التقرير ولوحة الرئيسية، مع تنبيه صريح بعدم تكرار إدخال مبيعات السواق كفواتير مستقلة.

- إصلاح احتساب المقبوضات: المدفوع نقداً فقط يضيف حركة إلى الصندوق؛ البطاقة والتحويل تبقيان مسجلتين كوسيلة دفع في الفاتورة دون زيادة رصيد النقد الفعلي. ينطبق ذلك على الدفعة الأولى والتحصيل اللاحق.

- إضافة سجل دفعات واستلامات واسترجاعات داخل تفاصيل كل اتفاقية موزع، وإتاحة اختيار سائق الموزع المحفوظ عند تسجيل الاستلام مع الاحتفاظ باسم السائق والمركبة لكل حركة.

- منع تسليم الموزع كمية تتجاوز قيمة الدفعات الصافية المسجلة على الاتفاقية بعد طرح الاسترجاعات؛ لا يكفي وجود كمية متبقية في الاتفاقية وحدها.

- إظهار حقل سبب تعديل المطابقة اليومية المغلقة للسائق، وتمريره إلى الخدمة التي تمنع التعديل بعد الإغلاق إذا لم يُكتب السبب، مع الاحتفاظ بسجل القيم القديمة والجديدة.

- تطوير المطابقة اليومية للسواق لتسجيل تفاصيل كل عملية بيع: اسم المحل/الزبون، المنتج، الكمية، سعر الوحدة، نقدي/آجل، ورقم الوصل؛ ويحسب النظام مجاميع النقدي والآجل ويتحقق من تطابقها قبل الحفظ.
- إضافة عرض تفاصيل المطابقة المحفوظة، وربط كميات مبيعات السواق بتكلفة المنتج في التقرير؛ لا يبقى الربح غير متاح بسبب مبيعات السواق إلا إذا كانت هناك مبيعات إجمالية قديمة بلا تفاصيل.

- إضافة تبديل الوضع الفاتح/الداكن وحفظ اختيار المحاسب في إعدادات قاعدة البيانات المحلية، مع تطبيق المظهر عند تشغيل البرنامج.


## 0.19.0-dev — تحسين العمليات والتجهيز للبناء

- تفصيل مبيعات السواق لكل محل/زبون مع المنتج والكمية والسعر ونوع الدفع ورقم الوصل، وعرض سجل المطابقة التفصيلي.
- ربط تفاصيل مبيعات السواق بكميات المنتجات في تكلفة البضاعة المباعة؛ وتظل الأرباح غير معتمدة عند وجود مبيعات إجمالية قديمة غير مفصلة أو تكلفة منتج مفقودة.
- إضافة سجل الدفعات والاستلامات والاسترجاعات لاتفاقيات الموزعين، واختيار السائق المحفوظ، ومنع التسليم قبل تغطية قيمة الكمية بالدفعات الصافية.
- إضافة تسجيل الراجع من السواق والموزعين وإرساله للفحص قبل إعادة المخزون.
- إضافة تسديد لاحق للمجهزين، وتصحيح تسجيل المقبوضات غير النقدية حتى لا تزيد الصندوق النقدي.
- تحديث المخزون ولوحة الرئيسية عند العودة إلى تبويباتها، وإضافة وضع داكن محفوظ.
- تجهيز أيقونة Windows من شعار المصنع الأصلي وسكربت `build-windows.bat` لبناء مثبت NSIS على جهاز Windows.

**ملاحظة البناء:** لم يُنفّذ مثبت Windows بعد؛ يحتاج إلى تثبيت اعتماديات npm وElectron على جهاز Windows وتشغيل `build-windows.bat`.

- إضافة أسعار بيع معتمدة للسواق حسب المنتج، محفوظة في إعدادات المصنع؛ عند تحديد السعر يمنع النظام تسجيل سعر مختلف في تفاصيل المطابقة اليومية.

## 0.20.0 — تجربة تطويرية
- إضافة قسم حضور وغياب العمال: إضافة عامل، أيام الأسبوع السبعة، حضور/غياب/إجازة، وقت دخول وخروج، تعديل السجل، وتدقيق التعديلات.
- إضافة منتج جديد من المخزن بوحدة قياس، ويظهر في باقي قوائم المنتجات.
- تبسيط رقم فاتورة البيع الجديدة إلى تسلسل 1، 2، 3 ... (الفواتير القديمة تحتفظ بأرقامها التاريخية).
- إظهار تاريخ ووقت إنشاء الفاتورة في القائمة والمعاينة.
- منع البيع الآجل/الجزئي دون زبون مسجل من جهة قاعدة البيانات.
- هذه نسخة مصدر تجريبية، ليست مثبت Windows ولا اعتماداً نهائياً. لم يتم اختبار Electron على Windows في هذه البيئة.
- متبقٍ للتطوير: تحرير/إلغاء الفواتير بعكس الحركات المالية والمخزنية، تقرير المدير المفصل، مشاركة PDF المباشرة، تحسين الحفظ، وتحقيق مشكلة حفظ الإنتاج المتكررة. يجب عدم استخدامها على بيانات المصنع الحقيقية قبل الاختبار والنسخ الاحتياطي.

## 0.21.0 — تبسيط تقارير الإدارة
- إعادة تصميم التقرير ليبدأ بملخص المدير بدل الجداول المحاسبية المتعددة.
- عرض المبيعات والمصاريف والرواتب والربح التقديري والمقبوضات والمدفوعات ورصيد الصندوق والديون بأسماء واضحة.
- إضافة فترات جاهزة: اليوم، هذا الأسبوع، هذا الشهر، مع إمكانية تحديد فترة مخصصة.
- إضافة تبويب منفصل لتفاصيل المحاسب، حتى تبقى البيانات التفصيلية متاحة دون إرباك المدير.
- إضافة مقارنة الكميات المنتجة والمباعة لكل مادة في الفترة المختارة.
- إظهار تنبيه مفهوم عندما لا تتوفر تكلفة إنتاج كافية لحساب الربح، بدلاً من إظهار رقم غير موثوق.
- تحسين تخطيط التقرير للطباعة وحفظ PDF.
- نسخة تطويرية؛ يلزم تشغيل build واختبارها على Windows قبل اعتمادها.


## 0.22.0-dev — كشف ديون الزبائن بالتفصيل
- ربط كشف حساب الزبون بالفواتير المسجلة باسمه؛ الدين المتبقي محسوب مباشرة من إجمالي الفاتورة ناقص المقبوض.
- إظهار تاريخ ووقت إنشاء الفاتورة ووقت تسجيل كل دفعة قبض.
- إضافة زر «عرض المواد» داخل كل فاتورة لعرض المنتجات والكميات وأسعار الوحدات والإجماليات.
- إبقاء سجل الدفعات مرتبطاً برقم الفاتورة، مع تحديث الرصيد بعد كل تحصيل.
- أضيف اختبار عقدي لعرض تفاصيل الفواتير والمواد والأوقات.


## إدارة التطبيق والتحديثات عن بُعد (0.22.1)
- زر إعادة تشغيل التطبيق موجود في الإعدادات. الإغلاق الاعتيادي ينشئ نسخة احتياطية قبل الخروج.
- التحديثات تستخدم `electron-updater` عبر خادم ملفات ثابت HTTPS (Generic provider).
- يلزم تثبيت الاعتماديات ثم بناء Windows NSIS installer. ينشئ electron-builder ملفات التحديث مثل `latest.yml` وملف Setup وملفات blockmap.
- يجب نشر **كل ملفات الإصدار الناتجة معاً** في مجلد واحد على استضافة HTTPS ثابتة، بما فيها `latest.yml` وملف Setup وأي `.blockmap` المشار إليه في manifest. لا ترفع ملف Setup وحده.
- أدخل عنوان المجلد المنشور في الإعدادات على جهاز المحاسب. بعد حفظه، يفحص التطبيق التحديثات عند التشغيل وكل 12 ساعة، ويمكن الفحص يدوياً. التنزيل والتثبيت يحتاجان موافقة المحاسب، وقبل التثبيت تُنشأ نسخة قاعدة بيانات ويُوقف التثبيت إذا لم يتم التحقق منها.
- لا يزال عنوان الاستضافة الفعلي مطلوباً قبل تفعيل التحديثات الحقيقية. لا تستخدم `https://updates.example.com/ronaq/`؛ إنه عنوان توضيحي فقط. يجب استخدام عنوان HTTPS تملكه وتستطيع رفع ملفات الإصدارات إليه.
- لا تغيّر `appId` أو مسار `userData` أو اسم ملف SQLite بين الإصدارات حتى تبقى بيانات المحاسب محفوظة. يجب اختبار كل إصدار على نسخة احتياطية قبل نشره.
