
package com.analistapro.app;

import android.app.Activity;
import android.os.Bundle;
import android.content.Intent;
import android.net.Uri;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebSettings;
import android.widget.Toast;

import androidx.credentials.CredentialManager;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.GetCredentialException;

import com.google.android.libraries.identity.googleid.GetGoogleIdOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.GoogleAuthProvider;
import com.google.firebase.auth.AuthCredential;

import java.util.concurrent.Executors;

public class MainActivity extends Activity {

    private WebView webView;
    private FirebaseAuth auth;

    private static final String SITE =
        "https://oanalistapro.github.io/ANALISTA-PRO.github.io/";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        auth = FirebaseAuth.getInstance();

        webView = new WebView(this);
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.setWebViewClient(new WebViewClient());

        setContentView(webView);

        if (auth.getCurrentUser() == null) {
            loginGoogle();
        } else {
            abrirSite();
        }
    }

    private void loginGoogle() {

        GetGoogleIdOption googleOption =
            new GetGoogleIdOption.Builder()
                .setFilterByAuthorizedAccounts(false)
                .setServerClientId(
                    getString(
                        getResources().getIdentifier(
                            "default_web_client_id",
                            "string",
                            getPackageName()
                        )
                    )
                )
                .build();

        GetCredentialRequest request =
            new GetCredentialRequest.Builder()
                .addCredentialOption(googleOption)
                .build();

        CredentialManager manager =
            CredentialManager.create(this);

        manager.getCredentialAsync(
            this,
            request,
            null,
            Executors.newSingleThreadExecutor(),
            new androidx.credentials.CredentialManagerCallback<
                GetCredentialResponse,
                GetCredentialException
            >() {
                @Override
                public void onResult(GetCredentialResponse response) {
                    try {
                        GoogleIdTokenCredential google =
                            GoogleIdTokenCredential.createFrom(
                                response.getCredential().getData()
                            );

                        AuthCredential credential =
                            GoogleAuthProvider.getCredential(
                                google.getIdToken(),
                                null
                            );

                        auth.signInWithCredential(credential)
                            .addOnSuccessListener(result ->
                                runOnUiThread(() -> abrirSite())
                            )
                            .addOnFailureListener(error ->
                                mostrarErro(error.getMessage())
                            );

                    } catch (Exception error) {
                        mostrarErro(error.getMessage());
                    }
                }

                @Override
                public void onError(GetCredentialException error) {
                    mostrarErro(error.getMessage());
                }
            }
        );
    }

    private void abrirSite() {
        runOnUiThread(() -> webView.loadUrl(SITE));
    }

    private void mostrarErro(String mensagem) {
        runOnUiThread(() ->
            Toast.makeText(
                this,
                "Erro no login Google: " + mensagem,
                Toast.LENGTH_LONG
            ).show()
        );
    }
}
