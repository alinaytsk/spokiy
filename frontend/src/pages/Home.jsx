// The topic list, read from the API so that adding a topic is a backend change only.
//
// `owner` is shown while the project is being built: it is how the three of us can see at
// a glance which lessons still have nobody on them. Worth removing before the demo.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { api } from '../lib/api.js';

// The lessons that actually exist. Everything else routes to a placeholder until the
// teammate who owns it pushes their page.
const BUILT = new Set([
  'instruction-cycle',
  'number-representation',
  'pipelining',
  'cache-memory-hierarchy',
]);

export function Home() {
  const [topics, setTopics] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .listTopics()
      .then((data) => setTopics(data.topics))
      .catch((problem) => setError(problem.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section>
      <header className="hero">
        <h1>sPOKiy</h1>
        <p className="lede">
          Short, clickable explanations of the parts of Computer Organization that are hard to
          hold in your head. Change the parameters, watch what moves, then practise.
        </p>
      </header>

      {loading && <p className="muted">Loading topics…</p>}

      {error && (
        <p className="error">
          Could not reach the API: {error}. Is it running on the URL in{' '}
          <code>public/config.json</code>?
        </p>
      )}

      <ul className="topicList">
        {topics.map((topic) => (
          <li key={topic.id} className={BUILT.has(topic.id) ? 'built' : 'pending'}>
            <h2>
              <Link to={`/topics/${topic.id}`}>{topic.title}</Link>
            </h2>
            <p>{topic.cheatSheet}</p>
            <p className="muted">
              {BUILT.has(topic.id) ? 'Ready' : 'In progress'} · owner: {topic.owner}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default Home;
