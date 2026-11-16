// The API client.
//
// Public calls go out plain. Calls marked { auth: true } carry the Cognito ID token as a
// Bearer header - the ID token, not the access token, because that is what the backend's
// aws-jwt-verify is configured to check (tokenUse: 'id').
//
// The token is fetched per request rather than held in a variable: fetchAuthSession()
// returns the cached token and refreshes it when it is close to expiry, so asking every
// time is both cheap and correct.

import { fetchAuthSession } from 'aws-amplify/auth';

import { getConfig, isAuthConfigured } from './config.js';

async function authHeader() {
  // With no pool configured there is no token to send. The API is expected to be running
  // with AUTH_BYPASS=true in that case.
  if (!isAuthConfigured()) return {};

  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString();

  if (!token) {
    const error = new Error('Not signed in');
    error.status = 401;
    throw error;
  }

  return { Authorization: `Bearer ${token}` };
}

async function request(path, { method = 'GET', body, auth = false } = {}) {
  const { apiUrl } = getConfig();

  const headers = {
    ...(body ? { 'Content-Type': 'application/json' } : {}),
    ...(auth ? await authHeader() : {}),
  };

  const response = await fetch(`${apiUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // 204 and friends have no body to parse.
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const error = new Error(payload?.error || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }

  return payload;
}

export const api = {
  // --- public ---------------------------------------------------------------------------
  listTopics: () => request('/topics'),
  getCheatSheet: (topicId) => request(`/topics/${topicId}/cheat-sheet`),
  getQuiz: (topicId) => request(`/topics/${topicId}/quiz`),
  gradeQuiz: (topicId, answers) =>
    request(`/topics/${topicId}/quiz/grade`, { method: 'POST', body: { answers } }),
  listRequests: () => request('/requests'),

  // --- signed in ------------------------------------------------------------------------
  getProgress: () => request('/progress', { auth: true }),
  saveProgress: (progress) => request('/progress', { method: 'POST', body: progress, auth: true }),
  createRequest: (topic, wouldDonate) =>
    request('/requests', { method: 'POST', body: { topic, wouldDonate }, auth: true }),
  getFeedback: () => request('/feedback', { auth: true }),
  sendFeedback: (feedback) => request('/feedback', { method: 'POST', body: feedback, auth: true }),
};

export default api;
