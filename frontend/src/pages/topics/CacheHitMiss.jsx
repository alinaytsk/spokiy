// Lesson: cache hits and misses (part 2 of the cache topic).
//
// A tiny cache simulator. Pick the number of lines, the block size and the mapping, feed it
// a sequence of word addresses, and step through: each access splits the address into
// tag | index | offset, looks in one set, and either hits or brings the block in, evicting
// the least recently used line if the set is full.
//
// Every miss is also classified, because the quiz asks for it:
//   compulsory - the block was never in the cache before
//   capacity   - a fully associative cache of the same size would have missed too
//   conflict   - it would have hit, but this mapping forced the block out
// The capacity check runs a second, fully associative LRU cache alongside the real one.
//
// The whole run is computed up front by simulate(), a pure function; `step` only chooses
// how much of it to show, so Back is as cheap as Next.

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

const TOPIC_ID = 'cache-memory-hierarchy';

// Word addresses 0-63: six bits, short enough to print in full.
const ADDRESS_BITS = 6;
const MAX_ADDRESS = 2 ** ADDRESS_BITS - 1;
const MAX_ACCESSES = 32;

const HIT_NS = 1;
const MISS_PENALTY_NS = 100;

const LINE_OPTIONS = [2, 4, 8];
const BLOCK_OPTIONS = [1, 2, 4];
const MAPPINGS = [
  { id: 'direct', label: 'Direct-mapped' },
  { id: 'two-way', label: '2-way set associative' },
  { id: 'full', label: 'Fully associative' },
];

const range = (from, to, by = 1) =>
  Array.from({ length: Math.floor((to - from) / by) + 1 }, (_, index) => from + index * by);

const PRESETS = [
  {
    label: 'Walk an array',
    addresses: range(0, 15),
    hint: 'Spatial locality: one miss brings in a whole block, and its neighbours hit. Try block size 4.',
  },
  {
    label: 'Loop twice',
    addresses: [...range(0, 7), ...range(0, 7)],
    hint: 'Temporal locality: the second pass finds everything still there.',
  },
  {
    label: 'Ping-pong',
    addresses: [0, 16, 0, 16, 0, 16, 0, 16],
    hint: 'Two addresses that map to the same line evict each other for ever. Switch to 2-way and watch the conflict misses vanish.',
  },
  {
    label: 'Too big to fit',
    addresses: [...range(0, 14, 2), ...range(0, 14, 2)],
    hint: 'Eight blocks, twice, into a cache that holds four. No mapping helps: these are capacity misses. Try 8 lines.',
  },
];

const SPEEDS = [
  { label: 'Slow', ms: 1800 },
  { label: 'Normal', ms: 1000 },
  { label: 'Fast', ms: 450 },
];

const log2 = (value) => Math.round(Math.log2(value));

function waysFor(mapping, lines) {
  if (mapping === 'direct') return 1;
  if (mapping === 'two-way') return Math.min(2, lines);
  return lines;
}

/** Runs the whole access sequence and returns one record per access. */
function simulate(addresses, { lines, blockSize, mapping }) {
  const ways = waysFor(mapping, lines);
  const setCount = lines / ways;

  const sets = Array.from({ length: setCount }, () => Array(ways).fill(null));
  const seen = new Set();
  let shadow = []; // fully associative LRU of the same size, most recent last

  return addresses.map((address, time) => {
    const block = Math.floor(address / blockSize);
    const set = block % setCount;
    const tag = Math.floor(block / setCount);
    const offset = address % blockSize;
    const row = sets[set];

    let way = row.findIndex((line) => line && line.tag === tag);
    const hit = way !== -1;
    let evicted = null;

    if (hit) {
      row[way] = { ...row[way], lastUsed: time };
    } else {
      way = row.indexOf(null);
      if (way === -1) {
        way = row.reduce(
          (oldest, line, index) => (line.lastUsed < row[oldest].lastUsed ? index : oldest),
          0,
        );
        evicted = row[way].block;
      }
      row[way] = { tag, block, lastUsed: time };
    }

    let missKind = null;
    if (!hit) {
      if (!seen.has(block)) missKind = 'compulsory';
      else if (!shadow.includes(block)) missKind = 'capacity';
      else missKind = 'conflict';
    }

    seen.add(block);
    shadow = [...shadow.filter((item) => item !== block), block].slice(-lines);

    return {
      address,
      block,
      set,
      tag,
      offset,
      way,
      hit,
      evicted,
      missKind,
      cache: sets.map((row) => row.map((line) => (line ? { ...line } : null))),
    };
  });
}

