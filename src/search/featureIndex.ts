import type { IconName } from '@/components/ui/Icon';

/**
 * Every place in the teacher app a person may look for, with the words they would type
 * for it (founder 2026-10-10: «a smart search … any feature or any keywords related to
 * that feature»). Titles are the menu's own i18n keys, so a result reads exactly like the
 * row it opens; keywords are what people say instead — Egyptian everyday words, the
 * Arabic synonyms, and the English a few teachers type.
 *
 * `show` hides what this person cannot use (an assistant without the ability never sees
 * the entry — same rule as the menus).
 */
export interface SearchCtx {
  isAssistant: boolean;
  can: (ability: string) => boolean;
  flags: Record<string, unknown> | null | undefined;
}

export interface FeatureEntry {
  id: string;
  /** i18n key of the title (the menu row's own). */
  titleKey: string;
  /** i18n key of the one-line description, when the menu has one. */
  subKey?: string;
  /** Where it lives, said plainly («الإدارة», «الإعدادات») — shown under the title. */
  area: 'home' | 'manage' | 'money' | 'students' | 'sessions' | 'settings' | 'help';
  icon: IconName;
  /** A route, or a special action the search screen performs. */
  href?: string;
  action?: 'add_student' | 'schedule';
  keywords: string[];
  show?: (c: SearchCtx) => boolean;
}

const teacherOnly = (c: SearchCtx) => !c.isAssistant;
const can = (a: string) => (c: SearchCtx) => c.can(a);

