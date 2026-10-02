# 📋 PROJECT REFERENCE — StoneBill (فاتورة ستون)

> **ملف مرجعي دائم (القاعدة ٩)** — يقرأ في بداية كل جلسة جديدة قبل لمس أي سطر كود.
> الهدف: لو اتمسحت المحادثة، أي جلسة جديدة تكمل من نفس النقطة بدون فقدان أي سياق.
> **آخر تحديث: 2026-10-02 — النسخة الحالية v1.14**

---

## 1) هوية المشروع

| البند | القيمة |
|---|---|
| اسم التطبيق | **StoneBill** (فاتورة ستون) — كان Fatora Stone |
| المالك | **يوسف** (حساب جيت هب: Sawan4Art) — هاتف/فودافون كاش/واتساب: 01090042368 |
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
10. **قاعدة ١٠**: التجربة مرة واحدة لكل جهاز ولكل بريد (علامة سحابية create-only) + **بريد = جهاز مدير واحد** + تشفير Ed25519 (المفتاح العام فقط بالتطبيق) ولا يُضعف أبداً.
11. **قاعدة ١١**: التواصل عبر شاشة الشات بدون شاشة ترمنال كلما أمكن — وإن تعذّر تُلغى القاعدة بنصها (مع إبلاغ المالك).

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

# 3) بناء الـ APK (v1.13+: Release موقّع Keystore — see android/keystore.properties)
#    Gradle بيتعلق وهمياً أحياناً — الحل nohup خلفية + مراقبة
cd android
export JAVA_HOME=/home/z/jdk-17 ANDROID_HOME=/home/z/android-sdk
nohup ./gradlew assembleRelease > /tmp/gradle.log 2>&1 &
# راقب: ls -la app/build/outputs/apk/release/app-release.apk (يظهر خلال ~16-60 ثانية عند النجاح)
# ملاحظة: من غير keystore.properties البناء ينجح غير موقّع — مفتاح النسخة الاحتياطية لدى المالك

# 4) انسخ المنتج
cp app/build/outputs/apk/release/app-release.apk /home/z/my-project/download/StoneBill-vX.X.apk
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


## 5-ب) تطبيق المالك SB Owner (خاص — لا يُنشر أبداً)

| البند | القيمة |
|---|---|
| الموقع | `/home/z/my-project/sb-owner/` — **خارج الريبو، لا يُرفع على GitHub ولا يُرسل لأحد** |
| الحزمة | `com.stonebill.owner` — اسم الظهور: SB Owner |
| الوظيفة | توليد أكواد تفعيل Ed25519 + كود تجربة + إدارة المشتركين سحابياً + سجل وتصدير |
| المفتاح | مدمج مشفراً PIN (PBKDF2 150k + AES-GCM) — النسخة الاحتياطية في `download/SB-Keys-Backup/` |
| Keystore | `sb-owner/android/sb-owner-release.keystore` + نسخة في `download/SB-Owner-Keystore-Backup/` (باسورد داخل keystore.properties) |

