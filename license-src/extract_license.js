/* استخراج طبقات الترخيص المدمجة من index.html (v1.17) — استعادة بعد تمسح البيئة */
const fs = require('fs');
const S = '/home/z/my-project/scripts';
const html = fs.readFileSync('/home/z/my-project/fatroa/index.html', 'utf8');

function between(a, b) {
  const i = html.indexOf(a), j = html.indexOf(b, i);
  if (i < 0 || j < 0) throw new Error('marker missing: ' + a);
  return html.slice(i + a.length, j).trim();
}
const nacl = between('/*SBL-NACL-START*/', '/*SBL-NACL-END*/');
const core1 = between('/*SBL-CORE-START*/', '/*SBL-CORE-END*/');
const core2 = between('/*SBL-CORE2-START*/', '/*SBL-CORE2-END*/');
/* APP = من بعد CORE2-END لحد </script> الأول اللي بعده */
const i2 = html.indexOf('/*SBL-CORE2-END*/');
const jEnd = html.indexOf('</script>', i2);
let app = html.slice(i2 + '/*SBL-CORE2-END*/'.length, jEnd).trim();

fs.writeFileSync(S + '/vendor_nacl_fast.min.js', nacl + '\n');
fs.writeFileSync(S + '/sb_license_core.js', core1 + '\n');
fs.writeFileSync(S + '/sb_license_core2.js', core2 + '\n');
fs.writeFileSync(S + '/sb_license_app.js', app + '\n');
console.log('extracted:', {
  nacl: nacl.length, core1: core1.length, core2: core2.length, app: app.length
});
