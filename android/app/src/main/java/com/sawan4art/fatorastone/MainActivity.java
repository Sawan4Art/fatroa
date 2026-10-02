package com.sawan4art.fatorastone;

import android.annotation.SuppressLint;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.webkit.JavascriptInterface;
import android.widget.Toast;
import androidx.core.content.FileProvider;
import com.getcapacitor.BridgeActivity;
import java.io.File;
import java.io.FileOutputStream;

/**
 * فاتورة ستون — جسر المشاركة الأصلي
 * الكتروني (JS) يطلب: window.AndroidInterface.shareFile(base64, fileName, mime)
 * يفك الـbase64 → يحفظ في الكاش → يشارك عبر FileProvider + ACTION_SEND (واتساب/تيليجرام/إيميل...)
 */
public class MainActivity extends BridgeActivity {

    @SuppressLint("JavascriptInterface")
    @Override
    public void onStart() {
        super.onStart();
        if (bridge != null && bridge.getWebView() != null) {
            bridge.getWebView().addJavascriptInterface(new WebAppInterface(this), "AndroidInterface");
            /* قفل تكبير النص على 100% — إعداد خط النظام (أكبر/أصغر) كان بيكبّر كل
               النصوص والأيقونات المقاسة بـ em داخل الويب فيو فتحسس إن التطبيق «مزوم».
               التطبيق صمم بمقاسات ثابتة فنثبّت textZoom لضمان التناسق مع حجم الشاشة */
            bridge.getWebView().getSettings().setTextZoom(100);
        }
    }

    /**
     * زر الرجوع في الموبايل: الـJS يقرر أولاً (إغلاق مودال مفتوح أو الرجوع بين الشاشات).
     * لو رجع true فتمت المعالجة داخلياً، وإلا سلوك Capacitor الافتراضي (هيستوري/خروج).
     */
    @Override
    public void onBackPressed() {
        if (bridge != null && bridge.getWebView() != null) {
            bridge.getWebView().evaluateJavascript(
                "(window.__handleAndroidBack ? window.__handleAndroidBack() : false)",
                value -> {
                    if (!"true".equals(value)) {
                        runOnUiThread(() -> MainActivity.super.onBackPressed());
                    }
                });
        } else {
            super.onBackPressed();
        }
    }

    class WebAppInterface {
        Context ctx;
        WebAppInterface(Context c) { ctx = c; }

        @JavascriptInterface
        public void shareFile(String base64, String fileName, String mime) {
            try {
                byte[] data = android.util.Base64.decode(base64, android.util.Base64.DEFAULT);
                File dir = new File(ctx.getCacheDir(), "share");
                if (!dir.exists()) dir.mkdirs();
                File f = new File(dir, fileName == null || fileName.isEmpty() ? "file" : fileName);
                FileOutputStream fos = new FileOutputStream(f);
                fos.write(data);
                fos.close();

                Uri uri = FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".fileprovider", f);
                Intent send = new Intent(Intent.ACTION_SEND);
                send.setType(mime == null || mime.isEmpty() ? "*/*" : mime);
                send.putExtra(Intent.EXTRA_STREAM, uri);
                send.putExtra(Intent.EXTRA_SUBJECT, fileName == null ? "" : fileName);
                send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                Intent chooser = Intent.createChooser(send, "مشاركة الملف");
                chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(chooser);
            } catch (Exception e) {
                Toast.makeText(ctx, "تعذر مشاركة الملف: " + e.getMessage(), Toast.LENGTH_SHORT).show();
            }
        }

        @JavascriptInterface
        public void showToast(final String msg) {
            Toast.makeText(ctx, msg == null ? "" : msg, Toast.LENGTH_SHORT).show();
        }

        /**
         * v1.12 — الطباعة الأصلية: window.print() لا يعمل داخل WebView (نقرة بلا استجابة).
         * PrintManager + createPrintDocumentAdapter يفتحان حوار طباعة أندرويد الرسمي —
         * منه الطباعة على أي طابعة أو «حفظ كـ PDF» مباشرة، ويحترم @page size وتنسيقات الطباعة.
         */
        @JavascriptInterface
        public void printPage() {
            final android.webkit.WebView wv = (bridge != null) ? bridge.getWebView() : null;
            if (wv == null) return;
            wv.post(() -> {
                try {
                    android.print.PrintManager pm = (android.print.PrintManager) ctx.getSystemService(Context.PRINT_SERVICE);
                    android.print.PrintDocumentAdapter adapter = wv.createPrintDocumentAdapter("StoneBill");
                    pm.print("StoneBill", adapter, new android.print.PrintAttributes.Builder().build());
                } catch (Throwable t) {
                    Toast.makeText(ctx, "الطباعة غير متاحة على هذا الجهاز: " + t.getMessage(), Toast.LENGTH_SHORT).show();
                }
            });
        }

        /**
         * v1.13 — معرّف الجهاز المستقر لنظام الاشتراك/الترخيص.
         * ANDROID_ID يصمد بعد إزالة التثبيت وإعادته (نفس مفتاح التوقيع، أندرويد 8+)
         * ويتغير فقط عند factory reset. لو فشل: ملف محلي داخل مجلد التطبيق.
         */
        @JavascriptInterface
        public String getDeviceId() {
            try {
                String id = android.provider.Settings.Secure.getString(
                        ctx.getContentResolver(), android.provider.Settings.Secure.ANDROID_ID);
                if (id != null && !id.isEmpty() && !"9774d56d682e549c".equals(id)) return id;
            } catch (Throwable ignored) {}
            try {
                File f = new File(ctx.getFilesDir(), "sb_device_id.txt");
                if (f.exists()) {
                    java.io.FileInputStream fis = new java.io.FileInputStream(f);
                    byte[] buf = new byte[(int) f.length()];
                    fis.read(buf); fis.close();
                    return new String(buf, "UTF-8").trim();
                }
                String uuid = java.util.UUID.randomUUID().toString().replace("-", "");
                FileOutputStream fos = new FileOutputStream(f);
                fos.write(uuid.getBytes("UTF-8")); fos.close();
                return uuid;
            } catch (Throwable t) {
                return java.util.UUID.randomUUID().toString().replace("-", "");
            }
        }
    }
}
