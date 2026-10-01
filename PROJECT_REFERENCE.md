# 📋 PROJECT REFERENCE — StoneBill (فاتورة ستون)

> **ملف مرجعي دائم (القاعدة ٩)** — يقرأ في بداية كل جلسة جديدة قبل لمس أي سطر كود.
> الهدف: لو اتمسحت المحادثة، أي جلسة جديدة تكمل من نفس النقطة بدون فقدان أي سياق.
> **آخر تحديث: 2026-10-01 — النسخة الحالية v1.12**

---

## 1) هوية المشروع

| البند | القيمة |
|---|---|
| اسم التطبيق | **StoneBill** (فاتورة ستون) — كان Fatora Stone |
| المالك | Sawan4Art (صفوان) — هاتف: 01090042368 |
| الريبو | `Sawan4Art/fatroa` |
| النطاق | تطبيق فواتير ورش الرخام والجرانيت — أندرويد APK + ويب + Electron |
| اللغة | عربي RTL بالكامل + 7 لغات (i18n) |
| الملف الأساسي | **`index.html` واحد فقط** (~27,000 سطر) — كل الـ JS/CSS داخله |
| الباكدج | `com.sawan4art.fatorastone` |
| التقنية | HTML/CSS/JS خام + Capacitor 6 + Gradle 8.7 + AGP |

## 2) القواعد الإلزامية (RULES.md — ملزمة)

