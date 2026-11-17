// Request form: vote for the topic sPOKiy should explain next, and say whether you would
// chip in for it.
//
// The tally is public (GET /requests) and shown first, because seeing that other people
// want "virtual memory" too is what makes a visitor vote. Voting needs an account
// (POST /requests is authenticated) so one person cannot stuff the box by reloading.
//
// "Would donate" is an intent signal for the validation report, nothing more: no payment
// is taken or asked for, and the copy says so plainly.
//
// One row per user per topic on the backend: a person can back several topics, and
// voting for the same topic again only updates their donation answer.

import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { useAuth } from '../auth/context.js';
import { api } from '../lib/api.js';

// Topics the course covers that the site does not yet. "Other" opens a text field.
const SUGGESTIONS = [
  'Virtual memory and the TLB',
  'Branch prediction',
  'Control unit: hardwired vs microprogrammed',
  'I/O, DMA and interrupt handling',
  'RISC vs CISC',
  'Assembly: the stack and calling conventions',
];

const OTHER = '__other__';
const MAX_TOPIC_LENGTH = 120;

export function RequestTopic() {
  const { user, configured } = useAuth();
  const location = useLocation();

  const [tally, setTally] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [choice, setChoice] = useState(SUGGESTIONS[0]);
  const [otherText, setOtherText] = useState('');
  const [wouldDonate, setWouldDonate] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [thanks, setThanks] = useState(null);

  const loadTally = useCallback(() => {
    return api
      .listRequests()
      .then((data) => {
        setTally(data.requests);
        setLoadError(null);
      })
      .catch((problem) => setLoadError(problem.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadTally();
  }, [loadTally]);

  // Signed out on a deployed site: the form would only fail with 401, so do not show it.
  // Locally there is no pool and the API runs with AUTH_BYPASS, so the form works.
  const canVote = !configured || Boolean(user);

  const topic = (choice === OTHER ? otherText : choice).trim();

  async function submit(event) {
    event.preventDefault();
    if (!topic) return;

    setSending(true);
    setSendError(null);
    setThanks(null);

    try {
      await api.createRequest(topic, wouldDonate);
      setThanks(topic);
      setOtherText('');
      await loadTally();
    } catch (problem) {
      setSendError(problem.message);
    } finally {
      setSending(false);
    }
  }

  const maxVotes = Math.max(1, ...tally.map((row) => row.votes));

  return (
    <section className="requestPage">
      <header>
        <p className="eyebrow">Request a topic</p>
        <h1>What should we explain next?</h1>
        <p className="lede">
          sPOKiy is built by three students. Tell us which part of the course you would most
          like to click through, and we will build the most-wanted one next.
        </p>
      </header>

      <div className="requestGrid">
        {/* --- the vote ----------------------------------------------------------------- */}
        <div className="card">
          <h2>Your vote</h2>

          {canVote ? (
            <form onSubmit={submit} className="requestForm">
              <fieldset>
                <legend>Topic</legend>
                {[...SUGGESTIONS, OTHER].map((option) => (
                  <label key={option} className="choice">
                    <input
                      type="radio"
                      name="topic"
                      value={option}
                      checked={choice === option}
                      onChange={() => setChoice(option)}
                    />
                    {option === OTHER ? 'Something else…' : option}
                  </label>
                ))}
              </fieldset>

              {choice === OTHER && (
                <>
                  <label htmlFor="otherTopic">Which topic?</label>
                  <input
                    id="otherTopic"
                    type="text"
                    required
                    maxLength={MAX_TOPIC_LENGTH}
                    value={otherText}
                    onChange={(event) => setOtherText(event.target.value)}
                    placeholder="e.g. Hamming codes"
                  />
                </>
              )}

              <label className="choice donate">
                <input
                  type="checkbox"
                  checked={wouldDonate}
                  onChange={(event) => setWouldDonate(event.target.checked)}
                />
                I would chip in a little (say, the price of a coffee) to get this topic sooner
              </label>
              <p className="muted">
                Just a show of hands — we do not take or ask for any payment here.
              </p>

              <button type="submit" className="primary" disabled={sending || !topic}>
                {sending ? 'Sending…' : 'Vote'}
              </button>

              {sendError && <p className="error">Could not save your vote: {sendError}</p>}
              {thanks && (
                <p className="notice">
                  Thanks — your vote for “{thanks}” is in. You can back other topics too.
                </p>
              )}
            </form>
          ) : (
            <p>
              <Link to="/sign-in" state={{ from: location }}>
                Sign in
              </Link>{' '}
              or{' '}
              <Link to="/sign-up">create an account</Link> to vote. One account, one vote per
              topic — that keeps the count honest.
            </p>
          )}
        </div>

        {/* --- the tally ---------------------------------------------------------------- */}
        <div className="card">
          <h2>Votes so far</h2>

          {loading && <p className="muted">Loading…</p>}
          {loadError && <p className="error">Could not load the votes: {loadError}</p>}
          {!loading && !loadError && tally.length === 0 && (
            <p className="muted">No votes yet. Yours would be the first.</p>
          )}

          <ul className="tally">
            {tally.map((row) => (
              <li key={row.topic}>
                <div className="tallyHead">
                  <span>{row.topic}</span>
                  <span className="tallyCount">{row.votes}</span>
                </div>
                <div className="tallyBar" aria-hidden="true">
                  <span style={{ width: `${(row.votes / maxVotes) * 100}%` }} />
                </div>
                {row.wouldDonate > 0 && (
                  <p className="muted">
                    {row.wouldDonate} of {row.votes} would chip in
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export default RequestTopic;
