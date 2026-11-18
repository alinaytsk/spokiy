// Startup: load the runtime config first, then configure Amplify, then render.
//
// The order matters. Amplify.configure() has to run before any component calls an auth
// function, and the values it needs only exist once /config.json has been fetched - they
// are written there by the CDK deploy, after this bundle was built.

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Amplify } from 'aws-amplify';
// Lets Amplify finish a Google sign-in when Cognito redirects back with ?code=...
import 'aws-amplify/auth/enable-oauth-listener';
import { Hub } from 'aws-amplify/utils';
import { BrowserRouter } from 'react-router-dom';

import App from './App.jsx';
import AuthProvider from './auth/AuthProvider.jsx';
import { loadCurrentUser } from './auth/session.js';
import { loadConfig, isAuthConfigured } from './lib/config.js';
import './index.css';

const root = createRoot(document.getElementById('root'));

function fatal(message) {
  root.render(
    <div className="shell">
      <main>
        <section className="card">
          <h1>sPOKiy could not start</h1>
          <p className="error">{message}</p>
          <p className="muted">
            Check that <code>public/config.json</code> exists and is valid JSON.
          </p>
        </section>
      </main>
    </div>,
  );
}

/**
 * Coming back from Google, the URL carries ?code=...&state=... and Amplify swaps it for
 * tokens in the background. Wait for that to finish (or fail) before asking who is signed
 * in, otherwise the first render would show a signed-out page for a signed-in user.
 * Resolves to an error message, or null.
 */
function waitForRedirectSignIn() {
  const params = new URLSearchParams(window.location.search);
  if (!params.has('code') || !params.has('state')) return Promise.resolve(null);

  return new Promise((resolve) => {
    let stop = () => {};
    const timer = setTimeout(() => {
      stop();
      resolve('Signing in with Google took too long. Please try again.');
    }, 10000);
    stop = Hub.listen('auth', ({ payload }) => {
      if (payload.event === 'signInWithRedirect') {
        clearTimeout(timer);
        stop();
        resolve(null);
      } else if (payload.event === 'signInWithRedirect_failure') {
        clearTimeout(timer);
        stop();
        resolve(payload.data?.error?.message || 'Signing in with Google failed.');
      }
    });
  });
}

async function start() {
  const config = await loadConfig();
  let redirectError = null;

  if (isAuthConfigured(config)) {
    // Listen before configuring: configure() is what starts the code exchange.
    const redirect = waitForRedirectSignIn();
    const origin = `${window.location.origin}/`;

    Amplify.configure({
      Auth: {
        Cognito: {
          userPoolId: config.userPoolId,
          userPoolClientId: config.userPoolClientId,
          ...(config.oauthDomain && {
            loginWith: {
              oauth: {
                domain: config.oauthDomain,
                scopes: ['openid', 'email', 'profile'],
                redirectSignIn: [origin],
                redirectSignOut: [origin],
                responseType: 'code',
              },
            },
          }),
        },
      },
    });

    redirectError = await redirect;
    // Tidy the one-time code out of the address bar.
    if (window.location.search.includes('code=')) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  } else {
    // Expected locally: the placeholder config has no pool. The app runs signed out and
    // the API is expected to have AUTH_BYPASS=true.
    console.info('No Cognito pool in config.json - running without sign-in.');
  }

  // Settled before the first render, so nothing has to show a "checking…" state.
  const initialUser = await loadCurrentUser();

  root.render(
    <StrictMode>
      <BrowserRouter>
        <AuthProvider initialUser={initialUser} initialError={redirectError}>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </StrictMode>,
  );
}

start().catch((error) => fatal(error.message));
