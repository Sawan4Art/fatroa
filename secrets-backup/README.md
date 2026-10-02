# 🔐 secrets-backup — نسخة الطوارئ لمفتاح توقيع StoneBill

هذا المجلد يحتوي على **keystore توقيع التطبيق مشفراً بـ AES-256** حتى ينجو من أي مسح بيئة.
الملف: `stonebill-2026.keystore.enc` (تاريخ الإنشاء: 2026-10-03 — يبدأ به توقيع v1.18).

> ⚠️ **كلمة السر ليست في هذا المجلد عمداً** — المالك يحتفظ بها مع نسخة
> `StoneBill-Keystore-Backup.zip` التي استلمها في الشات، وأيضاً في
> `keystores/keystore-password.txt` على بيئة البناء.

## فك التشفير (استعادة الطوارئ)

```bash
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
  -in secrets-backup/stonebill-2026.keystore.enc \
  -out stonebill-2026.keystore \
  -pass pass:'كلمة-السر'
```

ثم التحقق:

```bash
keytool -list -keystore stonebill-2026.keystore -alias stonebill
# المطلوب: fingerprint SHA-256 يبدأ E4:C6:6C:23:2B:21:73:93
```

## إعداد البناء بعد الاستعادة

1. ضع الملف المفكوك في `/home/z/my-project/keystores/stonebill-2026.keystore`
2. أنشئ `android/keystore.properties` (غير متتبع في git):

```
storeFile=/home/z/my-project/keystores/stonebill-2026.keystore
storePassword=كلمة-السر
keyAlias=stonebill
keyPassword=كلمة-السر
```

## ملاحظات

- توقيع v1.17 وما قبله كان بمفتاح قديم **فُقد بمسح البيئة** (2026-10-02) —
  لذلك v1.18+ يتطلب حذف النسخة القديمة من الهاتف قبل التثبيت (مرة واحدة فقط).
- مفتاح توليد أكواد التراخيص Ed25519 (الخاص) لا يُخزن هنا — موجود داخل تطبيق
  SB-Owner v1.3 على هاتف المالك، ويُستخرج منه عند الحاجة لتحديث SB Owner.
- التاريخ القياسي للتحقق من المفتاح: SHA-256
  `E4:C6:6C:23:2B:21:73:93:52:F5:CB:30:F4:EF:40:79:DA:E0:0D:42:32:80:80:55:96:9A:E5:D6:AD:B1:DD:E2`
