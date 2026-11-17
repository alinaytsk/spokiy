// Lesson: the memory hierarchy (part 1 of the cache topic).
//
// A pyramid of the seven levels a student is expected to name, from registers down to the
// hard disk. Click a level for its size, latency, technology and who manages it. The
// latency bars underneath are on a log scale, because on a linear one everything above
// RAM is an invisible sliver - which is the point, but it makes a poor picture.
//
// "Human scale" stretches 1 ns to 1 s. Registers to disk then goes from a blink to a few
// months, and that is the number people remember after class.
//
// The figures are typical for a current desktop CPU, rounded. The quiz asks about the
// order of magnitude and the ordering, never the exact nanoseconds.

import { useState } from 'react';
import { Link } from 'react-router-dom';

const TOPIC_ID = 'cache-memory-hierarchy';

const LEVELS = [
  {
    id: 'registers',
    name: 'Registers',
    size: 'a few hundred bytes',
    latencyNs: 0.3,
    latency: '~0.3 ns (1 cycle)',
    tech: 'Flip-flops inside the core',
    managedBy: 'The compiler, which decides what lives in which register',
    volatile: true,
    note: 'The only memory the ALU works on directly. Everything else has to be brought here first.',
  },
  {
    id: 'l1',
    name: 'L1 cache',
    size: '32–64 KB per core',
    latencyNs: 1,
    latency: '~1 ns (~4 cycles)',
    tech: 'SRAM, split into instruction and data caches',
    managedBy: 'Hardware — invisible to the program',
    volatile: true,
    note: 'Split in two so that fetching the next instruction and loading data never fight over one port.',
  },
  {
    id: 'l2',
    name: 'L2 cache',
    size: '256 KB – 2 MB per core',
    latencyNs: 4,
    latency: '~4 ns (~12 cycles)',
    tech: 'SRAM',
    managedBy: 'Hardware',
    volatile: true,
    note: 'Catches what falls out of L1. Still private to one core on most designs.',
  },
  {
    id: 'l3',
    name: 'L3 cache',
    size: '8–64 MB, shared',
    latencyNs: 12,
    latency: '~12 ns (~40 cycles)',
    tech: 'SRAM',
    managedBy: 'Hardware',
    volatile: true,
    note: 'Shared by all cores, so it is also where cores see each other\'s writes.',
  },
  {
    id: 'ram',
    name: 'Main memory',
    size: '8–64 GB',
    latencyNs: 80,
    latency: '~80 ns',
    tech: 'DRAM — one capacitor per bit, refreshed constantly',
    managedBy: 'The operating system, in pages (virtual memory)',
    volatile: true,
    note: 'Cheap and dense because a bit is one transistor and one capacitor, slow for the same reason. A miss in every cache ends up here.',
  },
  {
    id: 'ssd',
    name: 'SSD',
    size: '0.5–4 TB',
    latencyNs: 100_000,
    latency: '~100 µs',
    tech: 'NAND flash',
    managedBy: 'The operating system and the file system',
    volatile: false,
    note: 'The first level that survives a power cut. A thousand times slower than RAM, which is why swapping to it is so painful.',
  },
  {
    id: 'hdd',
    name: 'Hard disk',
    size: '1–20 TB',
    latencyNs: 10_000_000,
    latency: '~10 ms',
    tech: 'Spinning magnetic platters and a moving head',
    managedBy: 'The operating system and the file system',
    volatile: false,
    note: 'Most of the 10 ms is mechanical: waiting for the head to move and the platter to turn. No electronics can fix that.',
  },
];

// Pyramid geometry, in SVG units.
const TOP = 16;
const ROW = 50;
const GAP = 4;
const NARROW = 90;
const WIDE = 680;
const CENTRE = 360;
const BOTTOM = TOP + LEVELS.length * ROW - GAP;

function widthAt(y) {
  return NARROW + ((y - TOP) / (BOTTOM - TOP)) * (WIDE - NARROW);
}

function trapezoid(index) {
  const top = TOP + index * ROW;
  const bottom = top + ROW - GAP;
  const a = widthAt(top) / 2;
  const b = widthAt(bottom) / 2;
  return `${CENTRE - a},${top} ${CENTRE + a},${top} ${CENTRE + b},${bottom} ${CENTRE - b},${bottom}`;
}