```bash
# بناء/تحديث تطبيق المالك بعد أي تعديل:
node /home/z/my-project/scripts/build_owner_www.js 1.0.0   # يجمع www/index.html (firebase+nacl+core2+key+rules)
cd /home/z/my-project/sb-owner && npx cap sync android
cd android && export JAVA_HOME=/home/z/jdk-17 ANDROID_HOME=/home/z/android-sdk
nohup ./gradlew assembleRelease > /home/z/my-project/owner_gradle.log 2>&1 &   # nohup+polling دائماً
# الناتج: app/build/outputs/apk/release/app-release.apk → download/SB-Owner-vX.X.apk
```
- التحديث بعد النشر: نفس الـ Keystore → تثبيت APK الجديد فوق القديم بدون فقدان بيانات.
- قابلية التطوير: `CFG.plans` (باقات/أسعار) + keyVer (مفاتيح متعددة) + قواعد مدمجة للعرض + تبويب مشتركين جاهز للإضافات (حظر/هدية/تقارير).
- ملفات القالب: `scripts/sb_owner_template.html` + `scripts/build_owner_www.js`.
- ⚠️ المفتاح الرئيسي نفسه: `/home/z/my-project/keys/sb_ed25519_master.json` (خارج الريبو) — نسخته الاحتياطية عند المالك.

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
| الاشتراك/الترخيص (نهاية الملف) | بلوك `<!--SBL-START-->` — 4 طبقات: tweetnacl (Ed25519) + نواة HMAC v1 (توافق) + نواة Ed25519 v2 (`/*SBL-CORE2-START*/` — مفتاح عام فقط) + طبقة `SB.License` (بوابة/تجربة بالبريد/تفعيل/أقفال سحابية) + صفحة إعدادات محقونة |
| أداة المالك | `stonebill-admin.html` (جذر المستودع + نسخة في download) — توليد أكواد + إدارة المشتركين (تدخل بحساب Email/Password) |

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
| `sb_license` | الترخيص: `{codeId, code, email, exp, plan, device, pendingCloud}` (v1.13) |
| `sb_trial` | التجربة: `{email, device, start, pendingCloudTrial}` أو `{used:true}` للرفض (v1.14 — 3 أيام ببريد / 14 أيام قديم بدون بريد) |
| `sb_clock_last` | ساعة أحادية الاتجاه ضد تلاعب تاريخ الجهاز (v1.13) |
| `sb_license_transfer` | طلب نقل ترخيص معلق حتى اكتمال دخول جوجل (v1.13) |
| `sb_layout_sub` | علم ترحيل زر الاشتراك في قائمة الإعدادات (v1.13) |
| `sb_device_uuid` | هوية الجهاز الاحتياطية للويب/آيفون (أندرويد يستخدم ANDROID_ID من الجسر الأصلي) |

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
10. **Firestore get() معلّق للأبد عند تعطل الشبكة** → كل عمليات السحابة في الترخيص ملفوفة بـ `withTimeout(8s)` — السحابة لا تحجب التفعيل أبداً (مسار مؤقت + `pendingCloud`).
11. **إعادة البناء بعد تعديل نواة/طبقة الترخيص** → عدّل `scripts/sb_license_core.js` (v1) أو `sb_license_core2.js` (Ed25519) أو `sb_license_app.js` ثم `node scripts/embed_license.js` (يدمج: nacl + core1 + core2 + app) — ممنوع تحرير البلوك داخل index.html يدوياً.
12. **اختبار الواجهة بمحاكاة سحابية**: سكربتات CDN بتستبدل أي mock مبكر — الحل في `test_license_ui.js`: `window.__SB_MOCK_FIREBASE()` يُستدعى بعد كل load وقبل إقلاع الترخيص (2.6 ث) لأن `getDb` يخزّن أول نتيجة.
13. **أخطاء `Fetch API cannot load file:///api/...` في file:// قديمة من v1.12** (مزامنة الورش) — تُرشّح من نتائج الاختبار ولا تُعتبر أخطاء جديدة.
14. **إصدار v2 من أكواد التفعيل يبدأ بـ SB2-** (132 حرفاً بيانات) — `verifyAuto` يوجّه تلقائياً بين v2/v1 حسب الطول والبادئة.

## 9) Firebase — خطوات التفعيل (للمالك — مبسطة 2026-10-02)

النسخة الكاملة خطوة-بخطوة للمالك في: `/home/z/my-project/download/خطوات-فايربيس-لليوسف.md`.
الإعدادات الحالية في `firebase-applet-config.json` (المشروع `gen-lang-client-0194008145`). الخلاصة:

1. console.firebase.google.com → إنشاء مشروع **fatroa** (بدون Analytics).
2. **Authentication** → تفعيل **Email/Password** (لإدارة المالك) + **Google** (لنقل المشترك ذاتياً) + إنشاء مستخدم المالك (Users → Add user).
3. **Firestore Database** → Create (production, europe-west).
4. **Firestore → Rules** → لصق كامل محتوى `firestore.rules` (يشمل sb_licenses + sb_trials + sb_trialemails + sb_emails) → Publish.
5. Project settings → General → تطبيق ويب `</>` → نسخ `firebaseConfig` وإرساله في الشات ليُدمج في التحديث التالي.

**مجموعات Firestore الخاصة بالترخيص:**
- `sb_licenses/{codeId}` — الكود: email/exp/plan/device/revoked (قفل كود→جهاز).
- `sb_emails/{sbe...}` — قفل **بريد→جهاز واحد** (create: جهاز جديد؛ update: نفس الجهاز/جوجل بنفس البريد/المالك).
- `sb_trials/{deviceCode}` + `sb_trialemails/{tme...}` — علامة التجربة (create-only — لا update/delete).

