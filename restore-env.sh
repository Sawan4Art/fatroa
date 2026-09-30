#!/usr/bin/env bash
# ============================================================
# restore-env.sh — بيئة البناء بضغطة واحدة (idempotent)
# فاتورة ستون — Fatora Stone
#
# الاستخدام:  bash restore-env.sh
#
# المبدأ: يفحص كل مكوّن قبل ما يحمّله — لو موجود، يتخطاه.
# يعني: أول مرة = تحميل كامل. أي مرة بعدها = ثواني وصفر إنترنت.
#
# المكوّنات:
#   1. JDK 17 (Temurin)        → /home/z/jdk-17
#   2. Android SDK             → /home/z/android-sdk
#   3. Gradle 8.7 cache        → ~/.gradle (يُدار تلقائياً بواسطة wrapper)
#   4. node_modules            → npm install فقط لو ناقص
#   5. www/                    → node build-www.js (محلي 100%)
# ============================================================
set -uo pipefail

JDK_DIR="/home/z/jdk-17"
SDK_DIR="/home/z/android-sdk"
CMDLINE="$SDK_DIR/cmdline-tools"
GRADLE_DIST="$HOME/.gradle/wrapper/dists"
DONE_MARKERS=()

ok()   { echo "  ✔ $1"; }
skip() { echo "  ⏭  $1 (موجود — تخطي)"; }
dl()   { echo "  ⬇  $1"; }
fail() { echo "  ✘ $1"; exit 1; }

echo "=============================================="
echo " فاتورة ستون — فحص/استعادة بيئة البناء"
echo "=============================================="

# ---------- 1) JDK 17 ----------
echo "[1/5] JDK 17..."
if [ -x "$JDK_DIR/bin/java" ] && "$JDK_DIR/bin/java" -version 2>&1 | grep -q '17\.'; then
  skip "JDK 17"
else
  dl "تحميل Temurin JDK 17 (~185MB)..."
  mkdir -p /home/z && cd /home/z
  curl -fsSL -o jdk17.tar.gz "https://api.adoptium.net/v3/binary/latest/17/ga/linux/x64/jdk/hotspot/normal/eclipse" \
    || fail "فشل تحميل JDK"
  tar xzf jdk17.tar.gz && rm -f jdk17.tar.gz
  JDK_EXTRACTED=$(find /home/z -maxdepth 1 -name 'jdk-17*' -type d | head -1)
  [ -n "$JDK_EXTRACTED" ] && [ "$JDK_EXTRACTED" != "$JDK_DIR" ] && rm -rf "$JDK_DIR" && mv "$JDK_EXTRACTED" "$JDK_DIR"
  [ -x "$JDK_DIR/bin/java" ] || fail "JDK غير صالح بعد التثبيت"
  ok "JDK 17 مثبت"
fi
DONE_MARKERS+=("jdk")

# ---------- 2) Android SDK ----------
echo "[2/5] Android SDK..."
if [ -d "$CMDLINE" ] && [ -d "$SDK_DIR/platforms/android-34" ] && [ -d "$SDK_DIR/build-tools/34.0.0" ]; then
  skip "SDK كامل (cmdline-tools + platform-34 + build-tools 34)"
else
  if [ ! -d "$CMDLINE" ]; then
    dl "تحميل cmdline-tools (~120MB)..."
    mkdir -p "$CMDLINE"
    curl -fsSL -o /tmp/cmdline-tools.zip "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip" \
      || fail "فشل تحميل cmdline-tools"
    unzip -q /tmp/cmdline-tools.zip -d /tmp/clt && rm -f /tmp/cmdline-tools.zip
    rm -rf "$CMDLINE/latest" && mv /tmp/clt/cmdline-tools "$CMDLINE/latest"
    rm -rf /tmp/clt
  else
    skip "cmdline-tools"
  fi
  export JAVA_HOME="$JDK_DIR"
  export ANDROID_HOME="$SDK_DIR"
  yes | "$CMDLINE/latest/bin/sdkmanager" --sdk_root="$SDK_DIR" "platforms;android-34" "build-tools;34.0.0" "platform-tools" > /dev/null 2>&1 \
    || fail "فشل تثبيت مكونات SDK"
  ok "مكونات SDK مثبتة"
fi
DONE_MARKERS+=("sdk")

# ---------- 3) Gradle cache ----------
echo "[3/5] Gradle..."
if ls "$GRADLE_DIST"/gradle-8.7-bin 1>/dev/null 2>&1; then
  skip "Gradle 8.7 في الكاش"
else
  echo "  ℹ  Gradle wrapper هينزّل 8.7 تلقائياً عند أول بناء (~130MB مرة واحدة)"
fi
DONE_MARKERS+=("gradle")

# ---------- 4) node_modules ----------
echo "[4/5] node_modules..."
if [ -d node_modules/electron ] && [ -d node_modules/@capacitor ]; then
  skip "node_modules كاملة"
else
  dl "npm install (~2-5 دقائق للنسخة الأولى)..."
  npm install --no-audit --no-fund || fail "فشل npm install"
  ok "node_modules جاهزة"
fi
DONE_MARKERS+=("npm")

# ---------- 5) www/ ----------
echo "[5/5] www/ (الحزمة الأوفلاين)..."
if [ -f www/index.html ] && [ -d www/assets ]; then
  skip "www/ مبنية"
else
  node build-www.js || fail "فشل بناء www/"
  ok "www/ اتبنت محلياً (صفر إنترنت)"
fi
DONE_MARKERS+=("www")

echo ""
echo "=============================================="
echo " ✔ البيئة جاهزة بالكامل"
echo "----------------------------------------------"
echo " بناء APK:  cd android && ./gradlew assembleDebug"
echo "   (مع التصديرات:)"
echo "   export JAVA_HOME=$JDK_DIR"
echo "   export ANDROID_HOME=$SDK_DIR"
echo "=============================================="
