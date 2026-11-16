// Cognito sign-in, wrapped so the rest of the app never imports Amplify directly.
//
// Who is signed in is settled *before* this component mounts: main.jsx asks Cognito once
// during startup and passes the answer in as `initialUser`. That buys two things. There is
// no effect setting state on mount, and there is no moment where the app is rendered but
// does not yet know whether anyone is signed in - so no "checking your session" flash and
// no nav bar that swaps buttons a heartbeat after it appears.
//
// Sign-up is two steps on Cognito: signUp() creates the account and mails a code,
// confirmSignUp() activates it. The UI has to carry the username between those two calls,
// which is why `pendingUsername` lives here rather than in the sign-up page.

import { useCallback, useMemo, useState } from 'react';
import {
  signUp as amplifySignUp,
  confirmSignUp as amplifyConfirmSignUp,
  signIn as amplifySignIn,
  signOut as amplifySignOut,
} from 'aws-amplify/auth';

import { isAuthConfigured } from '../lib/config.js';
import { AuthContext } from './context.js';
import { loadCurrentUser } from './session.js';

function notConfigured() {
  throw new Error(
    'Sign-in is not available: config.json has no user pool yet. Deploy infra/ or run the API with AUTH_BYPASS=true.',
  );
}

export function AuthProvider({ initialUser = null, children }) {
  const configured = isAuthConfigured();

  const [user, setUser] = useState(initialUser);
  const [pendingUsername, setPendingUsername] = useState(null);

  // Called after a successful sign-in, from an event handler - never from an effect.
  const refresh = useCallback(async () => {
    setUser(await loadCurrentUser());
  }, []);

  const value = useMemo(
    () => ({
      user,
      configured,
      pendingUsername,

      signUp: async (email, password) => {
        if (!configured) notConfigured();
        await amplifySignUp({
          username: email,
          password,
          options: { userAttributes: { email } },
        });
        // Remembered for the confirmation step on the next screen.
        setPendingUsername(email);
      },

      confirmSignUp: async (code, username = pendingUsername) => {
        if (!configured) notConfigured();
        await amplifyConfirmSignUp({ username, confirmationCode: code });
        setPendingUsername(null);
      },

      signIn: async (email, password) => {
        if (!configured) notConfigured();
        await amplifySignIn({ username: email, password });
        await refresh();
      },

      signOut: async () => {
        if (!configured) notConfigured();
        await amplifySignOut();
        setUser(null);
      },
    }),
    [user, configured, pendingUsername, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
