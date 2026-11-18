// Routes and the shell around them.
//
// Lesson routes that still render <Placeholder> are the lines a teammate replaces with
// their own page.

import { Link, Route, Routes } from 'react-router-dom';

import { useAuth } from './auth/context.js';
import ProtectedRoute from './auth/ProtectedRoute.jsx';
import ScrollToTop from './components/ScrollToTop.jsx';
import Home from './pages/Home.jsx';
import CheatSheet from './pages/CheatSheet.jsx';
import Placeholder from './pages/Placeholder.jsx';
import Privacy from './pages/Privacy.jsx';
import Progress from './pages/Progress.jsx';
import Quiz from './pages/Quiz.jsx';
import RequestTopic from './pages/RequestTopic.jsx';
import SignIn from './pages/SignIn.jsx';
import SignUp from './pages/SignUp.jsx';
import CacheHitMiss from './pages/topics/CacheHitMiss.jsx';
import InstructionCycle from './pages/topics/InstructionCycle.jsx';
import MemoryHierarchy from './pages/topics/MemoryHierarchy.jsx';
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
      {/* Straight to the topic list, past the 3D hero. */}
      <Link to="/#topics">Lessons</Link>
      <Link to="/quiz/practice">Practice</Link>
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
      <ScrollToTop />
      <Nav />

      <main>
        <Routes>
          <Route path="/" element={<Home />} />

          {/* --- Alina's lessons --------------------------------------------------------- */}
          <Route path="/topics/instruction-cycle" element={<InstructionCycle />} />
          <Route path="/topics/number-representation" element={<NumberRepresentation />} />

          {/* --- Sofia's lesson -------------------------------------------------------- */}
          <Route path="/topics/pipelining" element={<Pipelining />} />

          {/* --- Mykhailo's lessons: the cache topic, in two parts ---------------------- */}
          <Route path="/topics/cache-memory-hierarchy" element={<MemoryHierarchy />} />
          <Route path="/topics/cache-memory-hierarchy/cache" element={<CacheHitMiss />} />

          {/* --- still to be built: replace this one ----------------------------------- */}
          <Route
            path="/topics/buses-interrupts"
            element={<Placeholder what="Buses and interrupts lesson" />}
          />

          {/* Public: the tally is shown to everyone, and the page itself asks visitors
              who are signed out to sign in before voting. */}
          <Route path="/requests" element={<RequestTopic />} />

          {/* --- quiz and cheat sheets (Mykhailo) -------------------------------------- */}
          {/* /quiz/practice is a random mix of every topic; see Quiz.jsx. */}
          <Route path="/quiz/:topicId" element={<Quiz />} />
          <Route path="/cheat-sheet" element={<CheatSheet />} />

          {/* Progress needs a signed-in user: the API reads the token to know whose it is. */}
          <Route element={<ProtectedRoute />}>
            <Route path="/progress" element={<Progress />} />
          </Route>

          {/* --- auth ------------------------------------------------------------------ */}
          <Route path="/sign-in" element={<SignIn />} />
          <Route path="/sign-up" element={<SignUp />} />
          <Route path="/privacy" element={<Privacy />} />

          <Route path="*" element={<Placeholder what="Page not found" />} />
        </Routes>
      </main>

      <footer className="siteFooter">
        <p className="muted">
          A student project for Computer Organization Principles, UCU. ·{' '}
          <Link to="/privacy">Privacy</Link>
        </p>
      </footer>
    </div>
  );
}

export default App;
