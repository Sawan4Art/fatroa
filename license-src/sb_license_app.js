(function(){
/* ============================================================================
 * StoneBill — طبقة الترخيص والاشتراك (v1.16)
 * ---------------------------------------------------------------------------
 * - اشتراك مدفوع (فودافون كاش + واتساب: 01090042368)
 * - التفعيل: كود Ed25519 v2 (التطبيق يحمل المفتاح العام فقط — لا تزوير حتى بفك APK)
 *   مع توافق كامل مع أكواد HMAC v1 القديمة
 * - v1.16 بطلب المالك (يوسف):
 *   • التجربة 14 يوم (رجّعها المالك 2026-10-03) مرة واحدة فقط — سحابياً بالجهاز والبريد معاً
 *   • تسعير الحزمة (تصحيح المالك 2026-10-02): المدير 299ج/شهر — مدير + ٢ صنايعية
 *     (عرض أول اتنين مع بعض +50 بس) 349ج/شهر — الصنايعي الإضافي بعد الاتنين 49ج/فرد
 *     ربع سنوي 799/999 — سنوي 2899/3999
 *   • صفحة الاشتراك تظهر عند فتح التطبيق طالما فيه اشتراك ساري (زي التطبيقات الطبيعية)
 *     مع زر «الدخول للتطبيق» أثناء سريان التجربة، والقفل الكامل بعد الانتهاء
 *   • باقة «المدير فقط» لا تفتح وضع الصنايعي — يتطلب باقة تشمل الصنايعية (2/4/6/8)
 * - بريد إلكتروني واحد = جهاز واحد فقط (قفل سحابي مزدوج: كود + بريد)
 * - جداول التسعة وكل منطق التطبيق غير متأثر — طبقة معزولة فوق التطبيق فقط
 * ========================================================================= */

  'use strict';
  var C = window.SBLicenseCore;
  var C2 = window.SBLicenseCore2;
  if (!C) { console.warn('SBL: core missing'); return; }
  if (!C2) { console.warn('SBL: core2 missing — أكواد v2 معطلة'); }
  function emailDocIdSafe(email) { return C2 ? C2.emailDocId(email) : 'sbe' + C.normalizeEmail(email).replace(/[^a-z0-9]/g, '').slice(0, 40); }
  function trialEmailDocIdSafe(email) { return C2 ? C2.trialEmailDocId(email) : 'tme' + C.normalizeEmail(email).replace(/[^a-z0-9]/g, '').slice(0, 40); }

  /* ============================ الإعدادات (عدّل الأسعار هنا فقط) ============================ */
  /* v1.17 — تسعير الحزمة المعتمد من المالك (يوسف) بمفهوم ٩٩:
     المدير 299 — عرض أول ٢ صنايعية مع بعض +50 بس (الإجمالي 349 بدل 299+98=397)
     الصنايعي الإضافي بعد الاتنين 49 للفرد — الربع سنوي 799/999 — السنوي 2899/3999 */
  var CFG = {
    trialDays: 14,                       /* مدة التجربة المجانية (بطلب المالك 2026-10-03: رجّعها 14 يوم) */
    legacyTrialDays: 14,                 /* تجارب v1.13 القديمة بدون بريد — تحتفظ بنافذتها الكاملة */
    cashNumber: '01090042368',           /* فودافون كاش */
    whatsapp: '201090042368',            /* واتساب بصيغة دولية */
    extraWorker: 49,                     /* سعر الصنايعي الإضافي ج/شهر للفرد (بعد أول اتنين) */
    bundlePrice: 50,                     /* عرض أول ٢ صنايعية مع بعض +50 فوق باقة المدير */
    plans: [
      { id: 1, name: 'المدير فقط — شهر',       tier: 1, label: 'شهري',    days: 30,  price: 299 },
      { id: 2, name: 'المدير + ٢ صنايعية — شهر', tier: 2, label: 'شهري',    days: 30,  price: 349 },
      { id: 3, name: 'المدير فقط — 3 شهور',     tier: 1, label: 'ربع سنوي', days: 90,  price: 799,  save: 98 },
      { id: 4, name: 'المدير + ٢ صنايعية — 3 شهور', tier: 2, label: 'ربع سنوي', days: 90, price: 999, save: 48 },
      { id: 5, name: 'المدير فقط — سنة',       tier: 1, label: 'سنوي',    days: 365, price: 2899, save: 689, best: true },
      { id: 6, name: 'المدير + ٢ صنايعية — سنة', tier: 2, label: 'سنوي',    days: 365, price: 3999, save: 189, best: true }
    ]
  };
  var LS = { lic: 'sb_license', trial: 'sb_trial', clock: 'sb_clock_last', transfer: 'sb_license_transfer' };

  /* باقة المالك (8): مدى الحياة + أجهزة غير محدودة — تتجاوز قفل البريد→الجهاز نهائياً
     (بطلب المالك 2026-10-02: «كود تفعيل مدى الحياة خاص بي افتح به أجهزة غير محدودة»)
     الإيقاف السحابي (revoked) ما زال يعمل على باقة المالك لو تسرّب الكود */
  var OWNER_PLAN = 8;
  function isOwnerPlan(p) { return p === OWNER_PLAN; }

  /* ============================ أدوات عامة ============================ */
  function jget(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function jset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function jdel(k) { try { localStorage.removeItem(k); } catch (e) {} }
  /* ساعة أحادية الاتجاه — لو المستخدم رجّع تاريخ الجهاز للوراء نستخدم آخر وقت مسجل */
  function safeNow() {
    var last = jget(LS.clock) || 0, t = Date.now();
    if (last && t < last - 120000) t = last;
    jset(LS.clock, Math.max(t, last));
    return t;
  }
  function toast(msg, type) { if (typeof window.showToast === 'function') { try { window.showToast(msg, type || 'info'); } catch (e) {} } }
  function waLink(text) { return 'https://wa.me/' + CFG.whatsapp + '?text=' + encodeURIComponent(text || 'أهلاً، عايز أشترك في StoneBill'); }
  function sblCopy(text, btn) {
    var done = function () { if (btn) { var o = btn.textContent; btn.textContent = '✓ تم النسخ'; setTimeout(function () { btn.textContent = o; }, 1600); } };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () { legacy(); });
        return;
      }
    } catch (e) {}
    legacy();
    function legacy() {
      try {
        var ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta); done();
      } catch (e) { toast('انسخ الرقم يدوياً: ' + text, 'warning'); }
    }
  }

  /* ============================ كود الجهاز ============================ */
  function deviceCode() {
    try {
      if (window.AndroidInterface && typeof window.AndroidInterface.getDeviceId === 'function') {
        var d = window.AndroidInterface.getDeviceId();
        if (d) return 'AND-' + String(d).replace(/[^0-9a-zA-Z]/g, '').slice(0, 24).toUpperCase();
      }
    } catch (e) {}
    var u = null;
    try { u = localStorage.getItem('sb_device_uuid'); } catch (e) {}
    if (!u) {
      try { u = crypto.randomUUID ? crypto.randomUUID() : ('' + Date.now() + '-' + Math.random().toString(16).slice(2) + '-' + Math.random().toString(16).slice(2)); } catch (e) { u = '' + Date.now() + Math.random(); }
      try { localStorage.setItem('sb_device_uuid', u); } catch (e) {}
    }
    return 'WEB-' + String(u).replace(/-/g, '').slice(0, 24).toUpperCase();
  }
  function deviceShort() { var d = deviceCode(); return d.slice(0, 9) + '…' + d.slice(-4); }

  /* ============================ Firestore — مشروع الترخيص المستقل ============================ */
  /* v1.16: مشروع المالك (stonebill-3455c) كتطبيق فايربيس منفصل باسم sblicense —
     حتى لا يتأثر نظام النسخ الاحتياطي لجوجل درايف (تطبيق افتراضي بمشروع قديم) إطلاقاً.
     كل مجموعات الترخيص sb_* تعيش في مشروع المالك وفق قواعد firestore.rules */
  var SB_FB_CFG = {
    apiKey: 'AIzaSyDqc17WkMllznL2ru7OSsqGWLFSawpNtzA',
    authDomain: 'stonebill-3455c.firebaseapp.com',
    projectId: 'stonebill-3455c',
    storageBucket: 'stonebill-3455c.firebasestorage.app',
    messagingSenderId: '398349274336',
    appId: '1:398349274336:web:98e829192349d873a55485'
  };
  var SB_APP_NAME = 'sblicense';
  function getLicenseApp() {
    if (!window.firebase || !window.firebase.initializeApp) return null;
    try { return window.firebase.app(SB_APP_NAME); }
    catch (e) { try { return window.firebase.initializeApp(SB_FB_CFG, SB_APP_NAME); } catch (e2) { return null; } }
  }
  var dbPromise = null;
  function getDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      var settled = false;
      function ok(v) { if (!settled) { settled = true; resolve(v); } }
      function bad(e) { if (!settled) { settled = true; reject(e); } }
      try {
        if (!window.firebase || !window.firebase.firestore) return bad(new Error('nofb'));
        var app = getLicenseApp();
        if (!app) return bad(new Error('noapp'));
        try { ok(app.firestore()); } catch (e) { bad(e); }
        setTimeout(function () { bad(new Error('timeout')); }, 12000);
      } catch (e) { bad(e); }
    });
    return dbPromise;
  }
  function licenseAuth() { var a = getLicenseApp(); return (a && a.auth) ? a.auth() : null; }
  var authWatched = false;
  function watchAuth() {
    if (authWatched) return;
    authWatched = true;
    getDb().then(function () {
      var auth = licenseAuth();
      if (!auth) { authWatched = false; return; }
      try {
        auth.onAuthStateChanged(function (user) {
          if (!user) return;
          var t = jget(LS.transfer);
          if (!t || !t.lic) return;
          if (C.normalizeEmail(user.email || '') !== t.lic.email) {
            jdel(LS.transfer);
            toast('سجّل الدخول بنفس البريد المسجّل في الاشتراك: ' + t.lic.email, 'warning');
            return;
          }
          completeTransfer(t.lic);
        });
      } catch (e) {}
    }).catch(function () { authWatched = false; });
  }

  /* ============================ الحالة ============================ */
  function state() {
    var lic = jget(LS.lic), t = safeNow();
    if (lic && lic.codeId) {
      var expMs = Date.parse(lic.exp + 'T23:59:59Z');
      var daysLeft = Math.ceil((expMs - t) / 86400000);
      if (!lic.pendingCloud && daysLeft >= 0) {
        return { mode: 'licensed', daysLeft: daysLeft, expiry: lic.exp, email: lic.email, plan: lic.plan, seats: seatCount(lic), kind: lic.kind || 0, owner: isOwnerPlan(lic.plan) };
      }
      if (lic.pendingCloud && daysLeft >= 0) {
        return { mode: 'licensed', daysLeft: daysLeft, expiry: lic.exp, email: lic.email, plan: lic.plan, seats: seatCount(lic), kind: lic.kind || 0, pending: true, owner: isOwnerPlan(lic.plan) };
      }
      return { mode: 'expired', reason: 'انتهى اشتراكك في ' + lic.exp, email: lic.email, expiry: lic.exp };
    }
    var trial = jget(LS.trial);
    if (trial && trial.used) {
      return { mode: 'trialused', reason: 'التجربة المجانية استُخدمت من قبل' + (trial.email ? ' (البريد: ' + trial.email + ')' : '') };
    }
    if (trial) {
      var winDays = trial.email ? CFG.trialDays : CFG.legacyTrialDays;
      var trialLeft = Math.ceil((trial.start + winDays * 86400000 - t) / 86400000);
      if (trialLeft > 0) return { mode: 'trial', daysLeft: trialLeft, email: trial.email || '' };
      return { mode: 'expired', reason: 'انتهت فترة التجربة المجانية (' + winDays + ' يوم)' };
    }
    return { mode: 'fresh' }; /* لم تبدأ تجربة بعد — بوابة الترحيب تطلب البريد */
  }
  function isLicensed() { return state().mode === 'licensed'; }
  /* v1.19: مقاعد الصنايعية — من الكود لو موجود، والافتراضي 2 لباقات الحزمة (قاعدة الـ49 للزيادة بيتطبق في التسعير) */
  function seatCount(lic) {
    if (lic && lic.seats && lic.seats > 0) return lic.seats;
    return WORKSHOP_PLANS.indexOf(lic && lic.plan) >= 0 ? 2 : 0;
  }
  /* v1.19: كود صنايعي (kind=1) = الجهاز ده للمصنعية بس — وضع المدير مقفول عليه */
  function isCraftsmanCode() {
    var lic = jget(LS.lic);
    return !!(lic && lic.kind === 1);
  }
  function planLabel(id) { if (isOwnerPlan(id)) return 'باقة المالك — مدى الحياة'; var p = null; for (var i = 0; i < CFG.plans.length; i++) if (CFG.plans[i].id === id) p = CFG.plans[i]; return p ? p.name : 'باقة'; }
  /* v1.16: باقة «المدير فقط» (1/3/5) لا تشمل وضع الصنايعي — يتطلب باقة تشمل الصنايعية (2/4/6/8)
     أثناء التجربة مفتوح ليجرّ كل حاجة قبل الشراء (قرار قابل للعكس بسطر واحد) */
  var WORKSHOP_PLANS = [2, 4, 6];
  function craftsmanAllowed() {
    var s = state();
    if (s.mode === 'trial' || s.mode === 'fresh') return true;
    if (s.mode !== 'licensed') return false;
    if (s.owner) return true;
    return WORKSHOP_PLANS.indexOf(s.plan) >= 0;
  }

  /* سباق زمني — لا يجوز أن يحجب السحابة التفعيل أكثر من مهلة قصوى (أوفلاين-أولاً) */
  function withTimeout(p, ms, fallbackVal) {
    return new Promise(function (resolve) {
      var done = false;
      var t = setTimeout(function () { if (!done) { done = true; resolve(fallbackVal); } }, ms);
      p.then(function (v) { if (!done) { done = true; clearTimeout(t); resolve(v); } },
             function () { if (!done) { done = true; clearTimeout(t); resolve(fallbackVal); } });
    });
  }
  var CLOUD_TIMEOUT = 8000;

  /* ================== التحقق: Ed25519 v2 فقط ==================
     v1.16: مسار HMAC v1 أُزيل أمنياً — سر v1 كان مضمّناً في index.html المنشور
     على GitHub فيمكن تزوير أكواد v1؛ Ed25519 (مفتاح عام فقط) هو الجذر الوحيد للثقة.
     كود v1 القديم (40 رمزاً) يُرفض برسالة «إصدار قديم» بدل «كود غير صالح» */
  function verifyAuto(code, email) {
    if (C2) {
      var n = C2.normalizeCode(code);
      if (n.length === 40) return Promise.resolve({ ok: false, reason: 'version' });
      return C2.verifyCode(code, email);
    }
    return Promise.resolve({ ok: false, reason: 'version' });
  }

  /* ================== التجربة: علم سحابي مرة واحدة (جهاز + بريد) ================== */
  function trialDeviceRef(db) { return db.collection('sb_trials').doc(deviceCode()); }
  function trialEmailRef(db, email) { return db.collection('sb_trialemails').doc(trialEmailDocIdSafe(email)); }
  function trialUsedCheck(email) {
    var attempt = getDb().then(function (db) {
      var jobs = [trialDeviceRef(db).get().catch(function () { return null; })];
      if (email) jobs.push(trialEmailRef(db, email).get().catch(function () { return null; }));
      return Promise.all(jobs).then(function (snaps) {
        var byDev = snaps[0] && snaps[0].exists;
        var byMail = snaps[1] && snaps[1].exists;
        if (byDev || byMail) return { used: true, by: byDev ? 'device' : 'email' };
        return { used: false };
      });
    }).catch(function () { return { reason: 'network' }; });
    return withTimeout(attempt, 6000, { reason: 'network' });
  }
  function trialMarkUsed(email, by) {
    jset(LS.trial, { used: true, email: email || (jget(LS.trial) || {}).email || '', by: by || '', at: safeNow() });
  }
  function cloudMarkTrial(email) {
    var attempt = getDb().then(function (db) {
      var at = new Date().toISOString();
      var d = trialDeviceRef(db).set({ device: deviceCode(), email: email || '', at: at });
      var e = email ? trialEmailRef(db, email).set({ email: email, device: deviceCode(), at: at }) : Promise.resolve();
      return Promise.all([d, e]).then(function () { return { ok: true }; }).catch(function () {
        return trialUsedCheck(email).then(function (r) {
          if (r.used) return { ok: false, reason: 'used', by: r.by };
          return { ok: false, reason: 'network' };
        });
      });
    }).catch(function () { return { ok: false, reason: 'network' }; });
    return withTimeout(attempt, CLOUD_TIMEOUT, { ok: false, reason: 'network' });
  }
  function startTrial(emailRaw, ui) {
    var email = C.normalizeEmail(emailRaw);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      if (ui.err) { ui.err.textContent = 'اكتب بريداً إلكترونياً صحيحاً — عليه يرتبط اشتراكك وترخيصك.'; ui.err.style.display = 'block'; }
      return;
    }
    if (ui.btn) { ui.btn.disabled = true; ui.btn.dataset.t = ui.btn.textContent; ui.btn.textContent = 'جاري التجهيز…'; }
    var proceed = function (pendingCloudTrial) {
      jset(LS.trial, { email: email, device: deviceCode(), start: safeNow(), pendingCloudTrial: !!pendingCloudTrial });
      if (ui.btn) { ui.btn.disabled = false; if (ui.btn.dataset.t) ui.btn.textContent = ui.btn.dataset.t; }
      closeGate(); refreshSettingsUI();
      toast('بدأت تجربتك المجانية ' + CFG.trialDays + ' أيام ✓', 'success');
      cloudMarkTrial(email).then(function (r) {
        var t = jget(LS.trial);
        if (r && r.reason === 'used') { trialMarkUsed(email, r.by); renderGate(); openGate(false); }
        else if (t && t.pendingCloudTrial && r && r.ok) { t.pendingCloudTrial = false; jset(LS.trial, t); }
      });
    };
    trialUsedCheck(email).then(function (r) {
      if (r.used) {
        if (ui.btn) { ui.btn.disabled = false; if (ui.btn.dataset.t) ui.btn.textContent = ui.btn.dataset.t; }
        trialMarkUsed(email, r.by);
        if (ui.err) { ui.err.textContent = 'التجربة المجانية استُخدمت من قبل على هذا الجهاز أو هذا البريد — فعّل كود اشتراك للمتابعة.'; ui.err.style.display = 'block'; }
        renderGate();
        return;
      }
      proceed(r.reason === 'network'); /* أوفلاين → تجربة محلية تتحقق عند أول اتصال */
    });
  }
  function trialCloudVerify() { /* عند الإقلاع/الاتصال: تجربة معلقة فقط (العلم مسجل → لا شيء) */
    var trial = jget(LS.trial);
    if (!trial || trial.used || !trial.pendingCloudTrial) return;
    trialUsedCheck(trial.email || '').then(function (r) {
      if (!r.used) {
        cloudMarkTrial(trial.email).then(function (m) {
          if (m && m.ok) { trial.pendingCloudTrial = false; jset(LS.trial, trial); }
          else if (m && m.reason === 'used') { trialMarkUsed(trial.email, m.by); renderGate(); openGate(false); }
        });
        return;
      }
      /* العلم موجود سلفاً: لو لجهازنا الحالي وبنفس بريدنا فهو علامتنا (ضاعت الاستجابة سابقاً)،
         وإلا فهو استخدام من تثبيت/بريد آخر → رفض */
      getDb().then(function (db) {
        return trialDeviceRef(db).get().then(function (s) {
          var d = (s && s.exists) ? (s.data() || {}) : {};
          if (d.device === deviceCode() && (!trial.email || d.email === trial.email)) {
            trial.pendingCloudTrial = false; jset(LS.trial, trial);
          } else { trialMarkUsed(trial.email, r.by); renderGate(); openGate(false); }
        });
      }).catch(function () {});
    });
  }

  /* ================== قفل البريد→الجهاز (بريد واحد = جهاز واحد) ================== */
  function emailRef(db, email) { return db.collection('sb_emails').doc(emailDocIdSafe(email)); }
  function emailClaim(lic) {
    /* المالك: أجهزة غير محدودة — لا يُسجل قفل بريد إطلاقاً */
    if (isOwnerPlan(lic.plan)) return Promise.resolve({ ok: true });
    var attempt = getDb().then(function (db) {
      var ref = emailRef(db, lic.email);
      return ref.get().then(function (snap) {
        var my = deviceCode();
        if (!snap.exists) {
          return ref.set({ email: lic.email, device: my, plan: lic.plan || 0, exp: lic.exp || '', claimedAt: new Date().toISOString() })
            .then(function () { return { ok: true }; })
            .catch(function () { return ref.get().then(function (s2) { var d2 = s2.data() || {}; return { ok: d2.device === my, reason: d2.device === my ? '' : 'bound' }; }).catch(function () { return { ok: false, reason: 'network' }; }); });
        }
        var d = snap.data() || {};
        if (!d.device || d.device === my) {
          return ref.update({ device: my, claimedAt: new Date().toISOString() })
            .then(function () { return { ok: true }; })
            .catch(function () { return ref.get().then(function (s3) { var d3 = s3.data() || {}; return { ok: d3.device === my, reason: d3.device === my ? '' : 'bound' }; }).catch(function () { return { ok: false, reason: 'network' }; }); });
        }
        return { ok: false, reason: 'bound', device: d.device };
      });
    }).catch(function () { return { ok: false, reason: 'network' }; });
    return withTimeout(attempt, CLOUD_TIMEOUT, { ok: false, reason: 'network' });
  }
  function emailBoundCheck(lic) { /* فحص صامت عند الإقلاع — لا يحجب أوفلاين */
    if (!C2 || !lic || !lic.email || isOwnerPlan(lic.plan)) return;
    emailClaim(lic).then(function (r) {
      if (r && r.reason === 'bound') {
        lic.emailBound = true; saveLicense(lic);
        renderGate(); openGate(false);
      } else if (r && r.ok && lic.emailBound) { delete lic.emailBound; saveLicense(lic); }
    });
  }

  /* ============================ المطالبة السحابية (قفل الجهاز) ============================ */
  function judge(snap, lic) {
    var d = snap.data() || {};
    if (d.revoked === true) return Promise.resolve({ ok: false, reason: 'revoked' });
    /* المالك (8): بلا قفل أجهزة — أي عدد من الأجهزة يتفعل بنفس الكود (الإيقاف ما زال يعمل) */
    if (isOwnerPlan(lic.plan) || d.plan === 8) return Promise.resolve({ ok: true });
    if (d.exp && d.exp !== lic.exp) return Promise.resolve({ ok: false, reason: 'mismatch' });
    var my = deviceCode();
    if (!d.device || d.device === my) {
      return snap.ref.update({ device: my, claimedAt: new Date().toISOString() }).then(function () {
        return { ok: true };
      }).catch(function () {
        return snap.ref.get().then(function (s3) {
          var d3 = s3.data() || {};
          return { ok: d3.device === my, reason: d3.device === my ? '' : 'bound' };
        }).catch(function () { return { ok: false, reason: 'network' }; });
      });
    }
    return Promise.resolve({ ok: false, reason: 'bound' });
  }
  function cloudClaim(lic) {
    var attempt = getDb().then(function (db) {
      var ref = db.collection('sb_licenses').doc(lic.codeId);
      return ref.get().then(function (snap) {
        if (!snap.exists) {
          /* الكود موقّع محلياً لكن مستنده غير منشور (توليد أوفلاين) → إنشاء + مطالبة */
          return ref.set({
            email: lic.email, exp: lic.exp, plan: lic.plan,
            device: '', revoked: false, issuedAt: new Date().toISOString(), claimedAt: ''
          }).then(function () {
            if (isOwnerPlan(lic.plan)) return { ok: true }; /* المالك: لا يُقيَّد بجهاز */
            return ref.update({ device: deviceCode(), claimedAt: new Date().toISOString() });
          })
            .then(function () { return { ok: true }; })
            .catch(function () {
              return ref.get().then(function (s2) { return judge(s2, lic); }).catch(function () { return { ok: false, reason: 'network' }; });
            });
        }
        return judge(snap, lic);
      }).catch(function () { return { ok: false, reason: 'network' }; });
    }).catch(function () { return { ok: false, reason: 'network' }; }); /* لا فاير بيس/لا شبكة → مسار مؤقت */
    return withTimeout(attempt, CLOUD_TIMEOUT, { ok: false, reason: 'network' });
  }

  /* ============================ التفعيل والنقل ============================ */
  function saveLicense(lic) { jset(LS.lic, lic); }
  var activating = false;
  function activate(code, email, ui) {
    if (activating) return;
    activating = true;
    if (ui.btn) { ui.btn.disabled = true; ui.btn.dataset.t = ui.btn.textContent; ui.btn.textContent = 'جاري التحقق…'; }
    ui.err.style.display = 'none';
    verifyAuto(code, email).then(function (v) {
      if (!v.ok) { fail(reasonText(v.reason)); return null; }
      var lic = {
        codeId: v.codeId, code: v.code || C.normalizeCode(code), email: C.normalizeEmail(email),
        exp: v.exp, plan: v.plan, device: deviceCode(), pendingCloud: false,
        ver: v.code ? 2 : 1,
        /* v1.19: مقاعد الصنايعية + نوع الجهاز من الكود (أكواد v1.3 بدونها → قيم افتراضية) */
        seats: v.seats || 0, kind: v.kind || 0,
        activatedAt: new Date().toISOString()
      };
      return cloudClaim(lic).then(function (res) {
        if (res.ok) {
          return emailClaim(lic).then(function (er) {
            if (er && er.reason === 'bound') { showBound(ui, lic); return; }
            saveLicense(lic); success();
            return;
          });
        }
        if (res.reason === 'revoked') fail('هذا الكود موقوف من إدارة التطبيق — تواصل معنا واتساب ' + CFG.cashNumber);
        else if (res.reason === 'mismatch') fail('تعارض في بيانات الكود — تواصل معنا واتساب ' + CFG.cashNumber);
        else if (res.reason === 'bound') showBound(ui, lic);
        else { /* شبكة/فاير بيس غير جاهز → تفعيل مؤقت يتحقق سحابياً عند أول اتصال */
          lic.pendingCloud = true; saveLicense(lic); success();
          toast('تم التفعيل ✓ — التحقق النهائي يتم عند توفر الإنترنت', 'info');
        }
      });
    }).catch(function () { fail('حدث خطأ غير متوقع — حاول مرة أخرى'); });

    function fail(msg) { activating = false; restore(); ui.err.textContent = msg; ui.err.style.display = 'block'; }
    function success() { activating = false; restore(); jdel(LS.transfer); renderGate(); toast('تم تفعيل الاشتراك بنجاح ✓', 'success'); closeGate(); refreshSettingsUI(); }
    function restore() { if (ui.btn) { ui.btn.disabled = false; if (ui.btn.dataset.t) ui.btn.textContent = ui.btn.dataset.t; } }
  }
  function reasonText(r) {
    if (r === 'format') return 'كود غير صالح — راجع الحروف والأرقام واكتبه كاملاً';
    if (r === 'signature') return 'كود غير صالح — تأكد من نسخه بالكامل من رسالة الواتساب';
    if (r === 'email') return 'الكود مسجّل على بريد إلكتروني مختلف — اكتب نفس البريد اللي بعتته للإدارة';
    if (r === 'expired') return 'انتهت صلاحية هذا الكود — جدّد اشتراكك (حوّل + ابعت إيصال على واتساب)';
    if (r === 'version') return 'كود من إصدار قديم — تواصل معنا واتساب ' + CFG.cashNumber;
    return 'كود غير صالح — تأكد من نسخه كاملاً من رسالة الواتساب ومن بريدك';
  }
  function showBound(ui, lic) {
    ui.err.innerHTML = 'هذا الكود مفعّل على جهاز آخر.<br>لنقل الاشتراك لجهازك: سجّل الدخول بجوجل بنفس البريد المسجّل (' +
      '<b>' + lic.email + '</b>) أو تواصل واتساب.';
    ui.err.style.display = 'block';
    var wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex; gap:8px; margin-top:10px; flex-wrap:wrap;';
    var b1 = document.createElement('button');
    b1.type = 'button'; b1.className = 'sbl-btn sbl-btn-primary';
    b1.textContent = 'نقل الترخيص عبر جوجل';
    b1.onclick = function () { startTransfer(lic); };
    var b2 = document.createElement('button');
    b2.type = 'button'; b2.className = 'sbl-btn sbl-btn-wa';
    b2.textContent = 'واتساب الإدارة';
    b2.onclick = function () { window.open(waLink('أهلاً، عايز أنقل اشتراكي لجهاز جديد.\nبريدي: ' + lic.email + '\nالكود: ' + lic.code), '_blank'); };
    wrap.appendChild(b1); wrap.appendChild(b2);
    ui.err.parentNode.insertBefore(wrap, ui.err.nextSibling);
  }
  function startTransfer(lic) {
    jset(LS.transfer, { lic: lic, at: Date.now() });
    watchAuth();
    getDb().then(function () {
      var auth = licenseAuth();
      var cu = null;
      try { cu = auth.currentUser; } catch (e) {}
      if (cu && C.normalizeEmail(cu.email || '') === lic.email) { completeTransfer(lic); return; }
      /* v1.16: دخول جوجل على مشروع الترخيص نفسه (وليس درايف) — redirect يعمل داخل WebView */
      try {
        var provider = new window.firebase.auth.GoogleAuthProvider();
        licenseAuth().signInWithRedirect(provider);
        toast('كمّل اختيار حساب جوجل بنفس البريد: ' + lic.email, 'info');
      } catch (e) { toast('خدمة جوجل غير متاحة الآن — تواصل واتساب ' + CFG.cashNumber, 'warning'); }
    }).catch(function () { toast('تحتاج اتصال إنترنت لنقل الترخيص', 'warning'); });
  }
  function completeTransfer(lic) {
    return cloudClaim(lic).then(function (res) {
      jdel(LS.transfer);
      if (res.ok) {
        lic.pendingCloud = false; lic.device = deviceCode(); saveLicense(lic);
        emailClaim(lic);
        toast('تم نقل الاشتراك لهذا الجهاز ✓', 'success');
        renderGate(); closeGate(); refreshSettingsUI();
      } else {
        toast(res.reason === 'revoked' ? 'الكود موقوف — تواصل واتساب ' + CFG.cashNumber : 'تعذر نقل الترخيص — تواصل واتساب ' + CFG.cashNumber, 'danger');
      }
    }).catch(function () { toast('تحتاج اتصال إنترنت لنقل الترخيص', 'warning'); });
  }
  /* إعادة محاولة المطالبة المعلقة عند توفر الإنترنت */
  function resolvePending() {
    var lic = jget(LS.lic);
    trialCloudVerify();
    if (!lic) return;
    if (!lic.pendingCloud) { if (!lic.emailBound) emailBoundCheck(lic); return; }
    cloudClaim(lic).then(function (res) {
      if (res.ok) {
        lic.pendingCloud = false; saveLicense(lic);
        emailClaim(lic).then(function (er) {
          if (er && er.reason === 'bound') { lic.emailBound = true; saveLicense(lic); renderGate(); openGate(false); }
        });
        refreshSettingsUI(); return;
      }
      clearLicense();
      refreshSettingsUI();
      toast('تم إلغاء التفعيل: الكود مستخدم على جهاز آخر أو موقوف. تواصل واتساب ' + CFG.cashNumber, 'danger');
      renderGate();
    }).catch(function () {});
  }

  /* ============================ واجهة البوابة ============================ */
  var gate = null;
  function ensureGate() {
    if (gate) return gate;
    var css = document.createElement('style');
    css.textContent =
      '#sblGate{position:fixed;inset:0;background:var(--bg);z-index:99995;display:none;overflow-y:auto;direction:rtl;font-family:inherit}' +
      '#sblGate .sbl-wrap{min-height:100%;display:flex;align-items:flex-start;justify-content:center;padding:21px 13px}' +
      '#sblGate .sbl-card{width:100%;max-width:479px;background:var(--card-bg);border:1.5px solid var(--border);border-radius:21px;box-shadow:var(--shadow-lg);overflow:hidden}' +
      '#sblGate .sbl-head{background:linear-gradient(135deg,var(--primary),var(--secondary));color:var(--on-primary);padding:21px 18px;display:flex;align-items:center;gap:13px}' +
      '#sblGate .sbl-head h2{margin:0;font-size:18px;font-weight:900;flex:1}' +
      '#sblGate .sbl-body{padding:18px}' +
      '#sblGate .sbl-status{border-radius:13px;padding:10px 13px;font-size:13px;font-weight:800;margin-bottom:13px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}' +
      '#sblGate .sbl-st-ok{background:rgba(14,159,110,.12);color:var(--success);border:1px solid rgba(14,159,110,.3)}' +
      '#sblGate .sbl-st-warn{background:rgba(217,119,6,.12);color:var(--warning);border:1px solid rgba(217,119,6,.3)}' +
      '#sblGate .sbl-st-bad{background:rgba(220,38,38,.1);color:var(--danger);border:1px solid rgba(220,38,38,.3)}' +
      '#sblGate .sbl-plans{display:flex;gap:8px;margin-bottom:13px}' +
      '#sblGate .sbl-plan{flex:1;background:var(--card-bg-alt);border:1.5px solid var(--border);border-radius:13px;padding:13px 8px;text-align:center;cursor:pointer;position:relative;transition:border-color .15s,box-shadow .15s;font-family:inherit}' +
      '#sblGate .sbl-plan .sbl-ico{font-size:26px;line-height:1;margin-bottom:6px}' +
      '#sblGate .sbl-plan .sbl-pname{display:block;font-size:11.5px;font-weight:900;color:var(--text);line-height:1.5}' +
      '#sblGate .sbl-plan .sbl-desc{display:block;font-size:9.5px;color:var(--text-muted);line-height:1.6;margin-top:4px}' +
      '#sblGate .sbl-plan .sbl-check{position:absolute;top:7px;right:7px;width:19px;height:19px;border-radius:50%;background:var(--primary);color:var(--on-primary);font-size:11px;display:none;align-items:center;justify-content:center;font-weight:900}' +
      '#sblGate .sbl-plan.sel{border-color:var(--primary);box-shadow:0 0 0 2px var(--primary) inset;background:var(--card-bg)}' +
      '#sblGate .sbl-plan.sel .sbl-check{display:flex}' +
      '#sblGate .sbl-tabs{display:flex;background:var(--card-bg-alt);border:1.5px solid var(--border);border-radius:12px;padding:4px;gap:4px;margin-bottom:14px}' +
      '#sblGate .sbl-tab{flex:1;border:none;background:transparent;border-radius:9px;padding:9px 4px;font-size:12px;font-weight:900;color:var(--text-muted);cursor:pointer;font-family:inherit;position:relative}' +
      '#sblGate .sbl-tab.on{background:var(--primary);color:var(--on-primary);box-shadow:0 1px 4px rgba(0,0,0,.14)}' +
      '#sblGate .sbl-tab .sbl-tab-badge{position:absolute;top:-8px;left:7px;background:var(--success);color:#fff;font-size:8.5px;font-weight:900;border-radius:8px;padding:1px 6px}' +
      '#sblGate .sbl-cta{display:flex;gap:9px;align-items:center;background:var(--card-bg-alt);border:1.5px solid var(--border);border-radius:13px;padding:10px 12px;margin-top:12px}' +
      '#sblGate .sbl-cta .sbl-cta-info{flex:1;font-size:11px;color:var(--text-muted);line-height:1.7;text-align:right}' +
      '#sblGate .sbl-cta .sbl-cta-info b{color:var(--text);font-size:12px}' +
      '#sblGate .sbl-plan b{display:block;font-size:18px;color:var(--primary);margin:5px 0 2px}' +
      '#sblGate .sbl-plan span{font-size:11px;color:var(--text-muted)}' +
      '#sblGate .sbl-steps{background:var(--card-bg-alt);border:1.5px solid var(--border);border-radius:13px;padding:13px;margin-bottom:13px}' +
      '#sblGate .sbl-steps .sbl-step{display:flex;gap:8px;align-items:flex-start;margin-bottom:8px;font-size:12.5px;color:var(--text);line-height:1.7}' +
      '#sblGate .sbl-steps .sbl-step:last-child{margin-bottom:0}' +
      '#sblGate .sbl-num{min-width:21px;height:21px;border-radius:50%;background:var(--primary);color:var(--on-primary);font-size:11px;font-weight:900;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px}' +
      '#sblGate .sbl-cash{font-weight:900;color:var(--primary);font-size:14px;letter-spacing:1px;direction:ltr;display:inline-block}' +
      '#sblGate .sbl-btn{border:none;border-radius:10px;padding:9px 16px;font-size:12.5px;font-weight:800;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:6px;justify-content:center}' +
      '#sblGate .sbl-btn-primary{background:var(--primary);color:var(--on-primary)}' +
      '#sblGate .sbl-btn-wa{background:var(--whatsapp,#1eb95d);color:#fff}' +
      '#sblGate .sbl-btn-ghost{background:var(--card-bg);color:var(--text);border:1px solid var(--border)}' +
      '#sblGate .sbl-form{display:flex;flex-direction:column;gap:8px;margin-bottom:8px}' +
      '#sblGate .sbl-input{width:100%;box-sizing:border-box;border:1.5px solid var(--border);border-radius:10px;padding:11px 13px;font-size:13.5px;font-weight:700;background:var(--card-bg);color:var(--text);font-family:inherit}' +
      '#sblGate .sbl-input:focus{outline:none;border-color:var(--primary)}' +
      '#sblGate #sblCode{direction:ltr;text-align:center;letter-spacing:1px;font-size:13px}' +
      '#sblGate #sblEmail{direction:ltr;text-align:left}' +
      '#sblGate .sbl-err{display:none;background:rgba(220,38,38,.08);border:1px solid rgba(220,38,38,.3);color:var(--danger);border-radius:10px;padding:10px 13px;font-size:12.5px;font-weight:700;line-height:1.8;margin-bottom:8px}' +
      '#sblGate .sbl-note{font-size:11px;color:var(--text-muted);line-height:1.8;margin-top:10px;text-align:center}' +
      /* v1.16: عرض الباقات بمستويين (مدير / مدير وصنايعية) × ثلاث مدد بمفهوم ٩٩ */
      '#sblGate .sbl-tier{font-size:12px;font-weight:900;color:var(--text);margin:11px 0 6px;display:flex;align-items:center;gap:6px}' +
      '#sblGate .sbl-tier .sbl-tier-dot{width:7px;height:7px;border-radius:50%;background:var(--primary);flex-shrink:0}' +
      '#sblGate .sbl-tier:first-of-type{margin-top:0}' +
      '#sblGate .sbl-plan-best{border-color:var(--primary) !important;box-shadow:0 0 0 1px var(--primary) inset}' +
      '#sblGate .sbl-save{display:inline-block;font-size:10px;font-weight:900;color:var(--success);background:rgba(14,159,110,.1);border-radius:8px;padding:1px 7px;margin-top:3px}' +
      '#sblGate .sbl-extraw{background:var(--card-bg-alt);border:1.5px dashed var(--border);border-radius:10px;padding:8px 13px;font-size:11.5px;color:var(--text-muted);margin-top:9px;text-align:center;line-height:1.8}' +
      '#sblGate .sbl-extraw b{color:var(--primary)}' +
      '#sblGate #sblContinue{display:none;width:100%;padding:12px;font-size:14px;margin-bottom:13px}' +
      '#sblGate .sbl-mini{font-size:11px;color:var(--text-muted);text-align:center;margin-top:13px;padding-top:13px;border-top:1px solid var(--border)}' +
      '@media print{#sblGate{display:none !important}}';
    document.head.appendChild(css);

    gate = document.createElement('div');
    gate.id = 'sblGate';
    gate.innerHTML =
      '<div class="sbl-wrap"><div class="sbl-card">' +
      '<div class="sbl-head">' +
      '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>' +
      '<h2>اشتراك StoneBill</h2>' +
      '<button type="button" id="sblClose" style="display:none;background:rgba(255,255,255,.2);border:none;color:inherit;width:29px;height:29px;border-radius:50%;font-size:16px;font-weight:900;cursor:pointer;">×</button>' +
      '</div>' +
      '<div class="sbl-body">' +
      '<div id="sblStatus"></div>' +
      /* v1.16: زر الدخول أثناء سريان التجربة — البوابة تظهر عند كل فتح لكن مش قفل */
      '<button id="sblContinue" type="button" class="sbl-btn sbl-btn-primary">الدخول للتطبيق</button>' +
      '<div id="sblPlans" style="display:block"></div>' +
      '<div id="sblWelcome" style="display:none;margin-bottom:13px;">' +
      '<div style="background:var(--card-bg-alt);border:1.5px solid var(--border);border-radius:13px;padding:13px;margin-bottom:10px;">' +
      '<div style="font-size:14.5px;font-weight:900;color:var(--text);margin-bottom:4px;">ابدأ تجربتك المجانية ' + CFG.trialDays + ' أيام</div>' +
      '<div style="font-size:12px;color:var(--text-muted);line-height:1.9;margin-bottom:10px;">اكتب بريدك الإلكتروني ليُربط بتجربتك واشتراكك — التجربة مرة واحدة فقط لكل جهاز ولكل بريد، وبياناتها تُسجّل في السحابة فلا تُعاد بحذف التطبيق وإعادته.</div>' +
      '<input id="sblTrialEmail" class="sbl-input" type="email" placeholder="بريدك الإلكتروني — مثال: name@gmail.com" autocomplete="off" spellcheck="false" style="margin-bottom:8px;">' +
      '<button id="sblTrialGo" type="button" class="sbl-btn sbl-btn-primary" style="width:100%;padding:11px;font-size:13.5px;">ابدأ التجربة المجانية الآن</button>' +
      '</div>' +
      '<button id="sblToggleAct" type="button" class="sbl-btn sbl-btn-ghost" style="width:100%;">عندي كود تفعيل من الإدارة</button>' +
      '</div>' +
      '<div id="sblActivateBox">' +
      '<div class="sbl-steps">' +
      '<div class="sbl-step"><span class="sbl-num">1</span><span>حوّل مبلغ الباقة على <span class="sbl-cash">' + CFG.cashNumber + '</span> فودافون كاش <button type="button" class="sbl-btn sbl-btn-ghost" id="sblCopyCash" style="padding:4px 10px;font-size:11px;">نسخ</button></span></div>' +
      '<div class="sbl-step"><span class="sbl-num">2</span><span>ابعت إيصال التحويل + بريدك الإلكتروني واتساب <button type="button" class="sbl-btn sbl-btn-wa" id="sblWa" style="padding:4px 10px;font-size:11px;">واتساب</button></span></div>' +
      '<div class="sbl-step"><span class="sbl-num">3</span><span>هتوصلك رسالة فيها كود التفعيل — اكتبه هنا مع نفس البريد:</span></div>' +
      '</div>' +
      '<div class="sbl-form">' +
      '<input id="sblCode" class="sbl-input" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX" autocomplete="off" spellcheck="false">' +
      '<input id="sblEmail" class="sbl-input" type="email" placeholder="بريدك الإلكتروني (نفس المرسل للإدارة)" autocomplete="off" spellcheck="false">' +
      '<button id="sblGo" type="button" class="sbl-btn sbl-btn-primary" style="padding:12px;font-size:14px;">تفعيل الاشتراك</button>' +
      '</div>' +
      '<div id="sblErr" class="sbl-err"></div>' +
      '</div>' +
      '<div class="sbl-note">الاشتراك مربوط ببريدك وجهازك — بريد واحد = جهاز واحد فقط.<br>لو غيرت الموبايل: اضغط «نقل الترخيص عبر جوجل» بنفس البريد أو كلمنا واتساب.</div>' +
      '<div class="sbl-mini">StoneBill — فواتير وإدارة الرخام والجرانيت • دعم فني واتساب ' + CFG.cashNumber + '</div>' +
      '</div></div></div>';
    document.body.appendChild(gate);

    document.getElementById('sblCopyCash').onclick = function () { sblCopy(CFG.cashNumber, this); };
    document.getElementById('sblWa').onclick = function () { window.open(waLink(), '_blank'); };
    document.getElementById('sblGo').onclick = function () {
      activate(document.getElementById('sblCode').value, document.getElementById('sblEmail').value, {
        btn: this, err: document.getElementById('sblErr')
      });
    };
    document.getElementById('sblTrialGo').onclick = function () {
      startTrial(document.getElementById('sblTrialEmail').value, {
        btn: this, err: document.getElementById('sblErr')
      });
    };
    document.getElementById('sblToggleAct').onclick = function () {
      var box = document.getElementById('sblActivateBox');
      var showing = (box.style.display === 'none');
      box.style.display = showing ? 'block' : 'none';
      this.textContent = showing ? 'إخفاء خانة التفعيل — أبدأ التجربة' : 'عندي كود تفعيل من الإدارة';
    };
    document.getElementById('sblClose').onclick = function () { closeGate(); };
    /* v1.18: نظام باقات تفاعلي — تابات مدد + كروت بأيقونات تتختار بالضغط + زر اشتراك واتساب جاهز (بطلب المالك) */
    function tierRow(tier) {
      var cards = CFG.plans.filter(function (p) { return p.tier === tier; }).map(function (p) {
        return '<div class="sbl-plan' + (p.best ? ' sbl-plan-best' : '') + '">' +
          '<span>' + p.label + '</span><b>' + p.price + ' ج</b>' +
          (p.save ? '<span class="sbl-save">وفّر ' + p.save + ' ج</span>' : '<span style="visibility:hidden">·</span>') +
          '</div>';
      }).join('');
      return '<div class="sbl-plans">' + cards + '</div>';
    }
    var plansEl = document.getElementById('sblPlans');
    var ICONS = { 1: '👤', 2: '👥' };
    var DURS = [
      { days: 30,  label: 'شهري' },
      { days: 90,  label: 'ربع سنوي' },
      { days: 365, label: 'سنوي' }
    ];
    var selPlan = 2; /* الافتراضي: الحزمة (الأفضل تجارياً) */
    function planById(id) { for (var i = 0; i < CFG.plans.length; i++) if (CFG.plans[i].id === id) return CFG.plans[i]; return CFG.plans[0]; }
    function planTitle(p) { return p.name.split(' — ')[0]; }
    function durRow(d, first) {
      var cards = CFG.plans.filter(function (p) { return p.days === d.days; }).map(function (p) {
        return '<div class="sbl-plan' + (selPlan === p.id ? ' sel' : '') + '" data-plan="' + p.id + '" role="button" tabindex="0">' +
          '<span class="sbl-check">✓</span>' +
          '<div class="sbl-ico">' + ICONS[p.tier] + '</div>' +
          '<span class="sbl-pname">' + planTitle(p) + '</span>' +
          '<b>' + p.price + ' ج</b>' +
          (p.save ? '<span class="sbl-save">وفّر ' + p.save + ' ج</span>' : '') +
          '<span class="sbl-desc">' + (p.tier === 1 ? 'إدارة ورشتك لوحدك' : '🎁 أول اتنين مع بعض +50 بس') + '</span>' +
          '</div>';
      }).join('');
      return '<div class="sbl-dur" data-days="' + d.days + '"' + (first ? '' : ' style="display:none"') + '><div class="sbl-plans">' + cards + '</div></div>';
    }
    plansEl.innerHTML =
      '<div class="sbl-tabs" id="sblTabs">' +
      DURS.map(function (d, i) {
        return '<button type="button" class="sbl-tab' + (i === 0 ? ' on' : '') + '" data-d="' + d.days + '">' + d.label + (d.days === 365 ? '<span class="sbl-tab-badge">الأوفر</span>' : '') + '</button>';
      }).join('') +
      '</div>' +
      DURS.map(function (d, i) { return durRow(d, i === 0); }).join('') +
      '<div class="sbl-extraw">🎁 عرض الحزمة: أول <b>٢ صنايعية مع بعض +50 ج بس</b> فوق باقة المدير (الإجمالي 349) — ➕ أي صنايعي إضافي بعد الاتنين: <b>' + CFG.extraWorker + ' ج/شهر</b> للفرد</div>' +
      '<div class="sbl-cta"><div class="sbl-cta-info" id="sblCtaInfo"></div>' +
      '<button type="button" id="sblCtaGo" class="sbl-btn sbl-btn-wa">💬 اشترك الآن</button></div>';
    function refreshCta() {
      var p = planById(selPlan);
      document.getElementById('sblCtaInfo').innerHTML = 'اختيارك: <b>' + p.name + '</b> — <b>' + p.price + ' ج</b><br>حوّل فودافون كاش وابعتلنا — الكود يوصلك فوراً';
    }
    document.getElementById('sblTabs').addEventListener('click', function (ev) {
      var t = ev.target.closest ? ev.target.closest('.sbl-tab') : null;
      if (!t) return;
      plansEl.querySelectorAll('.sbl-tab').forEach(function (x) { x.classList.remove('on'); });
      t.classList.add('on');
      plansEl.querySelectorAll('.sbl-dur').forEach(function (g) { g.style.display = (g.getAttribute('data-days') === t.getAttribute('data-d')) ? '' : 'none'; });
    });
    plansEl.addEventListener('click', function (ev) {
      var c = ev.target.closest ? ev.target.closest('.sbl-plan') : null;
      if (!c) return;
      selPlan = parseInt(c.getAttribute('data-plan'), 10);
      plansEl.querySelectorAll('.sbl-plan').forEach(function (x) { x.classList.toggle('sel', x === c); });
      refreshCta();
    });
    document.getElementById('sblCtaGo').onclick = function () {
      var p = planById(selPlan);
      var em = '';
      try { em = (document.getElementById('sblTrialEmail') || {}).value || ''; } catch (e) {}
      window.open(waLink('أهلاً 👋 عايز أشترك في StoneBill:\nالباقة: ' + p.name + '\nالسعر: ' + p.price + ' ج' + (em ? '\nبريدي: ' + em : '') + '\nكود جهازي: ' + deviceCode()), '_blank');
    };
    refreshCta();
    var contBtn = document.getElementById('sblContinue');
    contBtn.onclick = function () { closeGate(); };
    return gate;
  }
  function renderGate() {
    ensureGate();
    var s = state(), st = document.getElementById('sblStatus'), closeBtn = document.getElementById('sblClose');
    var welcome = document.getElementById('sblWelcome');
    var actBox = document.getElementById('sblActivateBox');
    var contBtn = document.getElementById('sblContinue');
    closeBtn.style.display = 'none';
    contBtn.style.display = 'none';
    gate.dataset.mode = s.mode;
    /* v1.16: أثناء التجربة السارية زر الدخول ظاهر — الصفحة إعلامية مش قفل */
    if (s.mode === 'trial' && s.daysLeft > 0) {
      contBtn.style.display = 'flex';
      contBtn.textContent = 'الدخول للتطبيق — متبقي ' + s.daysLeft + (s.daysLeft === 1 ? ' يوم' : ' أيام') + ' من تجربتك';
    }
    if (s.mode === 'fresh') {
      welcome.style.display = 'block'; actBox.style.display = 'none';
      st.className = 'sbl-status sbl-st-warn';
      st.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' +
        'مرحباً بك في StoneBill — ابدأ تجربة مجانية ' + CFG.trialDays + ' أيام أو فعّل كود اشتراك.';
    } else if (s.mode === 'trialused') {
      welcome.style.display = 'none'; actBox.style.display = 'block';
      st.className = 'sbl-status sbl-st-bad';
      st.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>' +
        '⛔ ' + (s.reason || 'التجربة استُخدمت من قبل') + ' — فعّل كود اشتراك للمتابعة.';
    } else if (s.mode === 'licensed') {
      welcome.style.display = 'none'; actBox.style.display = 'block';
      st.className = 'sbl-status sbl-st-ok';
      if (s.owner) {
        st.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z"/></svg>' +
          'تفعيل <b>مدى الحياة</b> — باقة المالك ✓ (أجهزة غير محدودة)' +
          (s.pending ? ' • ينتظر التحقق السحابي' : '');
      } else {
        st.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' +
          'اشتراك ساري حتى <b>' + s.expiry + '</b> — متبقي ' + s.daysLeft + ' يوم (' + planLabel(s.plan) + ')' +
          (s.pending ? ' • ينتظر التحقق السحابي' : '');
      }
    } else if (s.mode === 'trial') {
      welcome.style.display = 'none'; actBox.style.display = 'block';
      st.className = 'sbl-status sbl-st-warn';
      st.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' +
        'تجربة مجانية' + (s.email ? ' (' + s.email + ')' : '') + ' — متبقي <b>' + s.daysLeft + '</b> يوم. اشترك للاستمرار بعد انتهاء التجربة.';
    } else {
      welcome.style.display = 'none'; actBox.style.display = 'block';
      st.className = 'sbl-status sbl-st-bad';
      st.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>' +
        (s.reason || 'انتهت صلاحية الاستخدام') + ' — اشترك دلوقتي وكمّل شغلك في دقيقة.';
    }
  }
  function openGate(manageMode) {
    renderGate();
    gate.style.display = 'block';
    /* في وضع الإدارة (مشترك أو تجربة سارية) نسمي الإغلاق ونخفي خطوات الدفع */
    var sNow = state();
    /* v1.16: === true صارمة — لأن 'soft' قيمة truthy ومش وضع إدارة */
    var licensedManage = (manageMode === true) && (sNow.mode === 'licensed' || sNow.mode === 'trial');
    /* v1.16: ظهور تلقائي عند فتح التطبيق أثناء التجربة = إعلامي: زر إغلاق ظاهر مع الأسعار */
    var softTrial = (manageMode === 'soft') && sNow.mode === 'trial';
    document.getElementById('sblClose').style.display = (licensedManage || softTrial) ? 'flex' : 'none';
    document.querySelector('#sblGate .sbl-steps').style.display = licensedManage ? 'none' : 'block';
    document.getElementById('sblCode').value = '';
    document.getElementById('sblEmail').value = '';
    document.getElementById('sblTrialEmail').value = '';
    document.getElementById('sblErr').style.display = 'none';
    try { localStorage.setItem('sb_gate_open', '1'); } catch (e) {}
  }
  function closeGate() {
    if (gate) gate.style.display = 'none';
    try { localStorage.removeItem('sb_gate_open'); } catch (e) {}
  }

  /* ============================ صفحة الإعدادات ============================ */
  function injectSettingsPage() {
    if (document.getElementById('settings-page-subscription')) return;
    var cutting = document.getElementById('settings-page-cutting');
    var div = document.createElement('div');
    div.id = 'settings-page-subscription';
    div.className = 'settings-page settings-neon-box';
    div.style.cssText = 'display:none; padding:18px 20px;';
    div.innerHTML =
      '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; border-bottom:1px solid var(--border); padding-bottom:12px; flex-wrap:wrap; gap:10px;">' +
      '<div><h3 style="margin:0; font-size:16.5px; color:var(--primary); font-weight:900; display:flex; align-items:center; gap:8px;">' +
      '<svg class="icon-svg" style="width:18px;height:18px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>' +
      '<span>الاشتراك والترخيص</span></h3>' +
      '<span style="font-size:12px; color:var(--text-muted);">حالة اشتراكك في التطبيق — التفعيل والنقل والتجديد</span></div></div>' +
      '<div id="sblSetStatus" style="background:var(--card-bg-alt); border:1.5px solid var(--border); border-radius:16px; padding:16px 18px; margin-bottom:16px;"></div>' +
      '<div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:16px;">' +
      '<button type="button" id="sblSetManage" class="sbl-btn sbl-btn-primary">إدارة / تفعيل كود</button>' +
      '<button type="button" id="sblSetWa" class="sbl-btn sbl-btn-wa">تواصل واتساب — اشتراك/دعم</button>' +
      '</div>' +
      '<div style="background:var(--card-bg-alt); border:1.5px solid var(--border); border-radius:16px; padding:16px 18px; font-size:12px; color:var(--text-muted); line-height:2;">' +
      '<b style="color:var(--text);">كيف يعمل الاشتراك؟</b><br>' +
      '• التجربة المجانية ' + CFG.trialDays + ' أيام — مرة واحدة فقط لكل جهاز ولكل بريد (تُسجّل في السحابة؛ حذف التطبيق لا يجددها).<br>' +
      '• الباقات: المدير <b>299ج/شهر</b> — مدير + ٢ صنايعية (عرض: الاتنين مع بعض +50 بس) <b>349ج/شهر</b> — الصنايعي الإضافي بعد الاتنين <b>' + CFG.extraWorker + 'ج/فرد</b>.<br>' +
      '• عروض المدد الأطول: ربع سنوي <b>799ج / 999ج</b> — سنوي <b>2,899ج / 3,999ج</b> (الأوفر).<br>' +
      '• باقة المدير فقط لا تشمل وضع الصنايعي — الترقية لباقة مدير + ٢ صنايعية تفتحه.<br>' +
      '• للاستمرار: حوّل على فودافون كاش <b dir="ltr">' + CFG.cashNumber + '</b> واستلم كود تفعيل على واتساب.<br>' +
      '• الاشتراك مربوط ببريدك + جهازك: بريد واحد = جهاز واحد فقط (وضع مدير + ٢ صنايعية على نفس الجهاز).<br>' +
      '• لو غيرت الموبايل: سجّل دخول جوجل بنفس البريد فينقل اشتراكك تلقائياً، أو كلمنا ونحرره في دقيقة.<br>' +
      '• كود الجهاز (للدعم الفني): <b dir="ltr" id="sblSetDevice" style="color:var(--text);"></b></div>';
    if (cutting && cutting.parentNode) cutting.parentNode.insertBefore(div, cutting.nextSibling);
    else document.body.appendChild(div);
    document.getElementById('sblSetManage').onclick = function () { openGate(true); };
    document.getElementById('sblSetWa').onclick = function () { window.open(waLink(), '_blank'); };
  }
  function refreshSettingsUI() {
    var el = document.getElementById('sblSetStatus');
    if (!el) return;
    var s = state();
    var chip = function (cls, txt) {
      return '<span style="display:inline-block;padding:4px 13px;border-radius:20px;font-size:11.5px;font-weight:800;margin-bottom:8px;" class="' + cls + '">' + txt + '</span>';
    };
    if (s.mode === 'licensed') {
      if (s.owner) {
        el.innerHTML = chip('sbl-st-ok', '👑 مالك التطبيق — تفعيل كامل') +
          '<div style="font-size:13.5px;color:var(--text);font-weight:800;">باقة المالك — <b>مدى الحياة</b> (بلا انتهاء، أجهزة غير محدودة)</div>' +
          '<div style="font-size:12px;color:var(--text-muted);margin-top:4px;">البريد المسجّل: <b dir="ltr">' + (s.email || '—') + '</b></div>' +
          (s.pending ? '<div style="font-size:12px;color:var(--warning);font-weight:800;margin-top:8px;">ينتظر التحقق السحابي عند توفر الإنترنت</div>' : '');
      } else {
        el.innerHTML = chip('sbl-st-ok', s.pending ? 'ساري — ينتظر التحقق السحابي' : 'اشتراك ساري ✓') +
          '<div style="font-size:13.5px;color:var(--text);font-weight:800;">' + planLabel(s.plan) + ' — ينتهي في <b>' + s.expiry + '</b> (متبقي ' + s.daysLeft + ' يوم)' + (s.seats > 0 ? ' • مقاعد الصنايعية: <b>' + s.seats + '</b>' : '') + '</div>' +
          '<div style="font-size:12px;color:var(--text-muted);margin-top:4px;">البريد المسجّل: <b dir="ltr">' + (s.email || '—') + '</b></div>' +
          (s.daysLeft <= 7 ? '<div style="font-size:12px;color:var(--warning);font-weight:800;margin-top:8px;">اشتراكك قريب من الانتهاء — جدّد الآن لتجنب توقف العمل</div>' : '');
      }
    } else if (s.mode === 'trial') {
      el.innerHTML = chip('sbl-st-warn', 'تجربة مجانية') +
        '<div style="font-size:13.5px;color:var(--text);font-weight:800;">متبقي ' + s.daysLeft + ' يوم من التجربة</div>' +
        (s.email ? '<div style="font-size:12px;color:var(--text-muted);margin-top:4px;">مرتبطة بالبريد: <b dir="ltr">' + s.email + '</b></div>' : '') +
        '<div style="font-size:12px;color:var(--text-muted);margin-top:4px;">اشترك الآن للاستمرار بدون توقف — التفعيل في دقيقة واحدة</div>';
    } else if (s.mode === 'trialused') {
      el.innerHTML = chip('sbl-st-bad', 'انتهت التجربة') +
        '<div style="font-size:13.5px;color:var(--text);font-weight:800;">' + (s.reason || 'التجربة استُخدمت من قبل') + '</div>' +
        '<div style="font-size:12px;color:var(--text-muted);margin-top:4px;">فعّل كود اشتراك لاستعادة الوصول الكامل</div>';
    } else {
      el.innerHTML = chip('sbl-st-bad', 'غير مشترك') +
        '<div style="font-size:13.5px;color:var(--text);font-weight:800;">' + (s.reason || 'انتهت صلاحية الاستخدام') + '</div>' +
        '<div style="font-size:12px;color:var(--text-muted);margin-top:4px;">فعّل كود اشتراك لاستعادة الوصول الكامل</div>';
    }
    var d = document.getElementById('sblSetDevice');
    if (d) d.textContent = deviceShort();
  }

  /* ============================ التكامل مع قائمة الإعدادات ============================ */
  function injectCatalog() {
    try {
      /* const على مستوى السكريبت — مرئي عبر الكتل */
      APP_BUTTONS_CATALOG['subscription'] = {
        id: 'subscription',
        title: 'الاشتراك والترخيص',
        i18n: 'menu_subscription',
        style: 'background: linear-gradient(135deg, #b8860b, #d4af37);',
        icon: '<svg class="icon-svg" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>',
        action: "openSettingsPage('subscription')",
        adminOnly: true,
        defaultCategory: 'settings'
      };
      if (DEFAULT_SETTINGS_KEYS.indexOf('subscription') < 0) DEFAULT_SETTINGS_KEYS.push('subscription');
    } catch (e) { console.warn('SBL catalog:', e); }
    try {
      if (localStorage.getItem('sb_layout_sub') !== '1') {
        var stored = JSON.parse(localStorage.getItem('app_settings_buttons_layout') || 'null');
        if (Array.isArray(stored) && stored.indexOf('subscription') < 0) {
          var idx = stored.indexOf('system');
          if (idx >= 0) stored.splice(idx + 1, 0, 'subscription'); else stored.push('subscription');
          localStorage.setItem('app_settings_buttons_layout', JSON.stringify(stored));
        }
        localStorage.setItem('sb_layout_sub', '1');
      }
    } catch (e) {}
    try { if (typeof window.renderCustomizedGrids === 'function') window.renderCustomizedGrids(); } catch (e) {}
  }

  /* ============================ التشغيل ============================ */
  function onAppReady() {
    injectCatalog();
    injectSettingsPage();
    refreshSettingsUI();
    watchAuth();
    resolvePending();
    var ob = document.getElementById('onboardingModal');
    if (ob && ob.classList.contains('open')) { setTimeout(checkGateWhenReady, 900); return; }
    checkGateWhenReady();
  }
  var bootGateDone = false;
  function checkGateWhenReady() {
    var s = state();
    /* v1.16: الإقلاع الثاني الاحتياطي (6ث) لا يعيد فتح البوابة بعد ما المستخدم أغلقها/بدأ تجربة */
    if (bootGateDone) {
      if (s.mode === 'expired' || s.mode === 'trialused') openGate(false);
      return;
    }
    bootGateDone = true;
    if (s.mode === 'fresh' || s.mode === 'trialused' || s.mode === 'expired') openGate(false);
    else if (s.mode === 'trial') { trialCloudVerify(); } /* v1.19 بطلب المالك: مفيش صفحة اشتراك أثناء التجربة السارية — بتظهر بعد ما التجربة تخلص بس */
    else if (s.mode === 'licensed') { emailBoundCheck(jget(LS.lic)); }
  }
  window.SBLicense = {
    state: state,
    isLicensed: isLicensed,
    openGate: openGate,
    closeGate: closeGate,
    deviceCode: deviceCode,
    craftsmanAllowed: craftsmanAllowed,
    isCraftsmanCode: isCraftsmanCode,
    refreshSettingsUI: refreshSettingsUI
  };

  function boot() {
    /* بعد اختفاء السبلاش (~2ث) — ونجرب مرة أخيرة بعد 6ث احتياطاً */
    setTimeout(onAppReady, 2600);
    setTimeout(onAppReady, 6000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  window.addEventListener('online', function () { setTimeout(resolvePending, 1500); });

})();
