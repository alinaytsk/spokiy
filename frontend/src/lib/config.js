// Runtime configuration, fetched from /config.json.
//
// This is deliberately not import.meta.env. Vite replaces env variables at build time, and
// the real user pool and API URL do not exist until the CDK stack in infra/ has been
// deployed - which happens after the frontend is built. The deploy writes the real values
// into config.json in the built site, so one bundle works against any environment.
//
// Everything that needs config waits for loadConfig() to resolve once, at startup.

let cached = null;

export async function loadConfig() {
  if (cached) return cached;

  const response = await fetch('/config.json', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Could not load /config.json (${response.status})`);
  }

  cached = await response.json();
  return cached;
}

export function getConfig() {
  if (!cached) {
    throw new Error('getConfig() called before loadConfig() resolved');
  }
  return cached;
}

/**
 * True when config.json carries a real user pool.
 *
 * The placeholder shipped for local development leaves these empty, and Amplify throws if
 * it is configured with blanks. The app checks this and runs in a signed-out mode instead,
 * which pairs with AUTH_BYPASS=true on the API.
 */
export function isAuthConfigured(config = cached) {
  return Boolean(config?.userPoolId && config?.userPoolClientId);
}