/** 1 ns -> 1 s, written the way a person would say it. */
function humanScale(ns) {
  const seconds = ns;
  if (seconds < 60) return `${seconds} s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  if (seconds < 86_400 * 2) return `${Math.round(seconds / 3600)} hours`;
  if (seconds < 86_400 * 60) return `${Math.round(seconds / 86_400)} days`;
  return `${Math.round(seconds / (86_400 * 30))} months`;
}

// Bars are log-scaled from 0.1 ns to 100 ms.
const LOG_MIN = -1;
const LOG_MAX = 8;
const barWidth = (ns) => ((Math.log10(ns) - LOG_MIN) / (LOG_MAX - LOG_MIN)) * 100;

export function MemoryHierarchy() {
  const [selected, setSelected] = useState(4); // main memory: the one every miss lands on
  const [human, setHuman] = useState(false);

  const level = LEVELS[selected];
  const ratio = Math.round(level.latencyNs / LEVELS[0].latencyNs);

  return (
    <article className="lesson">
      <header>
        <p className="eyebrow">Lesson · part 1 of 2</p>
        <h1>The memory hierarchy</h1>
        <p className="lede">
          Small and fast at the top, big and slow at the bottom. Click a level to see what it is
          made of and how long the CPU waits for it.
        </p>
      </header>

      <svg
        className="diagram pyramid"
        viewBox={`0 0 720 ${BOTTOM + TOP}`}
        role="group"
        aria-label="The memory hierarchy, from registers at the top to the hard disk at the bottom"
      >
        {LEVELS.map((item, index) => {
          const top = TOP + index * ROW;
          return (
            <g
              key={item.id}
              className={`tier ${index === selected ? 'on' : ''} ${item.volatile ? '' : 'persistent'}`}
              role="button"
              tabIndex={0}
              aria-pressed={index === selected}
              aria-label={item.name}
              onClick={() => setSelected(index)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setSelected(index);
                }
              }}
            >
              <polygon points={trapezoid(index)} />
              <text x={CENTRE} y={top + 21} className="tierName" textAnchor="middle">
                {item.name}
              </text>
              <text x={CENTRE} y={top + 38} className="tierMeta" textAnchor="middle">
                {human ? humanScale(item.latencyNs) : item.latency.split(' (')[0]}
              </text>
            </g>
          );
        })}

        <text x="16" y={TOP + 14} className="label">↑ faster</text>
        <text x="16" y={TOP + 30} className="label">↑ dearer per byte</text>
        <text x="704" y={TOP + 14} className="label" textAnchor="end">bigger ↓</text>
        <text x="704" y={TOP + 30} className="label" textAnchor="end">cheaper per byte ↓</text>
      </svg>

      <div className="controls">
        <button type="button" onClick={() => setSelected((value) => Math.max(0, value - 1))}>
          ↑ Up a level
        </button>
        <button
          type="button"
          onClick={() => setSelected((value) => Math.min(LEVELS.length - 1, value + 1))}
        >
          ↓ Down a level
        </button>
        <button type="button" className="primary" onClick={() => setHuman((value) => !value)}>
          {human ? 'Real time' : 'Human scale: 1 ns = 1 s'}
        </button>
      </div>

      <div className="stepBox">
        <p className="stepCount">
          Level {selected + 1} of {LEVELS.length} · {level.volatile ? 'volatile' : 'keeps data without power'}
        </p>
        <h2>{level.name}</h2>
        <dl className="facts">
          <dt>Typical size</dt>
          <dd>{level.size}</dd>
          <dt>One access</dt>
          <dd>
            {level.latency}
            {human && ` — like ${humanScale(level.latencyNs)} if a nanosecond were a second`}
          </dd>
          <dt>Built from</dt>
          <dd>{level.tech}</dd>
          <dt>Managed by</dt>
          <dd>{level.managedBy}</dd>
        </dl>
        <p>{level.note}</p>
        {selected > 0 && (
          <p className="muted">
            About {ratio.toLocaleString()}× slower than a register.
          </p>
        )}
      </div>

      <section className="trick">
        <h2>How long does one access take?</h2>
        <p className="muted">Log scale: every gridline is ten times slower than the one before.</p>
        <div className="latencyBars">
          {LEVELS.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className={`latencyRow ${index === selected ? 'on' : ''}`}
              onClick={() => setSelected(index)}
            >
              <span className="latencyName">{item.name}</span>
              <span className="latencyTrack">
                <span style={{ width: `${barWidth(item.latencyNs)}%` }} />
              </span>
              <span className="latencyValue">
                {human ? humanScale(item.latencyNs) : item.latency.split(' (')[0]}
              </span>
            </button>
          ))}
        </div>
        <p>
          The hierarchy only works because programs have <strong>locality</strong>: what was used
          recently will be used again (temporal), and what sits next to it will be used soon
          (spatial). Keep the working set in the top levels and the CPU almost never waits for
          the bottom ones.
        </p>
      </section>

      <footer className="lessonLinks">
        <Link to={`/topics/${TOPIC_ID}/cache`}>Part 2: cache hits and misses →</Link>
        <Link to={`/quiz/${TOPIC_ID}`}>Practise this topic</Link>
        <Link to={`/cheat-sheet#${TOPIC_ID}`}>Cheat sheet</Link>
      </footer>
    </article>
  );
}

export default MemoryHierarchy;
