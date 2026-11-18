// Asking Cognito who is signed in.
//
// A module of its own so that AuthProvider.jsx exports nothing but a component - mixing a
// component and a plain function in one file is what trips react/only-export-components
// and breaks Fast Refresh.

import { fetchAuthSession, getCurrentUser } from 'aws-amplify/auth';

import { isAuthConfigured } from '../lib/config.js';

/**
 * The signed-in user, or null when nobody is signed in or no pool is configured.
 * Called once during startup, before the first render.
 */
export async function loadCurrentUser() {
  if (!isAuthConfigured()) return null;

  try {
    const current = await getCurrentUser();
    // A Google user's username is an opaque "google_1234…", so show the e-mail from the
    // ID token instead when there is one.
    const session = await fetchAuthSession();
    const email = session.tokens?.idToken?.payload?.email;
    return { username: email || current.username, userId: current.userId };
  } catch {
    // getCurrentUser throws when nobody is signed in. That is not an error here.
    return null;
  }
}
