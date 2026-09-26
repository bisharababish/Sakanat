/** Shared AR/EN for Matra7 web (landing, auth bridges, admin). */
(function (global) {
  const STORAGE = 'matra7.web.lang';

  const dict = {
    ar: {
      'meta.homeTitle': 'مَطْرَح · Matra7',
      'nav.admin': 'تسجيل دخول الإدارة',
      'nav.reset': 'نسيت كلمة المرور',
      'nav.home': 'الرئيسية',
      'hero.lede':
        'سكن طلابي موثوق قرب الجامعات الفلسطينية — بحث، حجز، ومحادثة في مكان واحد.',
      'cta.admin': 'تسجيل دخول الإدارة',
      'cta.app': 'فتح تطبيق مَطْرَح (جوال)',
      'cta.appHint':
        'رابط التطبيق يشتغل على الجوال بعد تثبيت مَطْرَح. من الكمبيوتر استخدم «تسجيل دخول الإدارة».',
      'strip.studentsTitle': 'للطلاب والمستأجرين',
      'strip.studentsBody':
        'اكتشف السكن المناسب لحرمك، احجز بخطوات واضحة، وتواصل مع المالك مباشرة.',
      'strip.ownersTitle': 'للملاك',
      'strip.ownersBody': 'انشر وحداتك، تابع الحجوزات، وأدر المحادثات من تطبيق مَطْرَح.',
      'strip.adminTitle': 'للإدارة',
      'strip.adminBody':
        'مراجعة المستخدمين والإعلانات والحجوزات والبلاغات من المتصفح — نفس قاعدة البيانات.',
      'foot.emailLinks': 'روابط البريد الإلكتروني:',
      'foot.confirm': 'تأكيد الحساب',
      'foot.reset': 'إعادة تعيين كلمة المرور',
      'foot.copy': '© Matra7 · مَطْرَح',
      'lang.ar': 'العربية',
      'lang.en': 'English',

      'confirm.title': 'تم تأكيد بريدك — Matra7',
      'confirm.h1': 'تم تأكيد بريدك',
      'confirm.body': 'حسابك صار جاهز. ارجع لتطبيق مَطْرَح وسجّل الدخول بنفس الإيميل وكلمة المرور.',
      'confirm.open': 'فتح التطبيق',
      'confirm.failTitle': 'ما قدرنا نأكد البريد',
      'confirm.failBody': 'جرب تسجّل الدخول أو اطلب رمز جديد من التطبيق.',

      'reset.title': 'استعادة كلمة المرور — Matra7',
      'reset.h1': 'رجع للتطبيق',
      'reset.body': 'افتح تطبيق مَطْرَح عشان تحط كلمة مرور جديدة.',
      'reset.open': 'فتح التطبيق',
      'reset.failTitle': 'ما قدرنا نفتح الرابط',
      'reset.failBody': 'اطلب رابط جديد من التطبيق.',

      'admin.metaTitle': 'لوحة الإدارة — Matra7',
      'admin.loginTitle': 'تسجيل دخول الإدارة',
      'admin.loginHint': 'ادخل ببريد وكلمة مرور حساب الأدمن (نفس حساب التطبيق).',
      'admin.email': 'البريد',
      'admin.password': 'كلمة المرور',
      'admin.signIn': 'تسجيل الدخول',
      'admin.cfgHint':
        'ضع EXPO_PUBLIC_SUPABASE_URL و EXPO_PUBLIC_SUPABASE_ANON_KEY في بيئة الاستضافة.',
      'admin.brand': 'مَطْرَح · إدارة',
      'admin.nav.overview': 'نظرة عامة',
      'admin.nav.users': 'المستخدمون',
      'admin.nav.listings': 'الإعلانات',
      'admin.nav.bookings': 'الحجوزات',
      'admin.nav.ids': 'تحقق الهوية',
      'admin.nav.reports': 'البلاغات',
      'admin.nav.settings': 'الإعدادات',
      'admin.nav.audit': 'سجل الأدمن',
      'admin.refresh': 'تحديث',
      'admin.logout': 'تسجيل الخروج',
      'admin.overview': 'نظرة عامة',
      'admin.events7': 'أحداث آخر 7 أيام',
      'admin.queues': 'طوابير تحتاج إجراء',
      'admin.users': 'المستخدمون',
      'admin.userSearch': 'بحث اسم / إيميل / هاتف / رقم وطني',
      'admin.allRoles': 'كل الأدوار',
      'admin.role.student': 'طالب',
      'admin.role.renter': 'مستأجر',
      'admin.role.owner': 'مالك',
      'admin.role.admin': 'أدمن',
      'admin.filter.all': 'الكل',
      'admin.filter.ownerPending': 'ملاك بانتظار',
      'admin.filter.suspended': 'موقوفون',
      'admin.filter.idPending': 'هوية بانتظار',
      'admin.newOwner': '+ مالك جديد',
      'admin.col.name': 'الاسم',
      'admin.col.role': 'الدور',
      'admin.col.status': 'الحالة',
      'admin.col.contact': 'تواصل',
      'admin.col.actions': 'إجراءات',
      'admin.fullControl': 'التحكم الكامل',
      'admin.approve': 'اعتماد',
      'admin.reject': 'رفض',
      'admin.suspend': 'إيقاف',
      'admin.restore': 'استعادة',
      'admin.listings': 'الإعلانات',
      'admin.listingSearch': 'بحث عنوان',
      'admin.status.pending': 'بانتظار',
      'admin.status.approved': 'معتمد',
      'admin.status.rejected': 'مرفوض',
      'admin.status.hidden': 'مخفي',
      'admin.status.all': 'الكل',
      'admin.col.title': 'العنوان',
      'admin.col.owner': 'المالك',
      'admin.col.price': 'السعر',
      'admin.hide': 'إخفاء',
      'admin.delete': 'حذف',
      'admin.bookings': 'الحجوزات',
      'admin.allStatuses': 'كل الحالات',
      'admin.status.confirmed': 'مؤكد',
      'admin.status.completed': 'مكتمل',
      'admin.status.cancelled': 'ملغى',
      'admin.col.date': 'التاريخ',
      'admin.col.listing': 'الإعلان',
      'admin.col.student': 'الطالب',
      'admin.col.payment': 'الدفع',
      'admin.confirm': 'تأكيد',
      'admin.complete': 'إكمال',
      'admin.cancel': 'إلغاء',
      'admin.markPaid': 'تم الدفع',
      'admin.ids': 'تحقق الهوية',
      'admin.idsHint': 'طلبات بانتظار المراجعة (وثائق مرفوعة).',
      'admin.col.note': 'ملاحظة',
      'admin.reports': 'البلاغات',
      'admin.report.open': 'مفتوح',
      'admin.report.reviewing': 'قيد المراجعة',
      'admin.report.closed': 'مغلق',
      'admin.col.reason': 'السبب',
      'admin.review': 'مراجعة',
      'admin.close': 'إغلاق',
      'admin.open': 'فتح',
      'admin.settings': 'إعدادات المنصة',
      'admin.commission': 'عمولة المنصة %',
      'admin.adminEmail': 'بريد الأدمن',
      'admin.save': 'حفظ',
      'admin.runOps': 'تشغيل مهام الحجوزات',
      'admin.audit': 'سجل الأدمن',
      'admin.col.time': 'الوقت',
      'admin.col.action': 'الإجراء',
      'admin.col.target': 'هدف',
      'admin.editUser': 'تعديل مستخدم',
      'admin.saveAll': 'حفظ كل التغييرات',
      'admin.activity': 'نشاط مرتبط',
      'admin.danger': 'إجراءات قوية',
      'admin.back': '← رجوع للقائمة',
      'admin.done': 'تم',
      'admin.saved': 'تم الحفظ',
      'admin.notAdmin': 'تعذر تسجيل الدخول. تحقق من البيانات.',
      'admin.loginFail': 'تعذر تسجيل الدخول. تحقق من البيانات.',
      'admin.lockout': 'محاولات كثيرة فاشلة. حاول بعد دقيقة.',
      'admin.denied': 'تعذر تسجيل الدخول. تحقق من البيانات.',
      'admin.idle': 'تم تسجيل الخروج بسبب عدم النشاط.',
      'admin.event': 'الحدث',
      'admin.count': 'العدد',
      'admin.type': 'النوع',
      'admin.details': 'التفاصيل',
      'admin.stat.listings': 'إعلانات',
      'admin.stat.bookings': 'حجوزات',
      'admin.stat.users': 'مستخدمون',
      'admin.stat.chats': 'محادثات',
      'admin.stat.commission': 'عمولة مؤكدة',
      'admin.stat.pendingOwners': 'بانتظار مالك',
      'admin.stat.pendingListings': 'بانتظار إعلان',
      'admin.stat.openReports': 'بلاغات مفتوحة',
      'admin.queue.owners': 'ملاك بانتظار',
      'admin.queue.listings': 'إعلانات بانتظار',
      'admin.queue.bookings': 'حجوزات بانتظار',
      'admin.queue.ids': 'تحقق هوية',
      'admin.queue.reports': 'بلاغات',
      'admin.openQueue': 'فتح',
      'admin.noEvents': 'لا أحداث',
      'admin.noResults': 'لا نتائج',
      'admin.modalCancel': 'إلغاء',
      'admin.modalOk': 'تأكيد',
    },
    en: {
      'meta.homeTitle': 'Matra7 · مَطْرَح',
      'nav.admin': 'Admin sign in',
      'nav.reset': 'Forgot password',
      'nav.home': 'Home',
      'hero.lede':
        'Trusted student housing near Palestinian universities — search, book, and chat in one place.',
      'cta.admin': 'Admin sign in',
      'cta.app': 'Open Matra7 app (mobile)',
      'cta.appHint':
        'The app link works on a phone after Matra7 is installed. On desktop, use Admin sign in.',
      'strip.studentsTitle': 'Students & renters',
      'strip.studentsBody':
        'Find housing near your campus, book in clear steps, and message the owner directly.',
      'strip.ownersTitle': 'Owners',
      'strip.ownersBody': 'List units, track bookings, and manage chats in the Matra7 app.',
      'strip.adminTitle': 'Admins',
      'strip.adminBody':
        'Review users, listings, bookings, and reports in the browser — same database as the app.',
      'foot.emailLinks': 'Email links:',
      'foot.confirm': 'Confirm account',
      'foot.reset': 'Reset password',
      'foot.copy': '© Matra7',
      'lang.ar': 'Arabic',
      'lang.en': 'English',

      'confirm.title': 'Email confirmed — Matra7',
      'confirm.h1': 'Email confirmed',
      'confirm.body': 'Your account is ready. Open Matra7 and sign in with the same email and password.',
      'confirm.open': 'Open the app',
      'confirm.failTitle': 'Could not confirm email',
      'confirm.failBody': 'Try signing in, or request a new code from the app.',

      'reset.title': 'Reset password — Matra7',
      'reset.h1': 'Back to the app',
      'reset.body': 'Open Matra7 to choose a new password.',
      'reset.open': 'Open the app',
      'reset.failTitle': 'Could not open link',
      'reset.failBody': 'Request a new link from the app.',

      'admin.metaTitle': 'Admin — Matra7',
      'admin.loginTitle': 'Admin sign in',
      'admin.loginHint': 'Use your admin email and password (same as the app).',
      'admin.email': 'Email',
      'admin.password': 'Password',
      'admin.signIn': 'Sign in',
      'admin.cfgHint': 'Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in hosting env.',
      'admin.brand': 'Matra7 · Admin',
      'admin.nav.overview': 'Overview',
      'admin.nav.users': 'Users',
      'admin.nav.listings': 'Listings',
      'admin.nav.bookings': 'Bookings',
      'admin.nav.ids': 'ID verify',
      'admin.nav.reports': 'Reports',
      'admin.nav.settings': 'Settings',
      'admin.nav.audit': 'Audit log',
      'admin.refresh': 'Refresh',
      'admin.logout': 'Sign out',
      'admin.overview': 'Overview',
      'admin.events7': 'Events (last 7 days)',
      'admin.queues': 'Queues needing action',
      'admin.users': 'Users',
      'admin.userSearch': 'Search name / email / phone / ID',
      'admin.allRoles': 'All roles',
      'admin.role.student': 'Student',
      'admin.role.renter': 'Renter',
      'admin.role.owner': 'Owner',
      'admin.role.admin': 'Admin',
      'admin.filter.all': 'All',
      'admin.filter.ownerPending': 'Owners pending',
      'admin.filter.suspended': 'Suspended',
      'admin.filter.idPending': 'ID pending',
      'admin.newOwner': '+ New owner',
      'admin.col.name': 'Name',
      'admin.col.role': 'Role',
      'admin.col.status': 'Status',
      'admin.col.contact': 'Contact',
      'admin.col.actions': 'Actions',
      'admin.fullControl': 'Full control',
      'admin.approve': 'Approve',
      'admin.reject': 'Reject',
      'admin.suspend': 'Suspend',
      'admin.restore': 'Restore',
      'admin.listings': 'Listings',
      'admin.listingSearch': 'Search title',
      'admin.status.pending': 'Pending',
      'admin.status.approved': 'Approved',
      'admin.status.rejected': 'Rejected',
      'admin.status.hidden': 'Hidden',
      'admin.status.all': 'All',
      'admin.col.title': 'Title',
      'admin.col.owner': 'Owner',
      'admin.col.price': 'Price',
      'admin.hide': 'Hide',
      'admin.delete': 'Delete',
      'admin.bookings': 'Bookings',
      'admin.allStatuses': 'All statuses',
      'admin.status.confirmed': 'Confirmed',
      'admin.status.completed': 'Completed',
      'admin.status.cancelled': 'Cancelled',
      'admin.col.date': 'Date',
      'admin.col.listing': 'Listing',
      'admin.col.student': 'Student',
      'admin.col.payment': 'Payment',
      'admin.confirm': 'Confirm',
      'admin.complete': 'Complete',
      'admin.cancel': 'Cancel',
      'admin.markPaid': 'Mark paid',
      'admin.ids': 'ID verification',
      'admin.idsHint': 'Pending requests with uploaded documents.',
      'admin.col.note': 'Note',
      'admin.reports': 'Reports',
      'admin.report.open': 'Open',
      'admin.report.reviewing': 'Reviewing',
      'admin.report.closed': 'Closed',
      'admin.col.reason': 'Reason',
      'admin.review': 'Review',
      'admin.close': 'Close',
      'admin.open': 'Reopen',
      'admin.settings': 'Platform settings',
      'admin.commission': 'Platform commission %',
      'admin.adminEmail': 'Admin email',
      'admin.save': 'Save',
      'admin.runOps': 'Run booking jobs',
      'admin.audit': 'Audit log',
      'admin.col.time': 'Time',
      'admin.col.action': 'Action',
      'admin.col.target': 'Target',
      'admin.editUser': 'Edit user',
      'admin.saveAll': 'Save all changes',
      'admin.activity': 'Related activity',
      'admin.danger': 'Danger zone',
      'admin.back': '← Back to list',
      'admin.done': 'Done',
      'admin.saved': 'Saved',
      'admin.notAdmin': 'Sign-in failed. Check your credentials.',
      'admin.loginFail': 'Sign-in failed. Check your credentials.',
      'admin.lockout': 'Too many failed attempts. Try again in a minute.',
      'admin.denied': 'Sign-in failed. Check your credentials.',
      'admin.idle': 'Signed out due to inactivity.',
      'admin.event': 'Event',
      'admin.count': 'Count',
      'admin.type': 'Type',
      'admin.details': 'Details',
      'admin.stat.listings': 'Listings',
      'admin.stat.bookings': 'Bookings',
      'admin.stat.users': 'Users',
      'admin.stat.chats': 'Chats',
      'admin.stat.commission': 'Confirmed commission',
      'admin.stat.pendingOwners': 'Owners pending',
      'admin.stat.pendingListings': 'Listings pending',
      'admin.stat.openReports': 'Open reports',
      'admin.queue.owners': 'Owners pending',
      'admin.queue.listings': 'Listings pending',
      'admin.queue.bookings': 'Bookings pending',
      'admin.queue.ids': 'ID verify',
      'admin.queue.reports': 'Reports',
      'admin.openQueue': 'Open',
      'admin.noEvents': 'No events',
      'admin.noResults': 'No results',
      'admin.modalCancel': 'Cancel',
      'admin.modalOk': 'Confirm',
    },
  };

  function detect() {
    try {
      const saved = localStorage.getItem(STORAGE);
      if (saved === 'ar' || saved === 'en') return saved;
    } catch (_) {}
    const nav = (navigator.language || 'ar').toLowerCase();
    return nav.startsWith('en') ? 'en' : 'ar';
  }

  let lang = detect();

  function t(key, fallback) {
    const pack = dict[lang] || dict.ar;
    return pack[key] ?? dict.ar[key] ?? fallback ?? key;
  }

  function apply(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (!key) return;
      el.textContent = t(key);
    });
    scope.querySelectorAll('[data-i18n-html]').forEach((el) => {
      const key = el.getAttribute('data-i18n-html');
      if (!key) return;
      el.innerHTML = t(key);
    });
    scope.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (!key) return;
      el.setAttribute('placeholder', t(key));
    });
    scope.querySelectorAll('[data-i18n-title]').forEach((el) => {
      const key = el.getAttribute('data-i18n-title');
      if (!key) return;
      document.title = t(key);
    });
    scope.querySelectorAll('[data-lang-active]').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-lang-active') === lang);
      btn.setAttribute('aria-pressed', btn.getAttribute('data-lang-active') === lang ? 'true' : 'false');
    });
  }

  function setLang(next) {
    if (next !== 'ar' && next !== 'en') return;
    lang = next;
    try {
      localStorage.setItem(STORAGE, lang);
    } catch (_) {}
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    apply(document);
    document.querySelectorAll('[data-lang-switch]').forEach((wrap) => {
      wrap.querySelectorAll('.lang-btn').forEach((btn) => {
        const code = btn.getAttribute('data-lang-active');
        btn.textContent = t(code === 'en' ? 'lang.en' : 'lang.ar');
        btn.classList.toggle('active', code === lang);
        btn.setAttribute('aria-pressed', code === lang ? 'true' : 'false');
      });
    });
    global.dispatchEvent(new CustomEvent('matra7:lang', { detail: { lang } }));
  }

  function mountSwitchers(selector) {
    document.querySelectorAll(selector || '[data-lang-switch]').forEach((wrap) => {
      wrap.innerHTML =
        '<button type="button" class="lang-btn" data-lang-active="ar" aria-label="Arabic"></button>' +
        '<button type="button" class="lang-btn" data-lang-active="en" aria-label="English"></button>';
      wrap.querySelectorAll('.lang-btn').forEach((btn) => {
        const code = btn.getAttribute('data-lang-active');
        btn.textContent = t(code === 'en' ? 'lang.en' : 'lang.ar');
        btn.classList.toggle('active', code === lang);
        btn.addEventListener('click', () => setLang(code));
      });
    });
    apply(document);
  }

  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';

  global.Matra7I18n = {
    t,
    get lang() {
      return lang;
    },
    setLang,
    apply,
    mountSwitchers,
  };
})(window);