function parseAddresses(text) {
  const values = text
    .split(/[\s,;]+/)
    .filter(Boolean)
    .map(Number);

  if (values.length === 0) return { error: 'Type at least one address.' };
  if (values.some((value) => !Number.isInteger(value) || value < 0 || value > MAX_ADDRESS)) {
    return { error: `Addresses are whole numbers from 0 to ${MAX_ADDRESS}.` };
  }
  if (values.length > MAX_ACCESSES) return { error: `At most ${MAX_ACCESSES} accesses.` };
  return { addresses: values };
}

const binary = (value, width) => (width === 0 ? '' : value.toString(2).padStart(width, '0'));

const blockWords = (block, blockSize) =>
  blockSize === 1 ? `M[${block}]` : `M[${block * blockSize}–${block * blockSize + blockSize - 1}]`;

function explain(access, blockSize, setCount, mapping) {
  const where =
    setCount === 1 ? 'the only set (fully associative: any line will do)' : `set ${access.set}`;
  const intro = `Address ${access.address} is in block ${access.block} (${blockWords(access.block, blockSize)}), which belongs in ${where}.`;

  if (access.hit) {
    return `${intro} A valid line there already holds tag ${access.tag} — hit, ${HIT_NS} ns.`;
  }

  const eviction =
    access.evicted === null
      ? 'An empty line takes it.'
      : `The set is full, so the least recently used line — block ${access.evicted} — is evicted.`;

  const why = {
    compulsory: 'Compulsory miss: this block was never loaded before, and no cache could have avoided it.',
    capacity:
      'Capacity miss: the program is using more blocks than the whole cache holds. Only a bigger cache helps.',
    conflict:
      mapping === 'direct'
        ? 'Conflict miss: there was room elsewhere, but direct mapping allows this block only one line. More associativity would have kept it.'
        : 'Conflict miss: there was room elsewhere, but not in this set.',
  }[access.missKind];

  return `${intro} No line in it holds tag ${access.tag} — miss, ${HIT_NS + MISS_PENALTY_NS} ns. ${eviction} ${why}`;
}

