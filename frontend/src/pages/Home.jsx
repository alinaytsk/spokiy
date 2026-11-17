// The home page: the hero, then the topic list read from the API, so adding a topic is a
// backend change only.
//
// The list is laid out like a spec table - index, title, one-line idea, state - because
// it is one: five topics, which are ready, which are coming.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import ExplodedStack from '../components/ExplodedStack.jsx';
import Wires from '../components/Wires.jsx';
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

  const ready = topics.filter((topic) => BUILT.has(topic.id)).length;

  return (
    <section>
      <header className="hero">
        <div className="heroBar" aria-hidden="true">
          <span>Fetch</span>
          <span>Decode</span>
          <span>Execute</span>
          <span>Repeat</span>
        </div>

        <div className="heroText">
          <p className="eyebrow">Computer Organization Principles · UCU</p>
          <h1>The computer, taken apart</h1>
          <div className="heroMarks" aria-hidden="true">
            <span className="px" />
            <span className="px" />
          </div>
          <p className="heroTagline">Every instruction has a route.</p>
          <p className="lede">
            Short, clickable explanations of the parts of the course that are hard to hold in
            your head. Change the parameters, watch what moves, then practise on questions
            written the way the course asks them.
          </p>
          <div className="heroActions">
            <Link className="button primary" to="/topics/instruction-cycle">
              Start with the cycle →
            </Link>
            <Link className="button" to="/quiz/practice">
              Random practice
            </Link>
          </div>
        </div>

        <div className="heroArt">
          <ExplodedStack />
        </div>

        <Wires />
      </header>

      <div className="sectionHead">
        <h2>Topics</h2>
        {topics.length > 0 && (
          <span>
            {String(ready).padStart(2, '0')} / {String(topics.length).padStart(2, '0')} ready
          </span>
        )}
      </div>

      {loading && <p className="muted">Loading topics…</p>}

      {error && (
        <p className="error">
          Could not reach the API: {error}. Is it running on the URL in{' '}
          <code>public/config.json</code>?
        </p>
      )}

      <ul className="topicList">
        {topics.map((topic, index) => {
          const built = BUILT.has(topic.id);
          return (
            <li key={topic.id} className={built ? 'built' : 'pending'}>
              <span className="topicIndex">{String(index + 1).padStart(2, '0')}</span>
              <div>
                <h2>
                  <Link to={`/topics/${topic.id}`}>{topic.title}</Link>
                </h2>
                <p>{topic.cheatSheet}</p>
              </div>
              <span className="topicState">
                {built ? (
                  <>
                    Open <span aria-hidden="true">→</span>
                  </>
                ) : (
                  'Coming soon'
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default Home;
