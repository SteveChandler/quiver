package app.quiversurf.mobile;

import android.os.Bundle;
import android.webkit.CookieManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Enable cookie persistence for WebView
        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(getBridge().getWebView(), true);
    }

    @Override
    public void onPause() {
        super.onPause();
        // Flush cookies to disk when app goes to background
        CookieManager.getInstance().flush();
    }

    @Override
    public void onDestroy() {
        // Flush cookies before app is destroyed
        CookieManager.getInstance().flush();
        super.onDestroy();
    }
}
