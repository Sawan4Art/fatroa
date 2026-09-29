#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# github_release.sh — رفع أي بناء (APK/iOS/EXE/ZIP) على GitHub Releases
# القاعدة ٦ في RULES.md — لينك تحميل فوري بعد كل بناء
#
# الاستخدام:
#   ./github_release.sh <tag> <ملف> "<عنوان>" "<ملاحظات>" [target_commitish]
#
# مثال:
#   ./github_release.sh v1.2 download/FatoraStone-v1.2-debug.apk \
#     "فاتورة ستون v1.2 — إصلاحات" "- إصلاح كذا" main
# ═══════════════════════════════════════════════════════════════
set -e

TAG="$1"; FILE="$2"; TITLE="$3"; NOTES="$4"; TARGET="${5:-main}"

if [ -z "$TAG" ] || [ -z "$FILE" ]; then
  echo "خطأ: tag وملف مطلوبين — الاستخدام: $0 <tag> <file> [title] [notes] [target]"; exit 1
fi
[ ! -f "$FILE" ] && { echo "خطأ: الملف غير موجود: $FILE"; exit 1; }

# ── التوكن: من متغير بيئة GH_TOKEN أو من الملف خارج الريبو ──
TOKEN="${GH_TOKEN:-}"
if [ -z "$TOKEN" ]; then
  for CAND in /home/z/my-project/.github-token "$HOME/.github-token"; do
    [ -f "$CAND" ] && TOKEN=$(cat "$CAND" | tr -d '\n\r') && break
  done
fi
[ -z "$TOKEN" ] && { echo "خطأ: لا توكن — ضع GH_TOKEN أو ملف .github-token"; exit 1; }

REPO="Sawan4Art/fatroa"
API="https://api.github.com/repos/$REPO"
UPLOAD="https://uploads.github.com/repos/$REPO"
MIME="application/octet-stream"
case "$FILE" in
  *.apk) MIME="application/vnd.android.package-archive" ;;
  *.zip) MIME="application/zip" ;;
  *.exe) MIME="application/vnd.microsoft.portable-executable" ;;
  *.dmg) MIME="application/x-apple-diskimage" ;;
esac

# ── حذف release/tag موجودين بنفس التاج (idempotent) ──
RID=$(curl -s -H "Authorization: Bearer $TOKEN" "$API/releases/tags/$TAG" | python3 -c "
import json,sys
try:
  d=json.load(sys.stdin); print(d.get('id','') if isinstance(d,dict) else '')
except: print('')")
if [ -n "$RID" ]; then
  echo "↺ حذف release قديم $TAG (id=$RID)"
  curl -s -X DELETE -H "Authorization: Bearer $TOKEN" "$API/releases/$RID" > /dev/null
fi
curl -s -X DELETE -H "Authorization: Bearer $TOKEN" "$API/git/refs/tags/$TAG" > /dev/null 2>&1

# ── إنشاء الإصدار ──
echo "+ إنشاء release $TAG (target=$TARGET)"
JSON=$(python3 - "$TAG" "$TITLE" "$NOTES" "$TARGET" <<'PYEOF'
import json,sys
tag,title,body,target=sys.argv[1:5]
print(json.dumps({"tag_name":tag,"target_commitish":target,
  "name":title,"body":body,"draft":False,"prerelease":False}))
PYEOF
)
RID=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "$JSON" "$API/releases" | python3 -c "
import json,sys
d=json.load(sys.stdin)
print(d.get('id','') if d.get('id') else 'ERR:'+str(d.get('errors',d.get('errors') and '' or d.get('message','?'))))")
case "$RID" in ERR*) echo "✗ فشل: $RID"; exit 1;; "" ) echo "✗ فشل بلا تفاصيل"; exit 1;; esac

# ── رفع الملف ──
echo "+ رفع $(basename "$FILE") ($(( $(stat -c%s "$FILE") / 1024 / 1024 ))MB)"
URL=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: $MIME" \
  --data-binary @"$FILE" \
  "$UPLOAD/releases/$RID/assets?name=$(basename "$FILE")" | python3 -c "
import json,sys
d=json.load(sys.stdin)
print(d.get('browser_download_url','ERR:'+str(d.get('errors',d.get('message','?')))))")
case "$URL" in ERR*) echo "✗ فشل الرفع: $URL"; exit 1;; esac

echo ""
echo "═══ تم النشر ═══"
echo "⬇ $URL"