export function CacheHitMiss() {
  const [lines, setLines] = useState(4);
  const [blockSize, setBlockSize] = useState(2);
  const [mapping, setMapping] = useState('direct');
  const [addresses, setAddresses] = useState(PRESETS[0].addresses);
  const [hint, setHint] = useState(PRESETS[0].hint);
  const [draft, setDraft] = useState(PRESETS[0].addresses.join(', '));
  const [inputError, setInputError] = useState(null);

  const [step, setStep] = useState(0); // accesses already performed
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const ways = waysFor(mapping, lines);
  const setCount = lines / ways;
  const offsetBits = log2(blockSize);
  const indexBits = log2(setCount);
  const tagBits = ADDRESS_BITS - offsetBits - indexBits;

  const run = useMemo(
    () => simulate(addresses, { lines, blockSize, mapping }),
    [addresses, lines, blockSize, mapping],
  );

  const done = run.slice(0, step);
  const current = step > 0 ? run[step - 1] : null;
  const cache = current ? current.cache : Array.from({ length: setCount }, () => Array(ways).fill(null));
  const isLast = step === run.length;

  const hits = done.filter((access) => access.hit).length;
  const misses = done.length - hits;
  const missRate = done.length ? misses / done.length : 0;
  const kinds = (kind) => done.filter((access) => access.missKind === kind).length;

  // Autoplay stops itself on the last access rather than looping.
  useEffect(() => {
    if (!playing) return undefined;
    const timer = setTimeout(() => {
      setStep(step + 1);
      if (step + 1 >= run.length) setPlaying(false);
    }, SPEEDS[speed].ms);
    return () => clearTimeout(timer);
  }, [playing, step, speed, run.length]);

  // Any change to the cache or the input starts the run over.
  const restart = () => {
    setStep(0);
    setPlaying(false);
  };

  const choosePreset = (preset) => {
    setAddresses(preset.addresses);
    setDraft(preset.addresses.join(', '));
    setHint(preset.hint);
    setInputError(null);
    restart();
  };

  const applyDraft = (event) => {
    event.preventDefault();
    const parsed = parseAddresses(draft);
    if (parsed.error) {
      setInputError(parsed.error);
      return;
    }
    setAddresses(parsed.addresses);
    setHint(null);
    setInputError(null);
    restart();
  };

  return (
    <article className="lesson">
      <header>
        <p className="eyebrow">Lesson · part 2 of 2</p>
        <h1>Cache hits and misses</h1>
        <p className="lede">
          A cache of {lines} lines, {blockSize} {blockSize === 1 ? 'word' : 'words'} each. Change
          its shape, feed it addresses, and watch which accesses pay the {MISS_PENALTY_NS} ns trip
          to memory.
        </p>
      </header>

      <div className="settings">
        <label>
          Lines
          <select
            value={lines}
            onChange={(event) => {
              setLines(Number(event.target.value));
              restart();
            }}
          >
            {LINE_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label>
          Block size (words)
          <select
            value={blockSize}
            onChange={(event) => {
              setBlockSize(Number(event.target.value));
              restart();
            }}
          >
            {BLOCK_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label>
          Mapping
          <select
            value={mapping}
            onChange={(event) => {
              setMapping(event.target.value);
              restart();
            }}
          >
            {MAPPINGS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="controls">
        {PRESETS.map((preset) => (
          <button key={preset.label} type="button" onClick={() => choosePreset(preset)}>
            {preset.label}
          </button>
        ))}
      </div>

      <form className="addressForm" onSubmit={applyDraft}>
        <label htmlFor="addresses">Your own addresses (0–{MAX_ADDRESS}, comma-separated)</label>
        <div>
          <input
            id="addresses"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            spellCheck="false"
          />
          <button type="submit">Use these</button>
        </div>
        {inputError && <p className="error">{inputError}</p>}
      </form>

      {hint && <p className="notice">{hint}</p>}

      <ol className="accessStrip" aria-label="Access sequence">
        {run.map((access, index) => {
          let state = '';
          if (index < step) state = access.hit ? 'good' : 'bad';
          if (index === step - 1) state += ' now';
          return (
            <li key={index} className={state}>
              <button type="button" onClick={() => setStep(index + 1)} title={`Run up to access ${index + 1}`}>
                {access.address}
              </button>
            </li>
          );
        })}
      </ol>

      <div className="addressSplit" aria-label="Address bits">
        <span className="readoutLabel">
          {current ? `address ${current.address} in binary` : `${ADDRESS_BITS}-bit address`}
        </span>
        <div className="bitsSplit">
          {tagBits > 0 && (
            <span className="tagBits">
              <b>{current ? binary(current.tag, tagBits) : 't'.repeat(tagBits)}</b>
              <small>tag · {tagBits} bits</small>
            </span>
          )}
          {indexBits > 0 && (
            <span className="indexBits">
              <b>{current ? binary(current.set, indexBits) : 'i'.repeat(indexBits)}</b>
              <small>index · {indexBits}</small>
            </span>
          )}
          {offsetBits > 0 && (
            <span className="offsetBits">
              <b>{current ? binary(current.offset, offsetBits) : 'o'.repeat(offsetBits)}</b>
              <small>offset · {offsetBits}</small>
            </span>
          )}
        </div>
      </div>

      <div className="cacheTableWrap">
        <table className="cacheTable">
          <thead>
            <tr>
              <th>Set</th>
              {Array.from({ length: ways }, (_, way) => (
                <th key={way}>{ways === 1 ? 'Line' : `Way ${way}`}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cache.map((row, set) => (
              <tr key={set} className={current?.set === set ? 'activeSet' : ''}>
                <th>{setCount === 1 ? '—' : binary(set, indexBits) || set}</th>
                {row.map((line, way) => {
                  const touched = current && current.set === set && current.way === way;
                  const state = touched ? (current.hit ? 'good' : 'bad') : '';
                  return (
                    <td key={way} className={`${state} ${line ? '' : 'empty'}`}>
                      {line ? (
                        <>
                          <span className="lineTag">tag {binary(line.tag, tagBits) || '—'}</span>
                          <span className="lineData">{blockWords(line.block, blockSize)}</span>
                        </>
                      ) : (
                        <span className="lineData">empty</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="stepBox">
        <p className="stepCount">
          Access {step} of {run.length}
          {current && ` · ${current.hit ? 'hit' : `${current.missKind} miss`}`}
        </p>
        <h2>
          {current
            ? current.hit
              ? `Hit on address ${current.address}`
              : `Miss on address ${current.address}`
            : 'Empty cache, nothing accessed yet'}
        </h2>
        <p>
          {current
            ? explain(current, blockSize, setCount, mapping)
            : 'Every valid bit is 0. Press Next to make the first access — it is bound to miss.'}
        </p>
      </div>

      <div className="controls">
        <button type="button" onClick={restart} disabled={step === 0 && !playing}>
          Reset
        </button>
        <button type="button" onClick={() => setStep((value) => Math.max(0, value - 1))} disabled={step === 0}>
          Back
        </button>
        <button type="button" onClick={() => setStep((value) => value + 1)} disabled={isLast}>
          Next access
        </button>
        <button
          type="button"
          className="primary"
          onClick={() => {
            if (isLast) setStep(0);
            setPlaying((value) => !value);
          }}
        >
          {playing ? 'Pause' : 'Play'}
        </button>
        <button type="button" onClick={() => setStep(run.length)} disabled={isLast}>
          Run to the end
        </button>

        <label htmlFor="cacheSpeed">Speed</label>
        <select id="cacheSpeed" value={speed} onChange={(event) => setSpeed(Number(event.target.value))}>
          {SPEEDS.map((option, index) => (
            <option key={option.label} value={index}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="readout">
        <div>
          <span className="readoutLabel">hits / misses</span>
          <span className="readoutValue">
            <span className="good">{hits}</span> / <span className="bad">{misses}</span>
          </span>
        </div>
        <div>
          <span className="readoutLabel">hit rate</span>
          <span className="readoutValue">
            {done.length ? `${Math.round((hits / done.length) * 100)}%` : '—'}
          </span>
        </div>
        <div>
          <span className="readoutLabel">average access time</span>
          <span className="readoutValue">
            {done.length ? `${(HIT_NS + missRate * MISS_PENALTY_NS).toFixed(1)} ns` : '—'}
          </span>
        </div>
      </div>

      <p className="muted">
        Misses so far: {kinds('compulsory')} compulsory · {kinds('capacity')} capacity ·{' '}
        {kinds('conflict')} conflict. Average access time = hit time + miss rate × miss penalty
        = {HIT_NS} + {missRate.toFixed(2)} × {MISS_PENALTY_NS}.
      </p>

      <footer className="lessonLinks">
        <Link to={`/quiz/${TOPIC_ID}`}>Practise this topic →</Link>
        <Link to={`/topics/${TOPIC_ID}`}>← Part 1: the memory hierarchy</Link>
        <Link to={`/cheat-sheet#${TOPIC_ID}`}>Cheat sheet</Link>
      </footer>
    </article>
  );
}

export default CacheHitMiss;
