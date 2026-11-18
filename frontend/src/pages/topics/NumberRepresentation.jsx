// Lesson: number representation, specifically 8-bit two's complement.
//
// Click the bits and watch the decimal value move. The thing worth seeing is that the top
// bit is not a "sign flag" bolted on - it is a normal place value that happens to be
// negative (-128), which is why the arithmetic just works and why the range is lopsided.
//
// The negate panel shows flip-and-add-one as three visible rows rather than asserting it.

import { useState } from 'react';
import { Link } from 'react-router-dom';

import NextLesson from '../../components/NextLesson.jsx';

const TOPIC_ID = 'number-representation';

const WIDTH = 8;
// Bit 7 carries -128; the rest are the usual powers of two.
const WEIGHTS = [-128, 64, 32, 16, 8, 4, 2, 1];

const PRESETS = [
  { label: '0', bits: [0, 0, 0, 0, 0, 0, 0, 0] },
  { label: '+1', bits: [0, 0, 0, 0, 0, 0, 0, 1] },
  { label: '-1', bits: [1, 1, 1, 1, 1, 1, 1, 1] },
  { label: '+127', bits: [0, 1, 1, 1, 1, 1, 1, 1] },
  { label: '-128', bits: [1, 0, 0, 0, 0, 0, 0, 0] },
];

function signedValue(bits) {
  return bits.reduce((total, bit, index) => total + (bit ? WEIGHTS[index] : 0), 0);
}

function unsignedValue(bits) {
  return bits.reduce((total, bit) => total * 2 + bit, 0);
}

/** Flip every bit, then add one, discarding any carry out of the top bit. */
function negate(bits) {
  const flipped = bits.map((bit) => (bit ? 0 : 1));
  const result = [...flipped];
  for (let index = WIDTH - 1; index >= 0; index -= 1) {
    if (result[index] === 0) {
      result[index] = 1;
      break;
    }
    result[index] = 0;
  }
  return { flipped, result };
}

export function NumberRepresentation() {
  const [bits, setBits] = useState([0, 0, 1, 0, 1, 0, 1, 0]); // 42
  const [showTrick, setShowTrick] = useState(false);

  const signed = signedValue(bits);
  const unsigned = unsignedValue(bits);
  const { flipped, result } = negate(bits);

  const toggle = (index) => {
    setBits((current) => current.map((bit, position) => (position === index ? (bit ? 0 : 1) : bit)));
  };

  return (
    <article className="lesson">
      <header>
        <p className="eyebrow">Lesson</p>
        <h1>Number representation</h1>
        <p className="lede">
          Click any bit. The top one is worth <strong>-128</strong>, not "minus", and that single
          fact explains the whole representation.
        </p>
      </header>

      <div className="bits">
        {bits.map((bit, index) => (
          <button
            key={index}
            type="button"
            className={`bit ${bit ? 'one' : 'zero'} ${index === 0 ? 'signBit' : ''}`}
            onClick={() => toggle(index)}
            aria-label={`Bit ${WIDTH - 1 - index}, weight ${WEIGHTS[index]}, currently ${bit}`}
          >
            <span className="bitValue">{bit}</span>
            <span className="bitWeight">{WEIGHTS[index]}</span>
          </button>
        ))}
      </div>

      <div className="readout">
        <div>
          <span className="readoutLabel">as signed (two's complement)</span>
          <span className="readoutValue">{signed}</span>
        </div>
        <div>
          <span className="readoutLabel">as unsigned</span>
          <span className="readoutValue">{unsigned}</span>
        </div>
        <div>
          <span className="readoutLabel">hex</span>
          <span className="readoutValue">
            0x{unsigned.toString(16).toUpperCase().padStart(2, '0')}
          </span>
        </div>
      </div>

      {signed !== unsigned && (
        <p className="notice">
          The same eight bits read as {unsigned} unsigned and {signed} signed. Nothing about the
          bits says which is meant — that is the program's business, and getting it wrong is the
          bug behind half of all sign-extension questions.
        </p>
      )}

      <div className="controls">
        {PRESETS.map((preset) => (
          <button key={preset.label} type="button" onClick={() => setBits(preset.bits)}>
            {preset.label}
          </button>
        ))}
        <button type="button" className="primary" onClick={() => setBits(result)}>
          Negate
        </button>
        <button type="button" onClick={() => setShowTrick((value) => !value)}>
          {showTrick ? 'Hide the trick' : 'Show me the trick'}
        </button>
      </div>

      {showTrick && (
        <section className="trick">
          <h2>Flip the bits and add one</h2>
          <table>
            <tbody>
              <tr>
                <th>start</th>
                <td className="mono">{bits.join('')}</td>
                <td className="mono">{signed}</td>
              </tr>
              <tr>
                <th>flip every bit</th>
                <td className="mono">{flipped.join('')}</td>
                <td className="mono">{signedValue(flipped)}</td>
              </tr>
              <tr>
                <th>add one</th>
                <td className="mono">{result.join('')}</td>
                <td className="mono">{signedValue(result)}</td>
              </tr>
            </tbody>
          </table>
          <p>
            That is the whole of subtraction. <code>a - b</code> is computed as{' '}
            <code>a + (-b)</code>, and negating costs a row of inverters and a carry-in of one —
            so one adder does both jobs and no subtractor is built.
          </p>
          {signed === -128 && (
            <p className="notice">
              You have found the odd one out: negating -128 gives -128 back, because +128 does not
              fit in eight signed bits. The range is lopsided for exactly this reason.
            </p>
          )}
        </section>
      )}

      <footer className="lessonLinks">
        <Link to={`/quiz/${TOPIC_ID}`}>Practise this topic →</Link>
        <Link to="/cheat-sheet">Cheat sheet</Link>
        <NextLesson />
      </footer>
    </article>
  );
}

export default NumberRepresentation;
