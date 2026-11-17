// Quiz-prep mode.
//
//   /quiz/:topicId    the mini-quiz after a lesson; the score goes into progress
//   /quiz/practice    a random mix from every topic, the way the class quizzes come
//
// Feedback is instant, one question at a time, but the answers still never reach the
// browser before the student commits: "Check" sends that single answer to the grading
// route and shows what comes back. The other questions grade as unanswered, which is
// harmless - only the one result is read.

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { useAuth } from '../auth/context.js';
import { api } from '../lib/api.js';
import { WEAK_BELOW, recordProgress } from '../lib/progress.js';

const PRACTICE = 'practice';
const PRACTICE_SIZE = 10;

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

// Every question carries its topicId, so practice mode can grade each one against the
// right bank.
async function loadQuestions(topicId, topics) {
  if (topicId !== PRACTICE) {
    const quiz = await api.getQuiz(topicId);
    return quiz.questions.map((question) => ({ ...question, topicId }));
  }

  // A topic without a bank yet answers 404; practice simply leaves it out.
  const banks = await Promise.all(
    topics.map((topic) => api.getQuiz(topic.id).catch(() => null)),
  );
  const all = banks
    .filter(Boolean)
    .flatMap((quiz) => quiz.questions.map((question) => ({ ...question, topicId: quiz.topicId })));

  return shuffle(all).slice(0, PRACTICE_SIZE);
}

// Each topic and each retry gets a fresh run: the key throws the old state away, so there
// is nothing to reset by hand.
export function Quiz() {
  const { topicId } = useParams();
  const [round, setRound] = useState(0);

  return (
    <QuizRun
      key={`${topicId}:${round}`}
      topicId={topicId}
      onRestart={() => setRound((value) => value + 1)}
    />
  );
}

