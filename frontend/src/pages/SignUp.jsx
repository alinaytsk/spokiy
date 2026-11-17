// Sign up, then confirm with the code Cognito e-mails.
//
// One page, two steps: the form swaps to the code field once signUp() succeeds, because
// sending the visitor to a separate /confirm page would lose the username if they reloaded.
//
// The sign-in page also lands here, straight on the code step, when someone tries to sign
// in to an account they never confirmed (state.confirmEmail). Without that, an account
// whose code was lost could neither sign in nor sign up again ("User already exists").

import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/context.js';

export function SignUp() {
  const { signUp, confirmSignUp, resendCode, configured } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const fromSignIn = location.state?.confirmEmail ?? null;

  const [step, setStep] = useState(fromSignIn ? 'confirm' : 'details');
  const [email, setEmail] = useState(fromSignIn ?? '');
  const [notice, setNotice] = useState(
    fromSignIn ? 'This account is not confirmed yet. We have just sent you a new code.' : null,
  );
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleDetails(event) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signUp(email, password);
      setStep('confirm');
    } catch (problem) {
      setError(problem.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await resendCode(email);
      setNotice('A new code is on its way. Check spam if it does not arrive in a minute.');
    } catch (problem) {
      setError(problem.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm(event) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await confirmSignUp(code, email);
      navigate('/sign-in', { replace: true, state: { confirmed: true } });
    } catch (problem) {
      setError(problem.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h1>Create an account</h1>

      {!configured && (
        <p className="notice">
          No Cognito pool is configured yet, so sign-up will not work. Run the API with
          <code> AUTH_BYPASS=true</code> to work on the lessons locally.
        </p>
      )}

      {step === 'details' ? (
        <form onSubmit={handleDetails}>
          <label htmlFor="email">E-mail</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />

          <button type="submit" disabled={busy}>
            {busy ? 'Creating…' : 'Create account'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleConfirm}>
          {notice ? <p className="notice">{notice}</p> : <p>We sent a confirmation code to {email}.</p>}

          <label htmlFor="code">Confirmation code</label>
          <input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />

          <button type="submit" disabled={busy}>
            {busy ? 'Confirming…' : 'Confirm'}
          </button>
          <button type="button" onClick={handleResend} disabled={busy}>
            Send the code again
          </button>
        </form>
      )}

      {error && <p className="error">{error}</p>}

      <p className="muted">
        Already have an account? <Link to="/sign-in">Sign in</Link>
      </p>
    </section>
  );
}

export default SignUp;
