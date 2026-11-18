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
//
// signIn() does not always throw when it fails to sign you in. For an account whose code
// was never entered, Amplify *returns* { isSignedIn: false, nextStep: CONFIRM_SIGN_UP }.
// Ignoring that return value left people on the sign-in page with no message at all, so
// signIn() here reports the outcome: 'done', or 'confirm' (a fresh code has been sent).

import { useCallback, useMemo, useState } from 'react';
import {
  signUp as amplifySignUp,
  confirmSignUp as amplifyConfirmSignUp,
  signIn as amplifySignIn,
  signOut as amplifySignOut,
  resendSignUpCode as amplifyResendSignUpCode,
  signInWithRedirect,
} from 'aws-amplify/auth';

import { isAuthConfigured, isGoogleConfigured } from '../lib/config.js';
import { AuthContext } from './context.js';
import { loadCurrentUser } from './session.js';

function notConfigured() {
  throw new Error(
    'Sign-in is not available: config.json has no user pool yet. Deploy infra/ or run the API with AUTH_BYPASS=true.',
  );
}

export function AuthProvider({ initialUser = null, children }) {
  const configured = isAuthConfigured();
  const googleEnabled = isGoogleConfigured();

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
      googleEnabled,
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

      // Returns 'done' when signed in, or 'confirm' when the account still needs its
      // e-mailed code (a new one has just been sent). Anything else throws.
      signIn: async (email, password) => {
        if (!configured) notConfigured();

        let result;
        try {
          result = await amplifySignIn({ username: email, password });
        } catch (problem) {
          // A stale session left in this browser (an old sign-in, a previous deploy)
          // blocks a new one. Clear it and try once more.
          if (problem.name !== 'UserAlreadyAuthenticatedException') throw problem;
          await amplifySignOut();
          result = await amplifySignIn({ username: email, password });
        }

        const step = result.nextStep?.signInStep;
        if (step === 'CONFIRM_SIGN_UP') {
          await amplifyResendSignUpCode({ username: email });
          setPendingUsername(email);
          return 'confirm';
        }
        if (!result.isSignedIn) {
          throw new Error(`Cognito asked for a step this site does not support yet (${step}).`);
        }

        await refresh();
        return 'done';
      },

      resendCode: async (email) => {
        if (!configured) notConfigured();
        await amplifyResendSignUpCode({ username: email });
      },

      // Leaves the site for Google and comes back to '/'; main.jsx picks the user up from
      // there on the next load.
      signInWithGoogle: async () => {
        if (!googleEnabled) notConfigured();
        await signInWithRedirect({ provider: 'Google' });
      },

      signOut: async () => {
        if (!configured) notConfigured();
        await amplifySignOut();
        setUser(null);
      },
    }),
    [user, configured, googleEnabled, pendingUsername, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
