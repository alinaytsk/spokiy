// Starts every new page at the top.
//
// BrowserRouter keeps the window's scroll position across navigations, so clicking a
// topic at the bottom of the home page used to open the lesson scrolled to *its* bottom.
// Links with a #hash are left alone - the page they open scrolls to its own anchor (Home
// to #topics, CheatSheet to a topic) - and so is Back/Forward, where the browser restores
// the position the reader left.

import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

export function ScrollToTop() {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (hash || navigationType === 'POP') return;
    window.scrollTo(0, 0);
  }, [pathname, hash, navigationType]);

  return null;
}

export default ScrollToTop;
