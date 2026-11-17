// The home page: the scroll-driven 3D hero, then the topic list read from the API, so
// adding a topic is a backend change only.
//
// Home marks the body with .home while mounted, which lets the nav float over the
// full-screen scene instead of pushing it down.
//
// The list is laid out like a spec table - index, title, one-line idea, state - because
// it is one: five topics, which are ready, which are coming.

import { lazy, Suspense, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { api } from '../lib/api.js';

// three.js is ~150 KB gzipped: load it only here, and only once Home renders.
const Hero3D = lazy(() => import('../components/hero3d/Hero3D.jsx'));

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

  useEffect(() => {
    document.body.classList.add('home');
    return () => document.body.classList.remove('home');
  }, []);

  const ready = topics.filter((topic) => BUILT.has(topic.id)).length;

  return (
    <section>
      <Suspense fallback={<div className="hero3d hero3dLoading" />}>
        <Hero3D />
      </Suspense>

      <div className="sectionHead">
        <h2>Topics</h2>
        {topics.length > 0 && (
          <span>
            {ready} of {topics.length} ready
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
              <span className="topicIndex">{index + 1}</span>
              <div>
                <h2>
                  <Link to={`/topics/${topic.id}`}>{topic.title}</Link>
                </h2>
                <p>{topic.cheatSheet}</p>
              </div>
              <span className="topicState">
                {built ? <span aria-hidden="true">→</span> : 'Coming soon'}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default Home;
