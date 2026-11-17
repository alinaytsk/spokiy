// Every cheat sheet on one screen, for the five minutes before class.
//
// All sheets are fetched at once and laid out as cards; each card has the topic id as its
// anchor, so /cheat-sheet#pipelining lands on that topic. A topic without a sheet yet is
// skipped rather than shown as an error.

import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { api } from '../lib/api.js';

export function CheatSheet() {
  const [sheets, setSheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { hash } = useLocation();

  useEffect(() => {
    api
      .listTopics()
      .then(({ topics }) =>
        Promise.all(
          topics.map((topic) =>
            api
              .getCheatSheet(topic.id)
              .then((sheet) => ({ ...sheet, summary: topic.cheatSheet }))
              .catch(() => null),
          ),
        ),
      )
      .then((loaded) => setSheets(loaded.filter(Boolean)))
      .catch((problem) => setError(problem.message))
      .finally(() => setLoading(false));
  }, []);

  // The cards are not in the DOM when the browser first tries the anchor, so scroll once
  // they are.
  useEffect(() => {
    if (!loading && hash) {
      document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' });
    }
  }, [loading, hash]);

  return (
    <section className="cheatPage">
      <header>
        <p className="eyebrow">Cheat sheets</p>
        <h1>The night before</h1>
        <p className="lede">
          The key idea of every topic on one page. If a line here does not make sense, that is
          the lesson to open.
        </p>
      </header>

      {loading && <p className="muted">Loading cheat sheets…</p>}
      {error && <p className="error">Could not load the cheat sheets: {error}</p>}

      <nav className="cheatIndex">
        {sheets.map((sheet) => (
          <a key={sheet.topicId} href={`#${sheet.topicId}`}>
            {sheet.title}
          </a>
        ))}
      </nav>

      <div className="cheatGrid">
        {sheets.map((sheet) => (
          <article key={sheet.topicId} id={sheet.topicId} className="cheatCard">
            <h2>{sheet.title}</h2>
            <p className="cheatSummary">{sheet.summary}</p>

            {sheet.sections.map((section) => (
              <div key={section.heading} className="cheatSection">
                <h3>{section.heading}</h3>
                <ul>
                  {section.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </div>
            ))}

            <p className="progressActions">
              <Link to={`/topics/${sheet.topicId}`}>Lesson</Link>
              <Link to={`/quiz/${sheet.topicId}`}>Quiz</Link>
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default CheatSheet;
