package com.dreaminraw.bolitas;

import com.getcapacitor.BridgeActivity;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

public class MainActivity extends BridgeActivity {

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            applyNavBarInset();
        }
    }

    private void applyNavBarInset() {
        try {
            WindowInsetsCompat insets = ViewCompat.getRootWindowInsets(getWindow().getDecorView());
            if (insets == null) return;
            int navBarPx = insets.getInsets(WindowInsetsCompat.Type.navigationBars()).bottom;
            float density = getResources().getDisplayMetrics().density;
            int navBarDp = Math.round(navBarPx / density);
            if (navBarDp <= 0) return;
            String js = "document.documentElement.style.setProperty('--safe-bottom','" + navBarDp + "px')";
            runOnUiThread(() -> {
                if (getBridge() != null && getBridge().getWebView() != null) {
                    getBridge().getWebView().evaluateJavascript(js, null);
                }
            });
        } catch (Exception ignored) {}
    }
}