### كيف يعمل نظام الاشتراك (v1.14)
- **التجربة**: 3 أيام مرة واحدة فقط — تُبدأ من بوابة الترحيب ببريد إلكتروني، وتُعلَّم سحابياً بجهاز+بريد؛ إعادة تثبيت التطبيق على نفس الجهاز (ANDROID_ID يصمد) أو نفس البريد → رفض فوري. (تُعدّل في `CFG.trialDays` / `legacyTrialDays` للتجارب القديمة).
- **البيع**: المشترك يحوّل فودافون كاش `01090042368` → المالك يولّد كوداً من **تطبيق SB Owner** (يستبدل stonebill-admin.html) مربوط ببريد المشترك بتوقيع Ed25519 → يبعته واتساب بضغطة.
- **التفعيل**: التطبيق ← الإعدادات ← «الاشتراك والترخيص» أو البوابة التلقائية: كود + بريد. تحقق Ed25519 أوفلاين 100% (المفتاح العام فقط بالتطبيق) + مطالبتان سحابيتان: الكود→جهاز و**البريد→جهاز واحد** (وضع المدير والصنايعية على الجهاز المفعل الوحيد).
- **النقل لجهاز جديد**: نفس الكود على الجهاز الجديد مرفوض تلقائياً → المشترك يسجل دخول جوجل بنفس البريد فينتقل تلقائياً، أو المالك يضغط «تحرير الجهاز» من الأداة.
- **الحماية**: توقيع Ed25519 (سر التوليد في تطبيق المالك فقط — لا يوجد بالتطبيق إطلاقاً)، بصمة البريد داخل الكود، قفلا جهاز سحابيان (كود+بريد)، ساعة أحادية ضد تلاعب التاريخ، إيقاف/تحرير من تطبيق المالك.
- **الأسعار معروضة من `CFG.plans` في بلوك الترخيص** (شهري 100ج / ربع 250ج / سنوي 900ج — قابلة للتعديل سطر واحد).

## 10) سجل الإصدارات المختصر

| نسخة | أبرز ما فيها |
|---|---|
| v1.7 | إعادة تسمية StoneBill + onboarding + 6 أيقونات هيدر |
| v1.8 | حفظ بيانات المصنع + منع النسخ بالضغط المطول + سحب لحذف المحفوظات |
| v1.9 | ثيم زجاجي افتراضي + سبلاش واحد + الحاسبة دائرية |
| v1.10 | هيدر أضخم + أيقونات عمودية + إصلاح حفظ الصفحات |
| v1.11 | شعار بالمنتصف + صفر سكرول + محول وحدات + أيقونة SB على الرخام |
| **v1.12** | **حفظ الصفحات من أي محتوى + أيقونة + صفحات متراكبة + أقواس حاسبة بدل المسطرة + إصلاح ظل/زوايا الثيمات + نوافذ موحدة + طباعة أصلية printPage + مقاس ورق/ترتيب/ألوان الطباعة + تنظيم الإعدادات (اللغة داخل النظام + صلاحيات مستقلة) + قسم جداول التقطيع للصنايعي + PIN بلا افتراضي + تبويب مصروفات (كهرباء/مياه/صيانة) + جداول بمعادلة ودمج + تسجيل جوجل redirect + Firestore sync + أيقونة رخام محفور + القاعدة ٩** |
| **v1.14** | **تحصين التجربة: 3 أيام مرة واحدة لكل جهاز ولكل بريد (علامة سحابية create-only في sb_trials/sb_trialemails — الحذف وإعادة التثبيت لا يمنح تجربة) + تشفير Ed25519 غير متماثل (المفتاح العام فقط بالتطبيق — لا تزوير حتى بفك APK؛ توافق HMAC v1) + قفل بريد=جهاز واحد في السحابة (sb_emails) + بوابة ترحيب بالتجربة المربوطة بالبريد + رفض الجهاز الثاني + تطبيق المالك SB Owner APK خاص غير منشور (توليد أكواد Ed25519 بمفتاح PIN-encrypted PBKDF2+AES-GCM + إدارة مشتركين سحابية + سجل + تصدير) + القاعدتان 10 و11** |
| **v1.13** | **نظام اشتراك مدفوع كامل: تجربة 14 يوم + بوابة اشتراك (فودافون كاش 01090042368 + واتساب) + تفعيل بكود+بريد مربوطين HMAC-SHA256 + قفل جهاز سحابي Firestore (كود واحد = جهاز واحد) + نقل ذاتي بجوجل بنفس البريد + صفحة «الاشتراك والترخيص» في الإعدادات + أداة المالك stonebill-admin.html (توليد أكواد + إدارة مشتركين + تحرير أجهزة + إيقاف أكواد) + أول بناء Release موقّع Keystore دائم (حل Play Protect) + جسر getDeviceId (ANDROID_ID يصمد بعد الحذف)** |

## 11) اختبار سريع بعد أي جلسة (قاعدة ٤)

```bash
node server.js &   # ثم متصفح headless (Playwright) — الشاشات الحرجة:
# الرئيسية (الهيدر بالمنتصف + 4 أيقونات يمين) / إنشاء فاتورة (+ والضغط المطول)
# الحاسبة (زر الأقواس يتغير بين ( و )) / الإعدادات (كل الصفحات تفتح)
# الطباعة وPDF (معاينة + مقاس ورق) / صلاحيات الصنايعي (قائمة مصغرة + جداول التقطيع)
python3 /home/z/my-project/scripts/check_js.py   # صفر أخطاء صيغة
```
