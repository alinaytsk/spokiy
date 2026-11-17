// Routes and the shell around them.
//
// Only two lesson routes point at real components - the two I own. The rest render
// <Placeholder> and are the lines my teammates replace with their own pages.

import { Link, Route, Routes } from 'react-router-dom';

import { useAuth } from './auth/context.js';
import ProtectedRoute from './auth/ProtectedRoute.jsx';
import Home from './pages/Home.jsx';
import Placeholder from './pages/Placeholder.jsx';
import RequestTopic from './pages/RequestTopic.jsx';
import SignIn from './pages/SignIn.jsx';
import SignUp from './pages/SignUp.jsx';
import InstructionCycle from './pages/topics/InstructionCycle.jsx';
import NumberRepresentation from './pages/topics/NumberRepresentation.jsx';
import Pipelining from './pages/topics/Pipelining.jsx';

function Nav() {
  const { user, signOut, configured } = useAuth();

  return (
    <nav className="nav">
      <Link to="/" className="brand">
        sPOKiy
      </Link>
      <span className="spacer" />
      <Link to="/cheat-sheet">Cheat sheets</Link>
      <Link to="/progress">Progress</Link>
      <Link to="/requests">Request a topic</Link>

      {user ? (
        <>
          <span className="muted">{user.username}</span>
          <button type="button" onClick={signOut}>
            Sign out
          </button>
        </>
      ) : (
        configured && (
          <>
            <Link to="/sign-in">Sign in</Link>
            <Link to="/sign-up">Create account</Link>
          </>
        )
      )}
    </nav>
  );
}

export function App() {
  return (
    <div className="shell">
      <Nav />

      <main>
        <Routes>
          <Route path="/" element={<Home />} />

          {/* --- my lessons ------------------------------------------------------------ */}
          <Route path="/topics/instruction-cycle" element={<InstructionCycle />} />
          <Route path="/topics/number-representation" element={<NumberRepresentation />} />

          <Route path="/topics/pipelining" element={<Pipelining />} />

          {/* --- teammates' lessons: replace these two --------------------------------- */}
          <Route
            path="/topics/cache-memory-hierarchy"
            element={<Placeholder what="Cache and memory hierarchy lesson" />}
          />
          <Route
            path="/topics/buses-interrupts"
            element={<Placeholder what="Buses and interrupts lesson" />}
          />

          {/* Public: the tally is shown to everyone, and the page itself asks visitors
              who are signed out to sign in before voting. */}
          <Route path="/requests" element={<RequestTopic />} />

          {/* --- teammates' pages ------------------------------------------------------ */}
          <Route
            path="/quiz/:topicId"
            element={
              <Placeholder
                what="Quiz"
                api="GET /topics/:id/quiz · POST /topics/:id/quiz/grade"
              />
            }
          />
          <Route
            path="/cheat-sheet"
            element={<Placeholder what="Cheat sheets" api="GET /topics/:id/cheat-sheet" />}
          />

          {/* Progress needs a signed-in user: the API reads the token to know whose it is. */}
          <Route element={<ProtectedRoute />}>
            <Route
              path="/progress"
              element={<Placeholder what="Your progress" api="GET/POST /progress" />}
            />
          </Route>

          {/* --- auth ------------------------------------------------------------------ */}
          <Route path="/sign-in" element={<SignIn />} />
          <Route path="/sign-up" element={<SignUp />} />

          <Route path="*" element={<Placeholder what="Page not found" />} />
        </Routes>
      </main>

      <footer className="siteFooter">
        <p className="muted">
          A student project for Computer Organization Principles, UCU.
        </p>
      </footer>
    </div>
  );
}

export default App;
