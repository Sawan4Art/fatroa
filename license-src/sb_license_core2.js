/* ============================================================================
 * StoneBill — نواة الترخيص v2 — توقيع Ed25519 غير متماثل (أقوى ضد الاختراق)
 * ---------------------------------------------------------------------------
 * ملف المصدر الوحيد للخوارزمية v2 — يُدمج حرفياً في:
 *   1) fatroa/index.html     (التحقق داخل التطبيق — مفتاح عام فقط)
 *   2) تطبيق المالك SB Owner (التوليد — المفتاح الخاص)
 *   3) اختبارات Node
 * ---------------------------------------------------------------------------
 * لماذا Ed25519 أقوى من HMAC (قرار دراسة التشفير 2026-10-02):
 *  - HMAC: نفس السر موجود داخل التطبيق (obfuscated) — من يفك APK يستخرجه ويزوّر أكواداً.
 *  - Ed25519: التطبيق يحمل المفتاح *العام* فقط — لا يمكن من العام توليد توقيعات صحيحة.
 *    المفتاح الخاص عند المالك فقط (تطبيق المالك، غير منشور). حتى فك التطبيق بالكامل
 *    لا يمنح المهاجم قدرة التزوير — هذا معيار التوقيعات الرقمية الحديث (FIPS 186-5).
 *  - المكتبة: tweetnacl (نطاق عام — مدققة على نطاق واسع، Reviews: audited by Cure53).
 * ---------------------------------------------------------------------------
 * صيغة الكود v2 (82 بايت → Base32 Crockford → 132 حرفاً ببادئة SB2-):
 *   bytes[0]      = 2           (إصدار الصيغة)
 *   bytes[1]      = keyVer      (إصدار مفتاح التوقيع — يسمح بتدوير المفتاح مستقبلاً)
 *   bytes[2..9]   = emailHash8  (SHA-256('SBL2-EMAIL:'+email) — أول 8 بايت)
 *   bytes[10..12] = expDays     (أيام منذ EPOCH 2026-01-01 — 3 بايت)
 *   bytes[13]     = plan        (1 شهر / 2 ربع / 3 سنة / 8 المالك مدى الحياة / 9 كود تجربة)
 *   bytes[14..17] = nonce4      (عشوائي لكل كود)
 *   bytes[18..81] = sig64       (Ed25519.sign(payload18, secretKey))
 * ---------------------------------------------------------------------------
 * معرفات السحابة المتفقة بين التطبيق وتطبيق المالك:
 *   codeId          = 'sbl2' + SHA-256(code)[0:40]        → Firestore sb_licenses
 *   emailDocId      = 'sbe'  + SHA-256('SBL2-EMAILDOC:'+email)[0:40]   → sb_emails (قفل بريد→جهاز)
 *   trialEmailDocId = 'tme'  + SHA-256('SBL2-TRIALEMAIL:'+email)[0:40] → sb_trialemails (تجربة لكل بريد مرة)
 *   trial doc id    = deviceCode()                        → sb_trials (تجربة لكل جهاز مرة)
 * ========================================================================= */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('tweetnacl'));
  else root.SBLicenseCore2 = factory(root.nacl);
})(typeof self !== 'undefined' ? self : this, function (nacl) {
  'use strict';
  if (!nacl || !nacl.sign) throw new Error('SBL2: tweetnacl missing');

  /* المفتاح العام للتوقيع (keyVer → hex 32B) — هذا *كل* ما يحمله التطبيق، ولا يكشف للتزوير */
  var PUBKEYS = {
    1: 'b4ae8b54837acea8236c204786044dd966bcfcc5edcc05165b3924a9b51fd481'
  };
  var secretKeyBytes = null; /* يُضبط فقط في تطبيق المالك عبر setSecretKey() */

  var VER = 2;
  var EPOCH = Date.UTC(2026, 0, 1);
  var DAY = 86400000;
  var CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  /* v1.17 تسعير الحزمة المعتمد من المالك (يوسف):
     المدير 299/شهر — عرض أول ٢ صنايعية مع بعض +50 فقط (الإجمالي 349/شهر بدل 397)
     أي صنايعي إضافي بعد الاتنين 49/فرد — الربع سنوي 999 والسنوي 3999 بخصم
     (الأكواد تحمل plan + تاريخ الانتهاء فقط — الأسعار معروضة في التطبيق وSB Owner) */
  var PLANS = {
    1: { id: 1, label: 'المدير فقط — شهر', days: 30 },
    2: { id: 2, label: 'المدير + ٢ صنايعية — شهر', days: 30 },
    3: { id: 3, label: 'المدير فقط — 3 شهور', days: 90 },
    4: { id: 4, label: 'المدير + ٢ صنايعية — 3 شهور', days: 90 },
    5: { id: 5, label: 'المدير فقط — سنة', days: 365 },
    6: { id: 6, label: 'المدير + ٢ صنايعية — سنة', days: 365 },
    /* 8 = باقة المالك: مدى الحياة (100 سنة تقنية = تاريخ نظيف 2125) + أجهزة غير محدودة
       — تُوقَّع Ed25519 مثل أي كود، وطبقة التطبيق تعاملها بلا قفل أجهزة (بطلب المالك 2026-10-02) */
    8: { id: 8, label: 'باقة المالك (مدى الحياة)', days: 36500, owner: true },
    9: { id: 9, label: 'كود تجربة', days: 14 }
  };
  var OWNER_PLAN = 8;
  function isOwnerPlan(p) { return p === OWNER_PLAN; }
  var CODE_BYTES = 82;   /* 18 حمولة + 64 توقيع */
  var CODE_B32_LEN = 132;

  /* ============================ SHA-256 نقي (منسوخ حرفياً من النواة v1 المختبرة 32/32) ============================ */
  function sha256Pure(bytes) {
    var K = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
    function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }
    var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var len = bytes.length;
    var bitLen = len * 8;
    var withOne = len + 1;
    var pad = (56 - (withOne % 64) + 64) % 64;
    var total = withOne + pad + 8;
    var m = new Uint8Array(total);
    m.set(bytes);
    m[len] = 0x80;
    var hv = total - 8;
    m[hv] = Math.floor(bitLen / 36028797018963968) & 0xff;
    m[hv + 1] = Math.floor(bitLen / 281474976710656) & 0xff;
    m[hv + 2] = Math.floor(bitLen / 1099511627776) & 0xff;
    m[hv + 3] = Math.floor(bitLen / 4294967296) & 0xff;
    m[hv + 4] = (bitLen >>> 24) & 0xff;
    m[hv + 5] = (bitLen >>> 16) & 0xff;
    m[hv + 6] = (bitLen >>> 8) & 0xff;
    m[hv + 7] = bitLen & 0xff;
    var w = new Int32Array(64);
    for (var i = 0; i < total; i += 64) {
      for (var t = 0; t < 16; t++) {
        var j = i + t * 4;
        w[t] = (m[j] << 24) | (m[j + 1] << 16) | (m[j + 2] << 8) | m[j + 3];
      }
      for (t = 16; t < 64; t++) {
        var s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
        var s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
      }
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (t = 0; t < 64; t++) {
        var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        var ch = (e & f) ^ (~e & g);
        var temp1 = (h + S1 + ch + K[t] + w[t]) | 0;
        var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var temp2 = (S0 + maj) | 0;
        h = g; g = f; f = e; e = (d + temp1) | 0; d = c; c = b; b = a; a = (temp1 + temp2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    var out = new Uint8Array(32);
    for (i = 0; i < 8; i++) {
      out[i * 4] = (H[i] >>> 24) & 0xff; out[i * 4 + 1] = (H[i] >>> 16) & 0xff;
      out[i * 4 + 2] = (H[i] >>> 8) & 0xff; out[i * 4 + 3] = H[i] & 0xff;
    }
    return out;
  }
  function sha256Hex(bytes) {
    var h = sha256Pure(bytes), s = '';
    for (var i = 0; i < h.length; i++) s += (h[i] < 16 ? '0' : '') + h[i].toString(16);
    return s;
  }
  function utf8(str) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(str);
    var out = [], c;
    for (var i = 0; i < str.length; i++) {
      c = str.codePointAt(i);
      if (c > 0xffff) i++;
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return new Uint8Array(out);
  }
  function timingSafeEqual(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    var diff = 0;
    for (var i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    return diff === 0;
  }

  /* ============================ ترميز Base32 Crockford ============================ */
  function b32encode(bytes) {
    var bits = 0, value = 0, out = '';
    for (var i = 0; i < bytes.length; i++) {
      value = (value << 8) | bytes[i];
      bits += 8;
      while (bits >= 5) { out += CROCKFORD[(value >>> (bits - 5)) & 31]; bits -= 5; }
    }
    if (bits > 0) out += CROCKFORD[(value << (5 - bits)) & 31];
    return out;
  }
  function normalizeCode(s) {
    var t = String(s || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
    if (t.indexOf('SB2') === 0) t = t.slice(3);
    return t.replace(/[İIILl|]/g, '1').replace(/[Oo°]/g, '0').replace(/[Uu]/g, 'V');
  }
  function b32decode(str) {
    var bits = 0, value = 0, out = [];
    for (var i = 0; i < str.length; i++) {
      var idx = CROCKFORD.indexOf(str[i]);
      if (idx < 0) return null;
      value = (value << 5) | idx;
      bits += 5;
      if (bits >= 8) { out.push((value >>> (bits - 8)) & 0xff); bits -= 8; }
    }
    /* v1.16: الترميز القانوني — بقيّات آخر رمز يجب أن تكون أصفاراً (b32encode يملّي أصفاراً)،
       وأي غير ذلك = كود غير قانوني يُرفض؛ يمنع «أكواد مكافئة» تختلف في آخر رمز فقط */
    if (bits > 0 && (value & ((1 << bits) - 1)) !== 0) return null;
    return new Uint8Array(out);
  }
  function normalizeEmail(s) {
    return String(s || '').trim().toLowerCase().replace(/\s+/g, '');
  }
  function formatCode(b32) {
    return 'SB2-' + b32.replace(/(.{8})(?=.)/g, '$1-');
  }
  function hexToBytes(hex) {
    var out = new Uint8Array(hex.length / 2);
    for (var i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
    return out;
  }
  function bytesToHex(b) {
    var s = '';
    for (var i = 0; i < b.length; i++) s += (b[i] < 16 ? '0' : '') + b[i].toString(16);
    return s;
  }
  function randomBytes(n) {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      var a = new Uint8Array(n); crypto.getRandomValues(a); return a;
    }
    var out = new Uint8Array(n);
    for (var i = 0; i < n; i++) out[i] = Math.floor(Math.random() * 256);
    return out;
  }

  /* ============================ التواريخ ============================ */
  function dateToExpDays(d) {
    var t = (typeof d === 'number') ? d : Date.parse(d + 'T00:00:00Z');
    return Math.floor((t - EPOCH) / DAY);
  }
  function expDaysToDate(days) {
    return new Date(EPOCH + days * DAY).toISOString().slice(0, 10);
  }

  /* ============================ بصمة البريد + معرفات السحابة ============================ */
  function emailHash8(email) {
    return sha256Pure(concat(utf8('SBL2-EMAIL:'), utf8(normalizeEmail(email)))).slice(0, 8);
  }
  function emailDocId(email) {
    return 'sbe' + sha256Hex(concat(utf8('SBL2-EMAILDOC:'), utf8(normalizeEmail(email)))).slice(0, 40);
  }
  function trialEmailDocId(email) {
    return 'tme' + sha256Hex(concat(utf8('SBL2-TRIALEMAIL:'), utf8(normalizeEmail(email)))).slice(0, 40);
  }
  function codeIdOf(code) {
    return 'sbl2' + sha256Hex(utf8(normalizeCode(code))).slice(0, 40);
  }
  function concat(a, b) {
    var out = new Uint8Array(a.length + b.length);
    out.set(a); out.set(b, a.length);
    return out;
  }

  /* ============================ المفتاح الخاص (تطبيق المالك فقط) ============================ */
  function setSecretKey(hex) {
    var b = (typeof hex === 'string') ? hexToBytes(hex.trim()) : hex;
    if (!b || b.length !== 64) throw new Error('SBL2: secret key must be 64 bytes (seed+pub)');
    secretKeyBytes = b;
  }
  function clearSecretKey() { secretKeyBytes = null; }
  function hasSecret() { return !!secretKeyBytes; }

  /* ============================ توليد كود v2 (يحتاج المفتاح الخاص) ============================ */
  function generateCode(email, expiry, plan) {
    if (!secretKeyBytes) return Promise.reject(new Error('SBL2: no secret key loaded'));
    var days = (typeof expiry === 'number') ? expiry : dateToExpDays(expiry);
    if (isNaN(days) || days < 0 || days > 16777215) return Promise.reject(new Error('expiry out of range'));
    plan = plan || 1;
    var p = new Uint8Array(18);
    p[0] = VER;
    p[1] = 1; /* keyVer */
    p.set(emailHash8(email), 2);
    p[10] = (days >> 16) & 0xff; p[11] = (days >> 8) & 0xff; p[12] = days & 0xff;
    p[13] = plan & 0xff;
    p.set(randomBytes(4), 14);
    var sig = nacl.sign.detached(p, secretKeyBytes);
    var full = new Uint8Array(CODE_BYTES);
    full.set(p); full.set(sig, 18);
    var b32 = b32encode(full);
    var code = formatCode(b32);
    return Promise.resolve({
      code: code,
      codeId: codeIdOf(b32),
      email: normalizeEmail(email),
      exp: expDaysToDate(days),
      expDays: days,
      plan: plan
    });
  }

  /* ============================ التحقق المحلي (أوفلاين 100% — مفتاح عام فقط) ============================ */
  function verifyCode(code, email) {
    var n = normalizeCode(code);
    if (n.length !== CODE_B32_LEN) return Promise.resolve({ ok: false, reason: 'format' });
    var bytes = b32decode(n);
    if (!bytes || bytes.length !== CODE_BYTES) return Promise.resolve({ ok: false, reason: 'format' });
    var payload = bytes.slice(0, 18);
    var sig = bytes.slice(18, CODE_BYTES);
    if (payload[0] !== VER) return Promise.resolve({ ok: false, reason: 'version' });
    var keyVer = payload[1];
    var pubHex = PUBKEYS[keyVer];
    if (!pubHex) return Promise.resolve({ ok: false, reason: 'version' });
    var okSig = false;
    try { okSig = nacl.sign.detached.verify(payload, sig, hexToBytes(pubHex)); } catch (e) { okSig = false; }
    if (!okSig) return Promise.resolve({ ok: false, reason: 'signature' });
    if (!timingSafeEqual(payload.slice(2, 10), emailHash8(email))) return Promise.resolve({ ok: false, reason: 'email' });
    var expDays = (payload[10] << 16) | (payload[11] << 8) | payload[12];
    var plan = payload[13];
    var today = dateToExpDays(new Date().toISOString().slice(0, 10));
    if (today > expDays) return Promise.resolve({ ok: false, reason: 'expired', exp: expDaysToDate(expDays), plan: plan });
    return Promise.resolve({
      ok: true,
      codeId: codeIdOf(n),
      code: n,
      exp: expDaysToDate(expDays),
      expDays: expDays,
      plan: plan
    });
  }

  return {
    VER: VER,
    PLANS: PLANS,
    OWNER_PLAN: OWNER_PLAN,
    isOwnerPlan: isOwnerPlan,
    EPOCH: EPOCH,
    PUBKEYS: PUBKEYS,
    normalizeCode: normalizeCode,
    normalizeEmail: normalizeEmail,
    generateCode: generateCode,
    verifyCode: verifyCode,
    codeIdOf: codeIdOf,
    emailDocId: emailDocId,
    trialEmailDocId: trialEmailDocId,
    emailHash8: emailHash8,
    dateToExpDays: dateToExpDays,
    expDaysToDate: expDaysToDate,
    formatCode: formatCode,
    setSecretKey: setSecretKey,
    clearSecretKey: clearSecretKey,
    hasSecret: hasSecret,
    /* أدوات داخلية للاختبار */
    __sha256Hex: sha256Hex,
    __utf8: utf8,
    __hexToBytes: hexToBytes,
    __bytesToHex: bytesToHex
  };
});