function QuizRun({ topicId, onRestart }) {
  const { user, configured } = useAuth();
  const isPractice = topicId === PRACTICE;

  const [topics, setTopics] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [checking, setChecking] = useState(false);
  // questionId -> the graded result for that question
  const [results, setResults] = useState({});
  const [finished, setFinished] = useState(false);
  const [saveNote, setSaveNote] = useState(null);

  useEffect(() => {
    api
      .listTopics()
      .then(async ({ topics: list }) => {
        setTopics(list);
        setQuestions(await loadQuestions(topicId, list));
      })
      .catch((problem) => setError(problem.message))
      .finally(() => setLoading(false));
  }, [topicId]);

  const titleOf = (id) => topics.find((topic) => topic.id === id)?.title ?? id;

  if (loading) return <p className="muted">Loading questions…</p>;

  if (error) {
    return (
      <section className="card">
        <p className="eyebrow">Quiz</p>
        <h1>Could not load this quiz</h1>
        <p className="error">{error}</p>
        <p>
          <Link to="/">← Back to the topics</Link>
        </p>
      </section>
    );
  }

  if (questions.length === 0) {
    return (
      <section className="card">
        <h1>No questions yet</h1>
        <p>
          <Link to="/">← Back to the topics</Link>
        </p>
      </section>
    );
  }

  const question = questions[index];
  const result = results[question.id];
  const answered = Object.values(results);
  const correctSoFar = answered.filter((item) => item.correct).length;
  const isLast = index === questions.length - 1;

  async function check() {
    if (selected === null) return;
    setChecking(true);
    try {
      const graded = await api.gradeQuiz(question.topicId, [
        { questionId: question.id, selectedIndex: selected },
      ]);
      const mine = graded.results.find((item) => item.questionId === question.id);
      setResults((current) => ({ ...current, [question.id]: mine }));
    } catch (problem) {
      setError(problem.message);
    } finally {
      setChecking(false);
    }
  }

  function next() {
    setIndex((value) => value + 1);
    setSelected(null);
  }

  async function finish() {
    setFinished(true);
    if (isPractice) return;

    // Signed out with a real pool: nothing to save against. Locally with no pool the API
    // runs with AUTH_BYPASS, so saving is still worth trying.
    if (configured && !user) {
      setSaveNote('Sign in to keep this score on your progress page.');
      return;
    }

    const percentage = Math.round((correctSoFar / questions.length) * 100);
    try {
      await recordProgress(topicId, { completed: true, score: percentage });
      setSaveNote('Saved to your progress.');
    } catch (problem) {
      setSaveNote(`The score was not saved: ${problem.message}`);
    }
  }

  if (finished) {
    const percentage = Math.round((correctSoFar / questions.length) * 100);
    const weak = percentage < WEAK_BELOW;

    return (
      <article className="quiz">
        <header>
          <p className="eyebrow">{isPractice ? 'Practice' : 'Quiz'} · results</p>
          <h1>{isPractice ? 'Random practice' : titleOf(topicId)}</h1>
        </header>

        <div className="readout">
          <div>
            <span className="readoutLabel">correct</span>
            <span className="readoutValue">
              {correctSoFar} / {questions.length}
            </span>
          </div>
          <div>
            <span className="readoutLabel">score</span>
            <span className={`readoutValue ${weak ? 'bad' : 'good'}`}>{percentage}%</span>
          </div>
        </div>

        <p className="notice">
          {weak
            ? `Under ${WEAK_BELOW}% — this would cost points in class. Go through the lesson once more, then retry.`
            : 'Good enough to walk into class with. Skim the cheat sheet before the quiz anyway.'}
        </p>
        {saveNote && <p className="muted">{saveNote}</p>}

        <ol className="reviewList">
          {questions.map((item) => {
            const outcome = results[item.id];
            return (
              <li key={item.id} className={outcome?.correct ? 'good' : 'bad'}>
                <p className="reviewPrompt">
                  <span aria-hidden="true">{outcome?.correct ? '✓' : '✗'}</span> {item.prompt}
                </p>
                {!outcome?.correct && outcome && (
                  <p className="muted">
                    Answer: {item.options[outcome.correctIndex]} — {outcome.explanation}
                  </p>
                )}
              </li>
            );
          })}
        </ol>

        <div className="controls">
          <button type="button" className="primary" onClick={onRestart}>
            {isPractice ? 'New random set' : 'Try again'}
          </button>
        </div>

        <footer className="lessonLinks">
          {!isPractice && <Link to={`/topics/${topicId}`}>Back to the lesson</Link>}
          <Link to="/quiz/practice">Random practice</Link>
          <Link to="/cheat-sheet">Cheat sheet</Link>
          <Link to="/progress">Progress</Link>
        </footer>
      </article>
    );
  }

  return (
    <article className="quiz">
      <header>
        <p className="eyebrow">{isPractice ? 'Practice · every topic mixed' : 'Quiz'}</p>
        <h1>{isPractice ? 'Random practice' : titleOf(topicId)}</h1>
      </header>

      <div className="quizMeter" aria-hidden="true">
        {questions.map((item, position) => {
          const outcome = results[item.id];
          const state = outcome ? (outcome.correct ? 'good' : 'bad') : position === index ? 'now' : '';
          return <span key={item.id} className={state} />;
        })}
      </div>

      <section className="questionCard">
        <p className="stepCount">
          Question {index + 1} of {questions.length}
          {isPractice && ` · ${titleOf(question.topicId)}`}
        </p>
        <h2>{question.prompt}</h2>

        <div className="options" role="radiogroup">
          {question.options.map((option, position) => {
            let state = '';
            if (result) {
              if (position === result.correctIndex) state = 'good';
              else if (position === selected) state = 'bad';
            } else if (position === selected) {
              state = 'picked';
            }

            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={position === selected}
                className={`option ${state}`}
                disabled={Boolean(result)}
                onClick={() => setSelected(position)}
              >
                <span className="optionLetter">{String.fromCharCode(65 + position)}</span>
                {option}
              </button>
            );
          })}
        </div>

        {result && (
          <div className={`feedback ${result.correct ? 'good' : 'bad'}`}>
            <strong>{result.correct ? 'Correct.' : 'Not quite.'}</strong> {result.explanation}
          </div>
        )}
      </section>

      <div className="controls">
        {!result && (
          <button
            type="button"
            className="primary"
            onClick={check}
            disabled={selected === null || checking}
          >
            {checking ? 'Checking…' : 'Check'}
          </button>
        )}
        {result && !isLast && (
          <button type="button" className="primary" onClick={next}>
            Next question
          </button>
        )}
        {result && isLast && (
          <button type="button" className="primary" onClick={finish}>
            See results
          </button>
        )}
        <span className="muted">
          {correctSoFar} correct of {answered.length} answered
        </span>
      </div>

      <footer className="lessonLinks">
        {!isPractice && <Link to={`/topics/${topicId}`}>← Back to the lesson</Link>}
        <Link to="/cheat-sheet">Cheat sheet</Link>
      </footer>
    </article>
  );
}

export default Quiz;
