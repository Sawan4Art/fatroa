/* دمج طبقات الترخيص في index.html — idempotent (استعادة v1.18 بعد تمسح البيئة) */
const fs = require('fs');
const path = require('path');
const S = __dirname;
const ROOT = '/home/z/my-project/fatroa';
const INDEX = path.join(ROOT, 'index.html');
const html = fs.readFileSync(INDEX, 'utf8');
const nacl = fs.readFileSync(path.join(S, 'vendor_nacl_fast.min.js'), 'utf8').trim();
const core1 = fs.readFileSync(path.join(S, 'sb_license_core.js'), 'utf8').trim();
const core2 = fs.readFileSync(path.join(S, 'sb_license_core2.js'), 'utf8').trim();
const app = fs.readFileSync(path.join(S, 'sb_license_app.js'), 'utf8').trim();

const block =
  '<!--SBL-START-->\n<script>\n' +
  '/* ===== StoneBill v1.18 — نظام الاشتراك والترخيص (طبقة معزولة — قاعدة 1: لا يمس منطق الجداول) ===== */\n' +
  '/* طبقة 1/4: tweetnacl — Ed25519 (مفتاح عام فقط داخل التطبيق) */\n' +
  '/*SBL-NACL-START*/\n' + nacl + '\n/*SBL-NACL-END*/\n' +
  '/* طبقة 2/4: نواة v1 (HMAC — معطلة للتحقق، موجودة للأرشيف) */\n' +
  '/*SBL-CORE-START*/\n' + core1 + '\n/*SBL-CORE-END*/\n' +
  '/* طبقة 3/4: نواة v2 — Ed25519 (الوحيدة المقبولة) */\n' +
  '/*SBL-CORE2-START*/\n' + core2 + '\n/*SBL-CORE2-END*/\n' +
  '/* طبقة 4/4: واجهة الاشتراك */\n' + app + '\n' +
  '</script>\n<!--SBL-END-->';

const A = html.indexOf('<!--SBL-START-->');
const B = html.indexOf('<!--SBL-END-->');
let out;
if (A >= 0 && B > A) out = html.slice(0, A) + block + html.slice(B + '<!--SBL-END-->'.length);
else {
  const anchor = html.lastIndexOf('</body>');
  if (anchor < 0) throw new Error('no </body>');
  out = html.slice(0, anchor) + block + '\n' + html.slice(anchor);
}
fs.writeFileSync(INDEX, out);
/* فحص صياغة: كتلة السكربت الداخلية تُستخرج وتُفحص */
const i = out.indexOf('<!--SBL-START-->'), j = out.indexOf('<!--SBL-END-->');
const inner = out.slice(out.indexOf('<script>', i) + 8, out.indexOf('</script>', i));
fs.writeFileSync('/tmp/sbl_combined.js', inner);
console.log('تم الدمج ✓ — حجم index.html الآن: ' + (out.length / 1024).toFixed(1) + 'KB — كُتب /tmp/sbl_combined.js للفحص');