export const FEATURES: FeatureEntry[] = [
  // ── Students ──
  { id: 'add_student', titleKey: 'add_student.title', area: 'students', icon: 'add', action: 'add_student', show: can('manage_students'),
    keywords: ['طالب جديد', 'سجل طالب', 'تسجيل', 'اضافة', 'ضيف طالب', 'انضمام', 'enroll', 'new student', 'add student', 'ضيف طالب', 'سجل طالب جديد', 'حجز طالب'] },
  { id: 'record_student', titleKey: 'add_student.fast', area: 'students', icon: 'add', href: '/(teacher)/record-student', show: (c) => c.can('manage_students') && !!c.flags?.fast_register,
    keywords: ['تسجيل سريع', 'الباب', 'على الباب', 'اسم ورقم ولي الامر', 'سريع', 'fast'] },
  { id: 'enroll_card', titleKey: 'add_student.card', area: 'students', icon: 'scan', href: '/(teacher)/enroll', show: can('manage_students'),
    keywords: ['كارت', 'بطاقة', 'qr', 'كيو ار', 'رمز', 'مسح', 'سكان', 'دعوة ولي الامر', 'scan', 'card'] },
  { id: 'invite_phone', titleKey: 'add_student.phone', area: 'students', icon: 'phone', href: '/(teacher)/invite-phone', show: can('manage_students'),
    keywords: ['دعوة', 'رقم', 'تليفون', 'موبايل', 'رسالة', 'sms', 'invite'] },
  { id: 'invite_link', titleKey: 'add_student.link', area: 'students', icon: 'send', href: '/(teacher)/invite-link', show: can('manage_students'),
    keywords: ['لينك', 'رابط', 'حجز اونلاين', 'واتساب', 'مشاركة', 'link', 'booking link'] },
  { id: 'students', titleKey: 'teacher.tab_students', area: 'students', icon: 'children', href: '/(teacher)/students',
    keywords: ['طلابي', 'الطلبة', 'قائمة الطلاب', 'كشف', 'ملف طالب', 'students', 'بحث عن طالب', 'بيانات طالب', 'كود الطالب', 'رقم الطالب', 'نقل طالب', 'تغيير مجموعة', 'فصل طالب', 'ملف الطالب'] },
  { id: 'booking_requests', titleKey: 'booking_requests.title', subKey: 'booking_requests.manage_sub', area: 'students', icon: 'bell', href: '/(teacher)/booking-requests', show: can('manage_students'),
    keywords: ['طلبات', 'حجز', 'انتظار', 'موافقة', 'قبول', 'requests'] },
  { id: 'phones', titleKey: 'home.phones_title', subKey: 'manage.phones_sub', area: 'students', icon: 'phone', href: '/(teacher)/phone-confirmations',
    keywords: ['تأكيد رقم', 'ارقام', 'رقم ولي الامر', 'كود', 'تحقق', 'otp', 'رقم غلط', 'تأكيد ولي الامر'] },
  { id: 'cards', titleKey: 'manage.cards_title', subKey: 'manage.cards_sub', area: 'students', icon: 'card', href: '/(teacher)/students?segment=cards', show: can('manage_students'),
    keywords: ['كروت', 'بطاقات', 'طباعة', 'طلب كارت', 'cards'] },
  { id: 'card_order_link', titleKey: 'card_order_link.title', subKey: 'card_order_link.manage_sub', area: 'students', icon: 'send', href: '/(teacher)/card-order-link', show: can('manage_students'),
    keywords: ['رابط كارت', 'طلب بطاقة', 'الاهل يطلبوا', 'card link'] },

  // ── Money ──
  { id: 'collect', titleKey: 'manage.pending_collections', subKey: 'manage.pending_collections_sub', area: 'money', icon: 'money', href: '/(teacher)/pending-collections', show: can('scan_attendance'),
    keywords: ['تحصيل', 'فلوس', 'دفع', 'مستحقات', 'متأخرات', 'فاتورة', 'فواتير', 'ملزمة', 'ملازم', 'دفعة', 'حساب', 'مديونية', 'payments', 'collect', 'dues', 'تحصيل جزئي', 'نص المبلغ', 'جزء من المبلغ', 'باقي الحساب', 'الغاء المستحق', 'مسامحة', 'invoice'] },
  { id: 'rose', titleKey: 'app_search.rose_title', area: 'money', icon: 'note', href: '/(teacher)/cash-reconcile', show: can('scan_attendance'),
    keywords: ['مدام روز', 'روز', 'الخزنة', 'الدرج', 'الكاش', 'جرد', 'تسليم', 'مطابقة', 'عهدة', 'cash', 'drawer', 'rose', 'حساب الاسبوع', 'تقرير', 'تصدير', 'ختم', 'رمز تحقق', 'تسليم فلوس', 'عجز', 'زيادة'] },
  { id: 'who_paid', titleKey: 'cash.who_paid_title', area: 'money', icon: 'children', href: '/(teacher)/cash-collections', show: can('scan_attendance'),
    keywords: ['مين دفع', 'من دفع', 'دفعوا', 'تحصيلات الاسبوع', 'مدفوعات', 'ايرادات', 'دخل الاسبوع', 'الغاء دفع', 'رجوع دفع', 'who paid', 'income', 'تقرير التحصيل', 'مدفوعات الاسبوع'] },
  // Editing what is collected, or giving it back: two jobs people name in their own words
  // (founder 2026-10-10: «some keywords are missing, like edit collection»).
  { id: 'edit_collection', titleKey: 'app_search.f_edit_collection', subKey: 'app_search.f_edit_collection_sub', area: 'money', icon: 'money', href: '/(teacher)/pending-collections', show: can('scan_attendance'),
    keywords: ['تعديل تحصيل', 'تعديل الفاتورة', 'تصحيح الفاتورة', 'تعديل المبلغ', 'تعديل عدد الحصص', 'عدل وحصل', 'فاتورة غلط', 'مبلغ غلط', 'edit collection', 'edit bill'] },
  { id: 'cancel_payment', titleKey: 'app_search.f_cancel_payment', subKey: 'app_search.f_cancel_payment_sub', area: 'money', icon: 'undo', href: '/(teacher)/cash-collections', show: teacherOnly,
    keywords: ['الغاء دفع', 'الغاء الدفع', 'الغاء تحصيل', 'رجوع فلوس', 'استرجاع', 'استرداد', 'مرتجع', 'تحصيل غلط', 'دفع غلط', 'refund', 'cancel payment', 'reverse'] },
  { id: 'expenses', titleKey: 'expenses.title', subKey: 'expenses.manage_sub', area: 'money', icon: 'note', href: '/(teacher)/expenses', show: (c) => c.can('scan_attendance'),
    keywords: ['مصاريف', 'مصروفات', 'ايجار', 'صرف', 'فاتورة كهربا', 'expenses', 'مصروف', 'بنزين', 'مواصلات', 'قهوة', 'طباعة', 'ايجار القاعة', 'فواتير الكهربا'] },
  { id: 'payment_proofs', titleKey: 'payment_proofs.title', subKey: 'payment_proofs.manage_sub', area: 'money', icon: 'card', href: '/(teacher)/payment-proofs', show: can('review_payment_proofs'),
    keywords: ['فودافون كاش', 'انستاباي', 'تحويل', 'اسكرين', 'صورة التحويل', 'اثبات', 'instapay', 'vodafone', 'تحويلات', 'صور الدفع', 'حولوا', 'وصل تحويل'] },
  { id: 'assistant_actions', titleKey: 'assistant_actions.title', subKey: 'assistant_actions.manage_sub', area: 'money', icon: 'eye', href: '/(teacher)/assistant-actions', show: teacherOnly,
    keywords: ['المساعد', 'مراجعة', 'رفض', 'عكس', 'اللي عمله المساعد', 'رقابة', 'assistant'] },
  { id: 'billing_settings', titleKey: 'billing_settings.title', subKey: 'billing_settings.manage_sub', area: 'money', icon: 'settings', href: '/(teacher)/billing-settings', show: teacherOnly,
    keywords: ['طرق الدفع', 'رقم فودافون', 'انستاباي', 'سعر', 'الاسعار', 'اعدادات الدفع', 'billing', 'سعر الحصة', 'سعر الشهر', 'الدفعة المقدمة', 'سعر الملزمة', 'طريقة الدفع'] },
  { id: 'overrides', titleKey: 'teacher.overrides', subKey: 'manage.overrides_sub', area: 'money', icon: 'lock', href: '/(teacher)/overrides', show: can('scan_attendance'),
    keywords: ['استثناء', 'سماح', 'دخول رغم', 'مهلة', 'اذن', 'exception', 'سماح بالدخول', 'دخول من غير دفع', 'متأخرات', 'مديونية'] },
  { id: 'insights', titleKey: 'teacher.insights_title', subKey: 'teacher.insights_sub', area: 'money', icon: 'reports', href: '/(teacher)/insights', show: teacherOnly,
    keywords: ['احصائيات', 'تقارير', 'ارباح', 'دخل', 'نسبة الحضور', 'رسم بياني', 'pdf', 'stats', 'reports', 'ارباح الشهر', 'دخل الشهر', 'كسبت كام', 'نسبة الغياب'] },

  // ── Sessions & schedule ──
  { id: 'sessions', titleKey: 'teacher.tab_sessions', area: 'sessions', icon: 'calendar', href: '/(teacher)/sessions',
    keywords: ['الحصص', 'جدول', 'مواعيد', 'النهارده', 'الاسبوع', 'حضور', 'غياب', 'كشف الحضور', 'sessions', 'attendance', 'تسجيل غياب', 'حضور يدوي', 'الغاء حصة', 'حصة اتلغت', 'ملاحظات الحصة', 'درجات', 'درجة', 'كشف الدرجات', 'marks', 'grades', 'cancel session'] },
  { id: 'scan', titleKey: 'app_search.scan_title', area: 'sessions', icon: 'scan', href: '/(teacher)/scan', show: can('scan_attendance'),
    keywords: ['مسح', 'سكان', 'الباب', 'تسجيل حضور', 'كاميرا', 'qr', 'scan'] },
  { id: 'schedule', titleKey: 'home.schedule_short', area: 'sessions', icon: 'calendar', action: 'schedule',
    keywords: ['مقرر جديد', 'موعد جديد', 'حصة امتحان', 'جدولة', 'مواعيد', 'schedule'] },
  { id: 'courses', titleKey: 'teacher.courses_title', subKey: 'manage.courses_sub', area: 'sessions', icon: 'book', href: '/(teacher)/courses',
    keywords: ['مجموعات', 'مجموعة', 'مقرر', 'كورس', 'الصف', 'سعر الحصة', 'courses', 'groups', 'مجموعة جديدة', 'مواعيد المجموعة', 'سعر المجموعة', 'الصف الدراسي'] },
  { id: 'exam', titleKey: 'teacher.special_sessions_title', subKey: 'teacher.special_sessions_sub', area: 'sessions', icon: 'reports', href: '/(teacher)/exam-create', show: can('manage_sessions'),
    keywords: ['امتحان', 'اختبار', 'حصة خاصة', 'حصة زيادة', 'exam'] },
  { id: 'revisions', titleKey: 'teacher.revision_mode_row', subKey: 'teacher.revision_mode_row_sub', area: 'sessions', icon: 'book', href: '/(teacher)/revisions', show: (c) => !c.isAssistant && !!c.flags?.revise_mode,
    keywords: ['مراجعة', 'مراجعات', 'ليلة الامتحان', 'زوار', 'revision'] },
  { id: 'pause', titleKey: 'teacher.pause_period', subKey: 'teacher.pause_sub', area: 'sessions', icon: 'clock', href: '/(teacher)/pause', show: can('cancel_sessions'),
    keywords: ['اجازة', 'ايقاف', 'وقف الحصص', 'عيد', 'سفر', 'pause', 'holiday'] },
  { id: 'merge', titleKey: 'teacher.merge_title', subKey: 'teacher.merge_sub', area: 'sessions', icon: 'calendar', href: '/(teacher)/schedule-merge', show: can('manage_courses'),
    keywords: ['دمج', 'ضم مجموعتين', 'merge'] },
  { id: 'ramadan', titleKey: 'teacher.overrides_title', subKey: 'teacher.overrides_sub', area: 'sessions', icon: 'clock', href: '/(teacher)/schedule-overrides', show: can('manage_courses'),
    keywords: ['رمضان', 'تعديل مواعيد', 'مواعيد مؤقتة', 'ramadan'] },
  { id: 'venues', titleKey: 'manage.venues_title', subKey: 'manage.venues_sub', area: 'sessions', icon: 'gps', href: '/(teacher)/venues', show: teacherOnly,
    keywords: ['سنتر', 'مكان', 'اماكن', 'عنوان', 'لوكيشن', 'location', 'center'] },
  { id: 'reconcile', titleKey: 'teacher.reconcile_title', area: 'sessions', icon: 'refresh', href: '/(teacher)/reconcile',
    keywords: ['مزامنة', 'اوفلاين', 'بدون نت', 'بانتظار الارسال', 'لم يرسل', 'sync', 'offline', 'حاجات متبعتتش', 'مستني يتبعت'] },

  // ── Follow-up & people ──
  { id: 'resolution', titleKey: 'teacher.resolution_title', subKey: 'teacher.resolution_sub', area: 'manage', icon: 'bell', href: '/(teacher)/resolution',
    keywords: ['اعذار', 'عذر غياب', 'تبديل حصة', 'متابعة', 'فصل طالب', 'excuse', 'swap'] },
  { id: 'tickets', titleKey: 'teacher.tab_tickets', subKey: 'manage.tickets_sub', area: 'manage', icon: 'tickets', href: '/(teacher)/tickets',
    keywords: ['تذاكر', 'شكاوى', 'رسائل الاهل', 'اولياء الامور', 'رد', 'tickets', 'شكوى ولي امر', 'رسالة ولي امر', 'دعم', 'الادارة', 'support'] },
  { id: 'complaints', titleKey: 'complaints.title', subKey: 'complaints.manage_sub', area: 'manage', icon: 'note', href: '/(teacher)/complaints',
    keywords: ['اعتراض', 'اعتراضات', 'درجة غلط', 'شكوى', 'complaint', 'تظلم'] },
  { id: 'notifications', titleKey: 'manage.notifications_title', subKey: 'manage.notifications_sub', area: 'manage', icon: 'bell', href: '/(teacher)/notifications',
    keywords: ['اشعارات', 'تنبيهات', 'notifications', 'رسائل'] },
  { id: 'assistants', titleKey: 'assistants.title', subKey: 'assistants.subtitle', area: 'manage', icon: 'children', href: '/(teacher)/assistants', show: teacherOnly,
    keywords: ['مساعد', 'مساعدين', 'سكرتير', 'صلاحيات', 'اضافة مساعد', 'assistant', 'permissions', 'اضافة مساعد', 'سكرتيرة', 'صلاحيات المساعد', 'وقف مساعد'] },

  // ── Settings & help ──
  { id: 'password', titleKey: 'auth.change_password', area: 'settings', icon: 'lock', href: '/change-password',
    keywords: ['باسورد', 'كلمة السر', 'كلمة المرور', 'password'] },
  { id: 'settings', titleKey: 'teacher.tab_settings', area: 'settings', icon: 'settings', href: '/(teacher)/settings',
    keywords: ['اعدادات', 'الوضع الليلي', 'اللغة', 'حسابي', 'تسجيل خروج', 'settings', 'logout'] },
  { id: 'tutorials', titleKey: 'tutorials.title', area: 'help', icon: 'play', href: '/(teacher)/tutorials',
    keywords: ['شرح', 'فيديو', 'ازاي', 'تعليم', 'مساعدة', 'help', 'video'] },
  { id: 'getting_started', titleKey: 'onboarding.getting_started_row', area: 'help', icon: 'help', href: '/(teacher)/getting-started',
    keywords: ['البداية', 'ابدأ منين', 'دليل', 'خطوات', 'start'] },
  { id: 'whats_new', titleKey: 'whats_new.title', area: 'help', icon: 'star', href: '/whats-new',
    keywords: ['جديد', 'تحديث', 'اخر التحديثات', 'update', 'new'] },
];
