// The hero picture: a chip taken apart into the memory hierarchy.
//
// Five isometric slabs, smallest and fastest on top, largest and slowest at the bottom,
// drawn in plain SVG. They start stacked and slide apart once the page has loaded.
// Hovering a layer (or focusing it with the keyboard) picks it out; nothing moves on its
// own after that, so the picture never competes with the text beside it.
//
// Everything is computed from the LAYERS table, so the picture is the data: change a size
// or a latency there and the drawing follows.

import { useEffect, useState } from 'react';

const LAYERS = [
  { name: 'Registers', meta: '< 1 ns · bytes', w: 150, t: 9, detail: 'die' },
  { name: 'L1 cache', meta: '~1 ns · 32 KB', w: 196, t: 10, detail: 'grid' },
  { name: 'L2 cache', meta: '~4 ns · 1 MB', w: 242, t: 11, detail: 'grid' },
  { name: 'Main memory', meta: '~100 ns · 16 GB', w: 290, t: 13, detail: 'chips' },
  { name: 'SSD', meta: '~100 µs · 1 TB', w: 340, t: 15, detail: 'chips' },
];

const CX = 210;
const LABEL_X = 430;
const STACKED = (i) => 200 + i * 20;
const SPREAD = (i) => 70 + i * 92;

function lerp(a, b, f) {
  return a + (b - a) * f;
}

// The four corners of an isometric rhombus of width w centred on (cx, cy).
function rhombus(cx, cy, w) {
  const h = w / 2;
  return {
    T: [cx, cy - h / 2],
    R: [cx + w / 2, cy],
    B: [cx, cy + h / 2],
    L: [cx - w / 2, cy],
  };
}

const pts = (...points) => points.map(([x, y]) => `${x},${y}`).join(' ');
const mix = ([ax, ay], [bx, by], f) => [ax + (bx - ax) * f, ay + (by - ay) * f];

function gridLines({ T, R, B, L }, n) {
  const lines = [];
  for (let k = 1; k < n; k += 1) {
    const f = k / n;
    lines.push([mix(L, T, f), mix(B, R, f)]);
    lines.push([mix(L, B, f), mix(T, R, f)]);
  }
  return lines;
}

function Slab({ layer, index }) {
  const { w, t, detail } = layer;
  const corners = rhombus(CX, 0, w);
  const { T, R, B, L } = corners;
  const down = ([x, y]) => [x, y + t];

  let extra = null;
  if (detail === 'die') {
    const die = rhombus(CX, 0, w * 0.46);
    extra = (
      <>
        <polygon className="die" points={pts(die.T, die.R, die.B, die.L)} fill="url(#chrome)" />
        {gridLines(die, 4).map(([a, b]) => (
          <line key={`${a}-${b}`} className="grid" x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
        ))}
      </>
    );
  } else if (detail === 'grid') {
    extra = gridLines(corners, index === 1 ? 6 : 8).map(([a, b]) => (
      <line key={`${a}-${b}`} className="grid" x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
    ));
  } else {
    // A row of packages along the slab, like DRAM chips or NAND dies.
    const count = index === 3 ? 4 : 3;
    extra = Array.from({ length: count }, (_, k) => {
      const f = (k + 0.5) / count;
      const [x, y] = mix(mix(L, T, 0.5), mix(B, R, 0.5), f);
      const chip = rhombus(x, y, w * 0.2);
      return (
        <polygon
          key={k}
          className="die"
          points={pts(chip.T, chip.R, chip.B, chip.L)}
          fill="url(#chip)"
        />
      );
    });
  }

  return (
    <>
      <polygon className="side" points={pts(L, B, down(B), down(L))} fill="#141418" />
      <polygon className="side" points={pts(B, R, down(R), down(B))} fill="#0b0b0d" />
      <polygon className="top" points={pts(T, R, B, L)} fill="url(#metal)" />
      {extra}
    </>
  );
}

export function ExplodedStack() {
  const [spread, setSpread] = useState(0);
  const [held, setHeld] = useState(null);

  // Explode once, just after the first paint, so the transition is visible.
  useEffect(() => {
    const timer = setTimeout(() => setSpread(1), 120);
    return () => clearTimeout(timer);
  }, []);

  const active = held;

  return (
    <svg
      viewBox="0 0 640 520"
      role="img"
      aria-label="A chip taken apart into the memory hierarchy: registers, L1 cache, L2 cache, main memory and SSD, from fastest and smallest to slowest and largest."
    >
      <defs>
        <linearGradient id="metal" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4a4a52" />
          <stop offset="0.42" stopColor="#18181c" />
          <stop offset="0.68" stopColor="#6d6d76" />
          <stop offset="1" stopColor="#1f1f24" />
        </linearGradient>
        <linearGradient id="chrome" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f2f2f5" />
          <stop offset="0.35" stopColor="#5d5d66" />
          <stop offset="0.6" stopColor="#d9d9df" />
          <stop offset="1" stopColor="#2c2c32" />
        </linearGradient>
        <linearGradient id="chip" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2a2a30" />
          <stop offset="1" stopColor="#09090b" />
        </linearGradient>
      </defs>

      {/* Bottom layer first, so each slab is drawn over the one beneath it. */}
      {LAYERS.map((layer, i) => ({ layer, i }))
        .reverse()
        .map(({ layer, i }) => {
          const y = lerp(STACKED(i), SPREAD(i), spread);
          const isHot = i === active;
          const right = CX + layer.w / 2;
          return (
            <g
              key={layer.name}
              className={`stackLayer${isHot ? ' hot' : ''}`}
              style={{ transform: `translateY(${y}px)` }}
              tabIndex={0}
              onMouseEnter={() => setHeld(i)}
              onMouseLeave={() => setHeld(null)}
              onFocus={() => setHeld(i)}
              onBlur={() => setHeld(null)}
            >
              <title>{`${layer.name}: ${layer.meta}`}</title>
              <Slab layer={layer} index={i} />
              <g
                className={`stackLabel${isHot ? ' hot' : ''}`}
                style={{ opacity: spread, transition: 'opacity 0.6s 0.3s' }}
              >
                <circle cx={right} cy={0} r={2.5} />
                <line x1={right} y1={0} x2={LABEL_X - 10} y2={0} />
                <text x={LABEL_X} y={-17} className="stackIndex">
                  {`0${i + 1} / 0${LAYERS.length}`}
                </text>
                <text x={LABEL_X} y={4} className="stackName">
                  {layer.name}
                </text>
                <text x={LABEL_X} y={23} className="stackMeta">
                  {layer.meta}
                </text>
              </g>
            </g>
          );
        })}
    </svg>
  );
}

export default ExplodedStack;
