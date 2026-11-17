// The scroll-driven hero: a tall section with a sticky, full-screen canvas inside it. As
// the section scrolls past, its progress (0 at the top, 1 at the bottom) drives the scene,
// and the caption in the lower-left changes chapter.
//
// The three.js scene is loaded lazily (see Home.jsx) so no other page pays for it. If
// WebGL is unavailable the captions still work over the plain studio background.
//
// For screenshots and debugging, ?explode=0.6 pins the scene at that progress.

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { createScene } from './scene.js';

const CHAPTERS = [
  {
    from: 0,
    label: 'sPOKiy · Computer Organization Principles',
    title: 'The computer, taken apart.',
    text: 'Scroll, and watch it come apart layer by layer.',
  },
  {
    from: 0.3,
    label: '01 / The stack',
    title: 'Small and fast on top. Large and slow below.',
    text: 'Registers, cache, memory, storage: every layer trades size for speed. The lessons let you feel each trade.',
  },
  {
    from: 0.62,
    label: '02 / The route',
    title: 'Every instruction has a path.',
    text: 'Fetch it, decode it, execute it - then follow it through the pipeline, one clock cycle at a time.',
    actions: true,
  },
];

// Checked once, before the first render, so the page never flashes a canvas it cannot use.
function supportsWebGL() {
  try {
    const probe = document.createElement('canvas');
    return Boolean(probe.getContext('webgl2') || probe.getContext('webgl'));
  } catch {
    return false;
  }
}

function chapterAt(p) {
  let index = 0;
  CHAPTERS.forEach((chapter, i) => {
    if (p >= chapter.from) index = i;
  });
  return index;
}

export function Hero3D() {
  const sectionRef = useRef(null);
  const canvasRef = useRef(null);
  const [chapter, setChapter] = useState(0);
  const [progress, setProgress] = useState(0);
  const [webgl] = useState(supportsWebGL);

  useEffect(() => {
    const section = sectionRef.current;
    const canvas = canvasRef.current;
    if (!section || !canvas) return undefined;

    let scene;
    try {
      scene = createScene(canvas);
    } catch (error) {
      // WebGL exists but the context failed (driver, memory). The captions still work over
      // the plain studio background, so carry on without the scene.
      console.warn('3D scene failed to start; showing the hero without it:', error);
      return undefined;
    }

    const pinned = Number.parseFloat(new URLSearchParams(window.location.search).get('explode'));

    const resize = () => scene.resize(canvas.clientWidth, canvas.clientHeight);
    const onScroll = () => {
      let p;
      if (Number.isFinite(pinned)) {
        p = pinned;
      } else {
        const rect = section.getBoundingClientRect();
        const travel = rect.height - window.innerHeight;
        p = travel > 0 ? Math.min(Math.max(-rect.top / travel, 0), 1) : 0;
      }
      scene.setProgress(p);
      setProgress(p);
      setChapter(chapterAt(p));
    };
    const onPointer = (event) => {
      scene.setPointer((event.clientX / window.innerWidth) * 2 - 1, (event.clientY / window.innerHeight) * 2 - 1);
    };

    resize();
    onScroll();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pointermove', onPointer, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pointermove', onPointer);
      scene.dispose();
    };
  }, []);

  const current = CHAPTERS[chapter];

  return (
    <section ref={sectionRef} className="hero3d" aria-label="sPOKiy">
      <div className="hero3dSticky">
        {webgl && <canvas ref={canvasRef} className="hero3dCanvas" aria-hidden="true" />}

        <div className="hero3dTop" aria-hidden="true">
          <span>{String(chapter + 1).padStart(2, '0')} / 03</span>
          <span>A course, in separation</span>
          <span>UCU · 2026</span>
        </div>

        {/* key={chapter} restarts the fade each time the chapter changes. */}
        <div className="hero3dCaption" key={chapter}>
          <p className="hero3dLabel">{current.label}</p>
          {chapter === 0 ? <h1>{current.title}</h1> : <h2>{current.title}</h2>}
          <p className="hero3dText">{current.text}</p>
          {current.actions && (
            <div className="heroActions">
              <Link className="button primary" to="/topics/instruction-cycle">
                Begin with the cycle
              </Link>
              <Link className="button" to="/topics/pipelining">
                Open the pipeline
              </Link>
            </div>
          )}
        </div>

        <div className="hero3dProgress" aria-hidden="true">
          <span style={{ transform: `scaleX(${progress})` }} />
        </div>
      </div>
    </section>
  );
}

export default Hero3D;
