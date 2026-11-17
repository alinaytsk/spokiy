// A stand-in for pages my teammates own.
//
// ------------------------------------------------------------------------------------
//  TEAMMATES: replace the <Route> that renders this with your own component in App.jsx.
//  Nothing here needs to be kept - it exists so the links in my two lessons do not dead-end
//  while we are all working in parallel.
// ------------------------------------------------------------------------------------
//
// Still to be built, and by whom:
//
//   /topics/cache-memory-hierarchy   lesson      (teammate)
//   /topics/buses-interrupts         lesson      (teammate)
//   /quiz/:topicId                   quiz page   (teammate) - API is ready:
//                                                GET  /topics/:id/quiz
//                                                POST /topics/:id/quiz/grade
//   /progress                        progress    (teammate) - GET/POST /progress, auth required
//   /cheat-sheet                     cheat sheet (teammate) - GET /topics/:id/cheat-sheet

import { Link, useParams } from 'react-router-dom';

export function Placeholder({ what, api: apiHint }) {
  const params = useParams();
  const subject = params.topicId ? `${what} — ${params.topicId}` : what;

  return (
    <section className="card">
      <p className="eyebrow">Not built yet</p>
      <h1>{subject}</h1>
      <p>
        This page belongs to a teammate and is still being written. The backend route it needs
        already works, so it can be dropped in without touching the API.
      </p>
      {apiHint && (
        <p className="muted">
          API: <code>{apiHint}</code>
        </p>
      )}
      <p>
        <Link to="/">← Back to the topics</Link>
      </p>
    </section>
  );
}

export default Placeholder;
