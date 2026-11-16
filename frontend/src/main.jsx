// Startup: load the runtime config first, then configure Amplify, then render.
//
// The order matters. Amplify.configure() has to run before any component calls an auth
// function, and the values it needs only exist once /config.json has been fetched - they
// are written there by the CDK deploy, after this bundle was built.

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Amplify } from 'aws-amplify';
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

async function start() {
  const config = await loadConfig();

  if (isAuthConfigured(config)) {
    Amplify.configure({
      Auth: {
        Cognito: {
          userPoolId: config.userPoolId,
          userPoolClientId: config.userPoolClientId,
        },
      },
    });
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
        <AuthProvider initialUser={initialUser}>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </StrictMode>,
  );
}

start().catch((error) => fatal(error.message));