1. **قاعدة ١**: منطق الجداول التسعة المدمجة (`BUILTIN_TABLE_TYPES`: رخام/جرانيت/طاولات/شرايح/أطوال وقصاير/درج م.ط/درج بتخانة/تلابيس/ترابيع) **محصّن نهائياً** — يُعدَّل الشكل فقط، والمنطق لا يُلمس (يشمل `calculateAll` ودوال حساب الفاتورة).
2. **قاعدة ٢**: النسبة الذهبية φ=1.618 — مسافات 8→13→21→34→55→89 وخطوط 11→14→18→23→37.
3. **قاعدة ٣**: مرجعية أساليب المطورين + ممنوع CDN وقت التشغيل (التبعيات محلية).
4. **قاعدة ٤**: اختبار بشري كامل بعد كل بناء (كل صفحة تفتح فعلياً + صفر أخطاء JS + فحص file://).
5. **قاعدة ٥**: اقتراح تحسينات مكتوبة بعد كل تسليم (القرار للمالك).
6. **قاعدة ٦**: رابط تحميل فوري لكل بناء على GitHub Releases + ترقيم تصاعدي.
7. **قاعدة ٧**: **ممنوع ضغط أو تنقيط أي أصل** (سبلاش/أيقونات) — الجودة أولاً، الحجم ليس مشكلة.
8. **قاعدة ٨**: إبقاء **إصدارين فقط** على Releases (الجديد + ما قبله) وحذف الباقي فوراً.
9. **قاعدة ٩**: هذا الملف (PROJECT_REFERENCE.md) — يُقرأ بداية كل جلسة ويُحدّث بعد كل إصدار.

## 3) بنية المستودع

```
fatroa/
├── index.html               ← التطبيق كله (ملف واحد)
├── build-www.js             ← يبني www/ (index + assets) للأوفلاين
├── capacitor.config.json    ← appId: com.sawan4art.fatorastone
├── restore-env.sh           ← استعادة بيئة البناء كاملة (idempotent — يشغّل أولاً دائماً)
├── RULES.md                 ← القواعد ١-٩
├── PROJECT_REFERENCE.md     ← هذا الملف
├── scripts/github_release.sh← نشر Release بالتوكن
├── assets/                  ← أيقونات + سبلاش + خطوط Cairo + i18n + html2pdf vendor
│   └── fonts-internal/GreatVibes-Regular.ttf  ← خط شعار SB (OFL)
├── android/                 ← مشروع الأندرويد (Gradle)
│   └── app/src/main/java/com/sawan4art/fatorastone/MainActivity.java
│       (جسر أصلي: shareFile + printPage + showToast + back-button JS)
├── firebase-applet-config.json ← إعدادات Firebase (المستخدم يعوّضها بمشروعه)
└── server.js                ← سيرفر ويب محلي للاختبار (node server.js — port 3000)
```

## 4) البيئة والبناء (خطوات ثابتة — بالترتيب)

```bash
# 0) البيئة (لو الجهاز اتمسح): JDK17 + SDK 34 + node_modules + www/
cd /home/z/my-project/fatroa && bash restore-env.sh

# 1) تعديل index.html → ثم فحص صيغة JS لكل البلوكات
python3 /home/z/my-project/scripts/check_js.py

# 2) بناء حزمة الويب + المزامنة
node build-www.js && npx cap sync android

# 3) بناء الـ APK (Gradle بيتعلق وهمياً أحياناً — الحل nohup خلفية + مراقبة)
cd android
export JAVA_HOME=/home/z/jdk-17 ANDROID_HOME=/home/z/android-sdk
nohup ./gradlew assembleDebug > /tmp/gradle.log 2>&1 &
# راقب: ls -la app/build/outputs/apk/debug/app-debug.apk (يظهر خلال ~16-60 ثانية عند النجاح)

# 4) انسخ المنتج
cp app/build/outputs/apk/debug/app-debug.apk /home/z/my-project/download/StoneBill-vX.X.apk
```

**نقاط حرجة في البناء:**
- Gradle 8.7 بيتعلق "تعليق وهمي" في المقدمة — استخدم nohup + polling دائماً.
- مسار الويب داخل الـ APK هو `assets/public/` (وليس assets/).
- التبعيات npm: `@capacitor/local-notifications` مثبتة (إشعارات المتأخرات 9:00 ص).

## 5) النشر (قاعدة ٦ + ٨)

```bash
# التوكن في /home/z/my-project/.github-token (chmod 600)
# push عبر remote مؤقت بالتوكن ثم إرجاع الرابط النظيف
scripts/github_release.sh  # target = الـ SHA الكامل للكوميت (مش مختصر!)
# بعد النشر: احذف كل الإصدارات الأقدم من آخر اثنين (API: DELETE /releases/{id} + DELETE /git/refs/tags/{tag})
```

## 6) خريطة index.html (أهم المواقع — أرقام تقريبية تتزحزح بالتعديلات)

| القسم | ملاحظات |
|---|---|
| `<style>` (~سطر 5-5340) | كل الثيمات: `[data-skin="modern/minimal/pro/glass/marble"]` × light/dark/amoled |
| `#splashScreen` (~5306) | سبلاش واحد فقط (v1.9 حذف الأصلي) |
| `#loginView` (~5380) | الهيدر: شعار + اسم بالمنتصف + 4 أيقونات عمود يمين `#dashTopRightActions` |
| `#settingsView` (~5490) | القائمة `#settingsMenuGrid` (ديناميكية من `APP_BUTTONS_CATALOG` + `DEFAULT_SETTINGS_KEYS`) + صفحات `#settings-page-{factory,theme,pdf,system,permissions,cutting,custom-tables,whatsapp,materials,expenses,language}` |
| `#calculatorView` (~7150) | صف الصف الأخير: أقواس/0/فاصلة/= — محرك `evaluateMath` يدعم الأقواس + `calcParen()` ذكي |
| `#appView` (~7240) | الفاتورة `#invoiceCardContent` — أقسامها ليها `order` من `SB_PDF_SECTIONS` |
| Firebase/Drive (~12630) | `initFirebaseForGoogleDrive` + `loginWithGoogleForDrive` (redirect في APK) + `sbFbUploadBackup/sbFbDownloadBackup` (Firestore) |
| الحوارات الموحدة (~11985) | `sbConfirm/sbAlert/sbPrompt` — بديل confirm/alert/prompt الأصلية في كل التطبيق |
| الصفحات المتعددة (~16900) | `sbInvoiceSessions` — الحفظ من **أول أي محتوى** (مش اسم العميل بس) + uid ثابت لكل صفحة |
| جداول المعادلة/الدمج | بلوك `<script>` أخير قبل `</body>` — طبقة مستقلة فوق المحرك المحصّن (تغليف `calculateAll` من الخارج) |
| الصلاحيات/PIN (~14930) | `getStoredAdminPin` بلا رمز افتراضي — أول تبديل وضع يتطلب إنشاء رمز |

## 7) مفاتيح localStorage المهمة

| المفتاح | المحتوى |
|---|---|
| `marbleArchiveV2` | أرشيف الفواتير المحفوظة |
| `marbleInvoiceDraft` + `invoiceDraft` | مسودة الفاتورة الجارية (تُكتب معاً) |
| `sbInvoiceSessions` | الصفحات المتعددة (uid: `sbsn-pg...`) — cap 8 |
| `app_admin_pin` | رمز المدير (بدون افتراضي — null حتى ينشئه المستخدم) |
| `app_user_role` | `admin` / `craftsman` |
| `appSkin` / `appMode` | الثيم (glass افتراضي) / الوضع (light/amoled/auto) |
| `pdfConfig` | إعدادات الطباعة: قالب/لون/`paperSize(a4)/printColors/sectionOrder` |
| `customTableTypes` | أنواع الجداول المخصصة (legacy + `mode:'formula'/'merged'`) |
| `marbleWorkersDB` / `marbleWorkerLedgerDB` | العمال / قيود اليوميات |
| `sb_workshop_expenses` | مصروفات كهرباء/مياه/صيانة (v1.12) |
| `sb_cutting_sheets` | سجل جداول التقطيع (v1.12) |
| `sb_fb_last_sync` | آخر مزامنة Firebase |
| `sb_layout_v17` / `sb_layout_v12` | أعلام ترحيل تخطيط الأزرار |

## 8) حلول المشاكل المتكررة (الدروس المستفادة)

1. **window.print() لا يعمل في WebView** → `AndroidInterface.printPage()` أُصلي يستدعي `webView.print()` (حوار طباعة أندرويد) — استخدم دالة `sbPrint()` في JS دائماً.
2. **signInWithPopup لا يعمل في WebView** → استخدم `signInWithRedirect` + `getRedirectResult()` عند الإقلاع (معتمد في `loginWithGoogleForDrive`).
3. **html2canvas يفشل مع الألوان الحديثة** (oklch/color-mix) → يوجد تنقية `__pdfSanitizeColors` قبل التوليد + تعطيل الانتقالات (`pdf-generating`).
4. **النوافذ الأصلية confirm/alert/prompt** شكلها أبيض مخالف للثيم → استخدم `sbConfirm/sbAlert/sbPrompt`.
5. **الصلاحيات المعلقة تضيع** → `flushInvoiceSession()` على visibilitychange/pagehide/beforeunload.
6. **حجم أيقونة/سبلاش** → ممنوع أي ضغط (قاعدة 7). الكثافات: ldpi→xxxhdpi كلها موجودة.
7. **تعليق Gradle الوهمي** → nohup + polling.
8. **السبلاش المزدوج** → سبلاش واحد فقط `#splashScreen` (dismiss: `lux-hide`).
9. **زر الإعدادات السفلي** → `sbNavSettings()` دايماً بيرجع للقائمة الرئيسية (بعد إزالة زرّي الرجوع الداخليين).

## 9) Firebase — خطوات التفعيل (للمالك)

الكود جاهز (Auth + Firestore) ويعمل فور توفر إعدادات المشروع. الإعدادات الحالية موجودة في `firebase-applet-config.json` (مشروع AI Studio `gen-lang-client-0194008145`). للتفعيل الكامل بحسابك:

1. ادخل [console.firebase.google.com](https://console.firebase.google.com) → **إضافة مشروع** (أو استخدم المشروع الحالي).
2. **Authentication** → ابدأ → مزوّد **Google** → فعّله → احفظ.
3. **Firestore Database** → إنشاء قاعدة بيانات → **وضع الإنتاج** → الموقع: `europe-west` (أقرب لمصر) → إنشاء.
4. Authentication → Settings → **Authorized domains** → أضف `localhost`.
5. Project Settings → **Web App** (`</>`) → انسخ قيم `apiKey / authDomain / projectId / appId`.
6. حدّث `firebase-applet-config.json` بنفس القيم → `node build-www.js` → بناء APK جديد.
7. (اختياري لتقييد الاستخدام) قواعد Firestore المقترحة: اقرأ/اكتب `sb_backups/{uid}` فقط لصاحب الحساب:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /sb_backups/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```
8. بعد التفعيل: الإعدادات → النظام والنسخ → «قاعدة البيانات السحابية (Firebase)» → سجّل دخول جوجل → رفع/استرجاع.

## 10) سجل الإصدارات المختصر

| نسخة | أبرز ما فيها |
|---|---|
| v1.7 | إعادة تسمية StoneBill + onboarding + 6 أيقونات هيدر |
| v1.8 | حفظ بيانات المصنع + منع النسخ بالضغط المطول + سحب لحذف المحفوظات |
| v1.9 | ثيم زجاجي افتراضي + سبلاش واحد + الحاسبة دائرية |
| v1.10 | هيدر أضخم + أيقونات عمودية + إصلاح حفظ الصفحات |
| v1.11 | شعار بالمنتصف + صفر سكرول + محول وحدات + أيقونة SB على الرخام |
| **v1.12** | **حفظ الصفحات من أي محتوى + أيقونة + صفحات متراكبة + أقواس حاسبة بدل المسطرة + إصلاح ظل/زوايا الثيمات + نوافذ موحدة + طباعة أصلية printPage + مقاس ورق/ترتيب/ألوان الطباعة + تنظيم الإعدادات (اللغة داخل النظام + صلاحيات مستقلة) + قسم جداول التقطيع للصنايعي + PIN بلا افتراضي + تبويب مصروفات (كهرباء/مياه/صيانة) + جداول بمعادلة ودمج + تسجيل جوجل redirect + Firestore sync + أيقونة رخام محفور + القاعدة ٩** |

## 11) اختبار سريع بعد أي جلسة (قاعدة ٤)

```bash
node server.js &   # ثم متصفح headless (Playwright) — الشاشات الحرجة:
# الرئيسية (الهيدر بالمنتصف + 4 أيقونات يمين) / إنشاء فاتورة (+ والضغط المطول)
# الحاسبة (زر الأقواس يتغير بين ( و )) / الإعدادات (كل الصفحات تفتح)
# الطباعة وPDF (معاينة + مقاس ورق) / صلاحيات الصنايعي (قائمة مصغرة + جداول التقطيع)
python3 /home/z/my-project/scripts/check_js.py   # صفر أخطاء صيغة
```
