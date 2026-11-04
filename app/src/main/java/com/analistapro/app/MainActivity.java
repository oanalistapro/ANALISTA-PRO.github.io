
package com.analistapro.app;

import android.app.Activity;
import android.os.Bundle;
import android.net.Uri;
import android.graphics.Color;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.Toast;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;

import androidx.credentials.CredentialManager;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.exceptions.GetCredentialException;

import com.google.android.libraries.identity.googleid.GetGoogleIdOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.GoogleAuthProvider;

import org.json.JSONObject;

public class MainActivity extends Activity {

    private static final String SITE =
        "https://oanalistapro.github.io/ANALISTA-PRO.github.io/";

    private WebView webView;
    private FirebaseAuth auth;
    private boolean loginEmAndamento = false;
    private boolean paginaPronta = false;
    private String tokenPendente = null;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);

        auth = FirebaseAuth.getInstance();

        FrameLayout layout = new FrameLayout(this);

        webView = new WebView(this);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);

        settings.setUserAgentString(
            settings.getUserAgentString()
            + " AnalistaProNative/1"
        );

        webView.setWebViewClient(new WebViewClient() {

            @Override
            public boolean shouldOverrideUrlLoading(
                WebView view,
                WebResourceRequest request
            ) {
                return tratarUrl(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(
                WebView view,
                String url
            ) {
                return tratarUrl(Uri.parse(url));
            }

            @Override
            public void onPageFinished(
                WebView view,
                String url
            ) {
                paginaPronta = urlPermitida(
                    Uri.parse(url)
                );
                entregarToken();
            }
        });

        layout.addView(
            webView,
            new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        );

        // Botao Google nativo, independente do HTML.
        Button googleButton = new Button(this);
        googleButton.setText("Entrar com Google");
        googleButton.setTextColor(Color.WHITE);
        googleButton.setBackgroundTintList(
            android.content.res.ColorStateList.valueOf(
                Color.rgb(24, 119, 242)
            )
        );
        googleButton.setAllCaps(false);

        FrameLayout.LayoutParams params =
            new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                dp(52),
                Gravity.BOTTOM
            );

        params.setMargins(
            dp(18), 0, dp(18), dp(28)
        );

        layout.addView(googleButton, params);

        googleButton.setOnClickListener(
            v -> loginGoogle()
        );

        setContentView(layout);
        webView.loadUrl(SITE);
    }

    private int dp(int value) {
        return (int) (
            value * getResources()
                .getDisplayMetrics().density
        );
    }

    private boolean urlPermitida(Uri uri) {
        if (uri == null) return false;

        String host = uri.getHost();
        String path = uri.getPath();

        return "https".equalsIgnoreCase(
                uri.getScheme()
            )
            && "oanalistapro.github.io"
                .equalsIgnoreCase(host)
            && path != null
            && (
                path.equals(
                    "/ANALISTA-PRO.github.io"
                )
                || path.startsWith(
                    "/ANALISTA-PRO.github.io/"
                )
            );
    }

    private boolean tratarUrl(Uri uri) {
        if (uri == null) return true;

        if ("analistapro".equalsIgnoreCase(
            uri.getScheme()
        )) {
            if ("login".equalsIgnoreCase(
                uri.getHost()
            ) && urlPermitida(
                Uri.parse(
                    webView.getUrl() == null
                    ? ""
                    : webView.getUrl()
                )
            )) {
                loginGoogle();
            }
            return true;
        }

        return !urlPermitida(uri);
    }

    private void loginGoogle() {

        if (loginEmAndamento) return;
        loginEmAndamento = true;

        int id = getResources().getIdentifier(
            "default_web_client_id",
            "string",
            getPackageName()
        );

        if (id == 0) {
            loginEmAndamento = false;
            mostrarErro(
                "Configure o OAuth Google no Firebase."
            );
            return;
        }

        String clientId = getString(id);

        GetGoogleIdOption option =
            new GetGoogleIdOption.Builder()
                .setFilterByAuthorizedAccounts(false)
                .setServerClientId(clientId)
                .build();

        GetCredentialRequest request =
            new GetCredentialRequest.Builder()
                .addCredentialOption(option)
                .build();

        CredentialManager manager =
            CredentialManager.create(this);

        manager.getCredentialAsync(
            this,
            request,
            null,
            getMainExecutor(),
            new CredentialManagerCallback<
                GetCredentialResponse,
                GetCredentialException
            >() {

                @Override
                public void onResult(
                    GetCredentialResponse response
                ) {
                    try {
                        if (!(response.getCredential()
                            instanceof CustomCredential)) {
                            throw new Exception(
                                "Credencial Google invalida."
                            );
                        }

                        CustomCredential custom =
                            (CustomCredential)
                                response.getCredential();

                        if (!GoogleIdTokenCredential
                            .TYPE_GOOGLE_ID_TOKEN_CREDENTIAL
                            .equals(custom.getType())) {
                            throw new Exception(
                                "Tipo de credencial inesperado."
                            );
                        }

                        GoogleIdTokenCredential google =
                            GoogleIdTokenCredential.createFrom(
                                custom.getData()
                            );

                        String idToken =
                            google.getIdToken();

                        auth.signInWithCredential(
                            GoogleAuthProvider.getCredential(
                                idToken, null
                            )
                        ).addOnSuccessListener(result -> {
                            loginEmAndamento = false;
                            tokenPendente = idToken;
                            entregarToken();
                        }).addOnFailureListener(error -> {
                            loginEmAndamento = false;
                            mostrarErro(error.getMessage());
                        });

                    } catch (Exception error) {
                        loginEmAndamento = false;
                        mostrarErro(error.getMessage());
                    }
                }

                @Override
                public void onError(
                    GetCredentialException error
                ) {
                    loginEmAndamento = false;
                    mostrarErro(error.getMessage());
                }
            }
        );
    }

    private void entregarToken() {

        if (!paginaPronta || tokenPendente == null) {
            return;
        }

        String url = webView.getUrl();

        if (url == null ||
            !urlPermitida(Uri.parse(url))) {
            return;
        }

        String token = tokenPendente;

        String script =
            "(function(token) {" +
            " let n = 0;" +
            " function enviar() {" +
            "  if (typeof window.__analistaNativeGoogleToken === 'function') {" +
            "   window.__analistaNativeGoogleToken(token);" +
            "  } else if (++n < 40) {" +
            "   setTimeout(enviar, 300);" +
            "  }" +
            " }" +
            " enviar();" +
            "})(" + JSONObject.quote(token) + ");";

        webView.evaluateJavascript(script, null);

        tokenPendente = null;
    }

    private void mostrarErro(String mensagem) {
        Toast.makeText(
            this,
            "Login Google: " + mensagem,
            Toast.LENGTH_LONG
        ).show();
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
