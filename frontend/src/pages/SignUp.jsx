// Sign up, then confirm with the code Cognito e-mails.
//
// One page, two steps: the form swaps to the code field once signUp() succeeds, because
// sending the visitor to a separate /confirm page would lose the username if they reloaded.

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/context.js';

export function SignUp() {
  const { signUp, confirmSignUp, configured } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState('details');
  const [email, setEmail] = useState('');
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

  async function handleConfirm(event) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await confirmSignUp(code, email);
      navigate('/sign-in', { replace: true });
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
          <p>We sent a confirmation code to {email}.</p>

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
