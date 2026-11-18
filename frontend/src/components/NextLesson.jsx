// "Next: <lesson> →" at the foot of a lesson, so the lessons can be walked in order
// without going back to the home page and scrolling past the 3D hero each time.
//
// The order is the course's. A lesson not in the list renders nothing; the last one
// points at random practice instead.

import { Link, useLocation } from 'react-router-dom';

const LESSONS = [
  { path: '/topics/instruction-cycle', title: 'The instruction cycle' },
  { path: '/topics/pipelining', title: 'Pipelining' },
  { path: '/topics/cache-memory-hierarchy', title: 'The memory hierarchy' },
  { path: '/topics/cache-memory-hierarchy/cache', title: 'Cache hits and misses' },
  { path: '/topics/number-representation', title: 'Number representation' },
];

export function NextLesson() {
  const { pathname } = useLocation();
  const index = LESSONS.findIndex((lesson) => lesson.path === pathname);

  if (index === -1) return null;

  const next = LESSONS[index + 1];
  if (!next) {
    return (
      <Link to="/quiz/practice" className="nextLesson">
        All lessons done: random practice →
      </Link>
    );
  }

  return (
    <Link to={next.path} className="nextLesson">
      Next: {next.title} →
    </Link>
  );
}

export default NextLesson;
