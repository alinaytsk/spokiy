// The context object and the hook that reads it.
//
// Kept apart from AuthProvider.jsx so that the file exporting the component exports only
// the component: mixing a component and a plain function in one module is what breaks
// React Fast Refresh.

import { createContext, useContext } from 'react';

export const AuthContext = createContext(null);

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth() must be used inside <AuthProvider>');
  }
  return value;
}
