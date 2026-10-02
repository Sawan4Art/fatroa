/* ============================================================================
 * StoneBill — نواة الترخيص المشفّر (SB License Core) v1
 * ---------------------------------------------------------------------------
 * ملف المصدر الوحيد للخوارزمية — يُدمج حرفياً في:
 *   1) fatroa/index.html        (التحقق داخل التطبيق)
 *   2) stonebill-admin.html     (التوليد والإدارة لأداة المالك)
 *   3) اختبارات Node            (هذا الملف مباشرة)
 * ---------------------------------------------------------------------------
 * خطة التشفير (مضادة للاحتيال):
 *  - HMAC-SHA256 (WebCrypto) — نفس معيار البنوك والتوقيعات الرقمية (FIPS 198-1)
 *  - الكود = 25 بايت: [ver|emailHash×8|expiry×3|plan×1|nonce×4|sig×8]
 *  - emailHash: بصمة الإيميل داخل الكود — الكود لا يعمل إلا على إيميله
 *  - sig: توقيع يمنع أي تلاعب بحرف واحد في أي جزء من الكود
 *  - nonce: 32-bit عشوائية لكل كود — لا يمكن التوقع أو إعادة التركيب
 *  - codeId = SHA-256 للكود → معرف المستند في Firestore (لا يخزَّن الكود نفسه أبداً سحابياً)
 *  - قفل الجهاز سحابياً (Firestore) — كود واحد = جهاز واحد في نفس الوقت
 *  - Base32 بأبجدية Crockford (بدون I,L,O,U) — تنسيق مقاوم لخطأ القراءة البشري
 * ========================================================================= */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SBLicenseCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---- المفتاح السري 256-bit (مُخفى بـ XOR + تجزئة نصية — لا يظهر نصاً صريحاً في الملف) ---- */
  var SBL_K_M = [64, 20, 84, 16, 61, 252, 170, 123, 251, 155, 53, 109, 152, 248, 83, 84, 97, 133, 112, 46, 78, 210, 152, 121, 246, 139, 190, 90, 48, 67, 187, 21];
  var SBL_K_T = 167; /* ماسك XOR */
  function secretKey() {
    var out = new Uint8Array(SBL_K_M.length);
    for (var i = 0; i < SBL_K_M.length; i++) out[i] = SBL_K_M[i] ^ SBL_K_T;
    return out;
  }

  var VER = 1;
  var EPOCH = Date.UTC(2026, 0, 1);           /* تاريخ الأصل — صلاحية حتى 2071 */
  var DAY = 86400000;
  var CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  var PLANS = {
    1: { id: 1, label: 'باقة شهرية', days: 30 },
    2: { id: 2, label: 'باقة ربع سنوية', days: 90 },
    3: { id: 3, label: 'باقة سنوية', days: 365 }
  };

  /* ============================ SHA-256 نقي (احتياطي لو WebCrypto غير متاح) ============================ */
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
    /* 64-bit big-endian length — 8 بايتات بالترتيب الصحيح */
    m[hv] = Math.floor(bitLen / 36028797018963968) & 0xff;   /* bits 56-63 */
    m[hv + 1] = Math.floor(bitLen / 281474976710656) & 0xff; /* bits 48-55 */
    m[hv + 2] = Math.floor(bitLen / 1099511627776) & 0xff;   /* bits 40-47 */
    m[hv + 3] = Math.floor(bitLen / 4294967296) & 0xff;      /* bits 32-39 */
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

  /* ============================ WebCrypto أو الاحتياطي ============================ */
  var subtle = (typeof crypto !== 'undefined' && crypto.subtle) ? crypto.subtle : null;
  function hmacSyncFallback(data, keyBytes) {
    /* HMAC-SHA256 يدوياً (RFC 2104) — مسار احتياطي فقط */
    var block = 64;
    var k = keyBytes.length > block ? sha256Pure(keyBytes) : keyBytes;
    var ipad = new Uint8Array(block + data.length);
    var opad = new Uint8Array(block + 32);
    var i;
    for (i = 0; i < block; i++) {
      var kb = i < k.length ? k[i] : 0;
      ipad[i] = kb ^ 0x36;
      opad[i] = kb ^ 0x5c;
    }
    ipad.set(data, block);
    var inner = sha256Pure(ipad);
    opad.set(inner, block);
    return sha256Pure(opad);
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

  /* HMAC-SHA256 غير متزامن — WebCrypto عند التوفر وإلا الاحتياطي النقي
     البيانات الموقعة = domain || bytes (فصل نطاقات يمنع إعادة استخدام التوقيع بين السياقات) */
  function hmacSha256(domain, bytes) {
    var keyBytes = secretKey();
    var data = concat(utf8(domain), bytes);
    if (subtle) {
      return subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']).then(function (key) {
        return subtle.sign('HMAC', key, data).then(function (sig) {
          return new Uint8Array(sig).slice(0, 8);
        });
      }).catch(function () {
        return hmacSyncFallback(data, keyBytes).slice(0, 8);
      });
    }
    return Promise.resolve(hmacSyncFallback(data, keyBytes).slice(0, 8));
  }
  function concat(a, b) {
    var out = new Uint8Array(a.length + b.length);
    out.set(a); out.set(b, a.length);
    return out;
  }
  /* ملحوظة: domain يُسبق البيانات كنطاق فصل (domain separation) — يمنع إعادة استخدام التوقيع بين السياقات */

  /* ============================ Base32 (Crockford) ============================ */
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
  function b32decode(str) {
    str = normalizeCode(str);
    var bits = 0, value = 0, out = [];
    for (var i = 0; i < str.length; i++) {
      var idx = CROCKFORD.indexOf(str[i]);
      if (idx < 0) return null;
      value = (value << 5) | idx;
      bits += 5;
      if (bits >= 8) { out.push((value >>> (bits - 8)) & 0xff); bits -= 8; }
    }
    return new Uint8Array(out);
  }
  /* تطبيع الكود: إزالة أي شيء ليس رقماً/حرفاً + تصحيح أخطاء القراءة الشائعة */
  function normalizeCode(s) {
    return String(s || '').toUpperCase()
      .replace(/[İIILl|]/g, '1')
      .replace(/[Oo°]/g, '0')
      .replace(/[Uu]/g, 'V')
      .replace(/[^0-9A-HJ-NP-TV-Z]/g, '');
  }
  function normalizeEmail(s) {
    return String(s || '').trim().toLowerCase().replace(/\s+/g, '');
  }

  /* ============================ بناء الكود ============================ */
  function dateToExpDays(d) {
    var t = (typeof d === 'number') ? d : Date.parse(d + 'T00:00:00Z');
    return Math.floor((t - EPOCH) / DAY);
  }
  function expDaysToDate(days) {
    return new Date(EPOCH + days * DAY).toISOString().slice(0, 10);
  }
  function randomBytes4() {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      var a = new Uint8Array(4); crypto.getRandomValues(a); return a;
    }
    return new Uint8Array([Math.random() * 256, Math.random() * 256, Math.random() * 256, Math.random() * 256].map(Math.floor));
  }
  function payloadBytes(email, expDays, plan, nonce) {
    var emailNorm = normalizeEmail(email);
    var p = new Uint8Array(17);
    p[0] = VER;
    /* emailHash يُحسب في Promise خارجياً — هنا نملأ مبدئياً */
    if (nonce) p.set(nonce, 13);
    p[9] = (expDays >> 16) & 0xff; p[10] = (expDays >> 8) & 0xff; p[11] = expDays & 0xff;
    p[12] = plan & 0xff;
    return { p: p, emailNorm: emailNorm };
  }
  function formatCode(b32) {
    return b32.replace(/(.{8})(?=.)/g, '$1-');
  }

  /* توليد كود: يعيد {code, codeId, exp, plan, email} */
  function generateCode(email, expiry, plan) {
    var days = (typeof expiry === 'number') ? expiry : dateToExpDays(expiry);
    if (days < 0 || days > 16777215) return Promise.reject(new Error('expiry out of range'));
    plan = plan || 1;
    var nonce = randomBytes4();
    var base = payloadBytes(email, days, plan, nonce);
    var emailBytes = utf8(base.emailNorm);
    return hmacSha256('SBL-EMAIL', emailBytes).then(function (eh) {
      base.p.set(eh.slice(0, 8), 1);
      return hmacSha256('SBL-SIG', base.p);
    }).then(function (sig) {
      var full = new Uint8Array(25);
      full.set(base.p); full.set(sig, 17);
      var b32 = b32encode(full);
      return {
        code: formatCode(b32),
        codeId: codeIdOf(b32),
        email: base.emailNorm,
        exp: expDaysToDate(days),
        expDays: days,
        plan: plan
      };
    });
  }

  /* معرف المستند السحابي: SHA-256 للكود المطبّع — لا يُخزَّن الكود نفسه */
  function codeIdOf(normalizedOrRaw) {
    var n = normalizeCode(normalizedOrRaw);
    var label = utf8('SBL-ID:');
    var body = utf8(n);
    return 'sblic' + sha256Hex(concat(label, body)).slice(0, 40);
  }

  /* ============================ التحقق المحلي (أوفلاين 100%) ============================ */
  /* يُعيد: {ok:true, codeId, exp, plan} أو {ok:false, reason} */
  function verifyCodeLocally(code, email) {
    var n = normalizeCode(code);
    if (n.length !== 40) return Promise.resolve({ ok: false, reason: 'format' });
    var bytes = b32decode(n);
    if (!bytes || bytes.length < 25) return Promise.resolve({ ok: false, reason: 'format' });
    var payload = bytes.slice(0, 17);
    var sig = bytes.slice(17, 25);
    if (payload[0] !== VER) return Promise.resolve({ ok: false, reason: 'version' });
    return hmacSha256('SBL-SIG', payload).then(function (expect) {
      if (!timingSafeEqual(sig, expect)) return { ok: false, reason: 'signature' };
      var expDays = (payload[9] << 16) | (payload[10] << 8) | payload[11];
      var plan = payload[12];
      var emailNorm = normalizeEmail(email);
      return hmacSha256('SBL-EMAIL', utf8(emailNorm)).then(function (eh) {
        var stored = payload.slice(1, 9);
        if (!timingSafeEqual(stored, eh.slice(0, 8))) return { ok: false, reason: 'email' };
        var today = dateToExpDays(new Date().toISOString().slice(0, 10));
        if (today > expDays) return { ok: false, reason: 'expired', exp: expDaysToDate(expDays), plan: plan };
        return {
          ok: true,
          codeId: codeIdOf(n),
          exp: expDaysToDate(expDays),
          expDays: expDays,
          plan: plan
        };
      });
    });
  }
  /* مقارنة زمن-ثابت — ضد هجمات التوقيت */
  function timingSafeEqual(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    var diff = 0;
    for (var i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    return diff === 0;
  }

  return {
    VER: VER,
    PLANS: PLANS,
    EPOCH: EPOCH,
    normalizeCode: normalizeCode,
    normalizeEmail: normalizeEmail,
    generateCode: generateCode,
    verifyCodeLocally: verifyCodeLocally,
    codeIdOf: codeIdOf,
    expDaysToDate: expDaysToDate,
    dateToExpDays: dateToExpDays,
    formatCode: formatCode,
    /* أدوات داخلية للاختبار فقط */
    __hmac: hmacSha256,
    __sha256Hex: sha256Hex
  };
});
