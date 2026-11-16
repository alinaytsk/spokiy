// Wraps a route that needs a signed-in user.
//
//   <Route element={<ProtectedRoute />}>
//     <Route path="/progress" element={<Progress />} />
//   </Route>
//
// The visitor is sent to /sign-in with the page they wanted remembered in location state,
// so signing in returns them there instead of dumping them on the home page.

import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from './context.js';

export function ProtectedRoute({ children }) {
  const { user, configured } = useAuth();
  const location = useLocation();

  // No "still checking" branch is needed: main.jsx resolves the session before the first
  // render, so `user` is already final by the time this runs.

  // No pool configured: local development against an API running with AUTH_BYPASS=true.
  // Blocking here would make every protected page unreachable on a laptop.
  if (!configured) {
    return children ?? <Outlet />;
  }

  if (!user) {
    return <Navigate to="/sign-in" replace state={{ from: location }} />;
  }

  return children ?? <Outlet />;
}

export default ProtectedRoute;
