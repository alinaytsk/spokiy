// The progress tracker: which topics are done, which are weak, which are untouched.
//
// A topic is "weak" when its last quiz score is under 60%. The score is written by the quiz
// page; this page only reads. The weak ones are listed first, because the evening before a
// class that is the only list that matters.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { api } from '../lib/api.js';
import { WEAK_BELOW, topicStatus } from '../lib/progress.js';

const LABELS = {
  weak: 'Weak',
  done: 'Done',
  visited: 'Opened, no quiz yet',
  new: 'Not started',
};

// Weak first, untouched next, finished last.
const ORDER = { weak: 0, new: 1, visited: 2, done: 3 };

export function Progress() {
  const [topics, setTopics] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([api.listTopics(), api.getProgress()])
      .then(([topicData, progressData]) => {
        setTopics(topicData.topics);
        setRows(progressData.progress);
      })
      .catch((problem) => setError(problem.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="muted">Loading your progress…</p>;

  if (error) {
    return (
      <section className="card">
        <p className="eyebrow">Progress</p>
        <h1>Could not load your progress</h1>
        <p className="error">{error}</p>
      </section>
    );
  }

  const entries = topics
    .map((topic) => {
      const row = rows.find((item) => item.topicId === topic.id);
      return { topic, row, status: topicStatus(row) };
    })
    .sort((a, b) => ORDER[a.status] - ORDER[b.status]);

  const count = (status) => entries.filter((entry) => entry.status === status).length;
  const done = count('done');

  return (
    <section className="progressPage">
      <header>
        <p className="eyebrow">Progress</p>
        <h1>Where you stand</h1>
        <p className="lede">
          A topic is done when its quiz is at {WEAK_BELOW}% or better. Anything under that is
          weak — that is where the negative points come from.
        </p>
      </header>

      <div className="progressBar" aria-label={`${done} of ${topics.length} topics done`}>
        {entries.map((entry) => (
          <span key={entry.topic.id} className={entry.status} />
        ))}
      </div>

      <div className="readout">
        <div>
          <span className="readoutLabel">done</span>
          <span className="readoutValue good">
            {done} / {topics.length}
          </span>
        </div>
        <div>
          <span className="readoutLabel">weak</span>
          <span className="readoutValue bad">{count('weak')}</span>
        </div>
        <div>
          <span className="readoutLabel">not started</span>
          <span className="readoutValue">{count('new') + count('visited')}</span>
        </div>
      </div>

      <ul className="progressList">
        {entries.map(({ topic, row, status }) => (
          <li key={topic.id} className={status}>
            <div className="progressHead">
              <h2>
                <Link to={`/topics/${topic.id}`}>{topic.title}</Link>
              </h2>
              <span className={`badge ${status}`}>{LABELS[status]}</span>
            </div>

            {Number.isFinite(row?.score) && (
              <div className="scoreTrack" aria-label={`Last score ${row.score}%`}>
                <span style={{ width: `${row.score}%` }} />
                <i style={{ left: `${WEAK_BELOW}%` }} />
              </div>
            )}

            <p className="muted">
              {Number.isFinite(row?.score) ? `Last quiz: ${row.score}%` : 'No quiz taken yet'}
              {row?.updatedAt && ` · ${new Date(row.updatedAt).toLocaleDateString()}`}
            </p>

            <p className="progressActions">
              <Link to={`/topics/${topic.id}`}>Lesson</Link>
              <Link to={`/quiz/${topic.id}`}>{row?.score === undefined ? 'Take the quiz' : 'Retake'}</Link>
              <Link to={`/cheat-sheet#${topic.id}`}>Cheat sheet</Link>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default Progress;
