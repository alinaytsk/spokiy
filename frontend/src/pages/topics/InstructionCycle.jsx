// Lesson: the instruction cycle.
//
// One concrete instruction is traced rather than described in the abstract: LOAD 0x40,
// sitting at address 0x10, which loads the value 0x2A into the accumulator. Eight
// micro-steps, grouped into the four phases.
//
// Tracing a real instruction is the point. "Fetch, decode, execute" is easy to recite and
// tells you nothing about why the PC is already pointing elsewhere by step 3 - which is
// exactly what the quiz asks.
//
// Plain SVG and state, no animation library: every visual change is driven by `step`.

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const TOPIC_ID = 'instruction-cycle';

// Each step says which phase it belongs to, what happens, and what the registers hold
// *after* it has run. The SVG highlights whatever is named in `active`.
const STEPS = [
  {
    phase: 'Fetch',
    title: 'PC → MAR',
    detail:
      'The address of the next instruction is copied from the program counter into the memory address register, which drives the address bus.',
    active: ['pc', 'mar', 'addressBus'],
    registers: { pc: '0x10', mar: '0x10', mdr: '--', ir: '--', ac: '0x00' },
  },
  {
    phase: 'Fetch',
    title: 'Memory read → MDR',
    detail:
      'Memory returns the contents of address 0x10 on the data bus, and it lands in the memory data register.',
    active: ['memory', 'dataBus', 'mdr'],
    registers: { pc: '0x10', mar: '0x10', mdr: 'LOAD 0x40', ir: '--', ac: '0x00' },
  },
  {
    phase: 'Fetch',
    title: 'MDR → IR, and PC + 1',
    detail:
      'The instruction moves into the instruction register, and the program counter is incremented — now, during fetch, long before anyone knows whether this was a jump.',
    active: ['mdr', 'ir', 'pc'],
    registers: { pc: '0x11', mar: '0x10', mdr: 'LOAD 0x40', ir: 'LOAD 0x40', ac: '0x00' },
  },
  {
    phase: 'Decode',
    title: 'Control unit reads the opcode',
    detail:
      'The bits in the IR are split into an operation (LOAD) and an operand (0x40). The control unit raises the signals the rest of the cycle needs. Nothing moves yet.',
    active: ['ir', 'control'],
    registers: { pc: '0x11', mar: '0x10', mdr: 'LOAD 0x40', ir: 'LOAD 0x40', ac: '0x00' },
  },
  {
    phase: 'Execute',
    title: 'Operand → MAR',
    detail:
      'LOAD needs the value stored at 0x40, so the operand becomes the next address to read.',
    active: ['ir', 'mar', 'addressBus'],
    registers: { pc: '0x11', mar: '0x40', mdr: 'LOAD 0x40', ir: 'LOAD 0x40', ac: '0x00' },
  },
  {
    phase: 'Execute',
    title: 'Memory read → MDR',
    detail: 'Memory returns the contents of 0x40: the value 0x2A.',
    active: ['memory', 'dataBus', 'mdr'],
    registers: { pc: '0x11', mar: '0x40', mdr: '0x2A', ir: 'LOAD 0x40', ac: '0x00' },
  },
  {
    phase: 'Execute',
    title: 'MDR → AC',
    detail: 'The value reaches the accumulator. The instruction has now done its work.',
    active: ['mdr', 'ac'],
    registers: { pc: '0x11', mar: '0x40', mdr: '0x2A', ir: 'LOAD 0x40', ac: '0x2A' },
  },
  {
    phase: 'Interrupt check',
    title: 'Any interrupt pending?',
    detail:
      'Only now — never mid-execute. If a device had raised a request, the PC and the flags would be saved and the CPU would jump to the handler. Nothing is pending, so the cycle starts again at the address in the PC: 0x11.',
    active: ['control', 'pc', 'interrupt'],
    registers: { pc: '0x11', mar: '0x40', mdr: '0x2A', ir: 'LOAD 0x40', ac: '0x2A' },
  },
];

const PHASES = ['Fetch', 'Decode', 'Execute', 'Interrupt check'];

const SPEEDS = [
  { label: 'Slow', ms: 2600 },
  { label: 'Normal', ms: 1600 },
  { label: 'Fast', ms: 800 },
];

export function InstructionCycle() {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const next = useCallback(() => {
    setStep((value) => (value + 1) % STEPS.length);
  }, []);

  // Autoplay. Stops itself at the end rather than looping for ever, so the lesson has a
  // finish rather than spinning behind the reader.
  useEffect(() => {
    if (!playing) return undefined;

    const timer = setTimeout(() => {
      if (isLast) {
        setPlaying(false);
      } else {
        setStep((value) => value + 1);
      }
    }, SPEEDS[speed].ms);

    return () => clearTimeout(timer);
  }, [playing, step, speed, isLast]);

  const on = (name) => (current.active.includes(name) ? 'on' : '');

  return (
    <article className="lesson">
      <header>
        <p className="eyebrow">Lesson</p>
        <h1>The instruction cycle</h1>
        <p className="lede">
          Watch one instruction — <code>LOAD 0x40</code>, stored at address <code>0x10</code> —
          travel through the processor, one micro-step at a time.
        </p>
      </header>

      <ol className="phases">
        {PHASES.map((phase) => (
          <li key={phase} className={current.phase === phase ? 'on' : ''}>
            {phase}
          </li>
        ))}
      </ol>

      <svg className="diagram" viewBox="0 0 720 330" role="img"
           aria-label={`Step ${step + 1}: ${current.title}`}>
        {/* CPU */}
        <rect x="20" y="30" width="380" height="270" rx="10" className="box cpu" />
        <text x="36" y="54" className="label">CPU</text>

        {/* registers */}
        <g className={`reg ${on('pc')}`}>
          <rect x="44" y="72" width="150" height="46" rx="6" />
          <text x="56" y="92" className="regName">PC</text>
          <text x="56" y="110" className="regValue">{current.registers.pc}</text>
        </g>
        <g className={`reg ${on('ir')}`}>
          <rect x="216" y="72" width="160" height="46" rx="6" />
          <text x="228" y="92" className="regName">IR</text>
          <text x="228" y="110" className="regValue">{current.registers.ir}</text>
        </g>
        <g className={`reg ${on('mar')}`}>
          <rect x="44" y="134" width="150" height="46" rx="6" />
          <text x="56" y="154" className="regName">MAR</text>
          <text x="56" y="172" className="regValue">{current.registers.mar}</text>
        </g>
        <g className={`reg ${on('mdr')}`}>
          <rect x="216" y="134" width="160" height="46" rx="6" />
          <text x="228" y="154" className="regName">MDR</text>
          <text x="228" y="172" className="regValue">{current.registers.mdr}</text>
        </g>
        <g className={`reg ${on('ac')}`}>
          <rect x="44" y="196" width="150" height="46" rx="6" />
          <text x="56" y="216" className="regName">AC</text>
          <text x="56" y="234" className="regValue">{current.registers.ac}</text>
        </g>
        <g className={`reg ${on('control')}`}>
          <rect x="216" y="196" width="160" height="46" rx="6" />
          <text x="228" y="216" className="regName">Control unit</text>
          <text x="228" y="234" className="regValue">
            {current.phase === 'Decode' ? 'decoding' : 'idle'}
          </text>
        </g>

        {/* memory */}
        <rect x="560" y="72" width="140" height="170" rx="10" className="box memory" />
        <text x="576" y="96" className="label">Memory</text>
        <g className={`cell ${on('memory')}`}>
          <rect x="576" y="110" width="108" height="34" rx="4" />
          <text x="586" y="132" className="cellText">0x10: LOAD 0x40</text>
        </g>
        <g className={`cell ${on('memory')}`}>
          <rect x="576" y="156" width="108" height="34" rx="4" />
          <text x="586" y="178" className="cellText">0x40: 0x2A</text>
        </g>

        {/* buses */}
        <g className={`bus ${on('addressBus')}`}>
          <line x1="400" y1="130" x2="560" y2="130" />
          <text x="430" y="122" className="busLabel">address bus</text>
        </g>
        <g className={`bus ${on('dataBus')}`}>
          <line x1="560" y1="186" x2="400" y2="186" />
          <text x="438" y="178" className="busLabel">data bus</text>
        </g>

        {/* interrupt line */}
        <g className={`bus interrupt ${on('interrupt')}`}>
          <line x1="630" y1="242" x2="630" y2="286" />
          <line x1="630" y1="286" x2="210" y2="286" />
          <text x="430" y="304" className="busLabel">interrupt request line</text>
        </g>
      </svg>

      <div className="stepBox">
        <p className="stepCount">
          Step {step + 1} of {STEPS.length} · {current.phase}
        </p>
        <h2>{current.title}</h2>
        <p>{current.detail}</p>
      </div>

      <div className="controls">
        <button type="button" onClick={() => setStep(0)} disabled={step === 0 && !playing}>
          Reset
        </button>
        <button
          type="button"
          onClick={() => setStep((value) => (value - 1 + STEPS.length) % STEPS.length)}
        >
          Back
        </button>
        <button type="button" onClick={next}>
          Next step
        </button>
        <button type="button" className="primary" onClick={() => setPlaying((value) => !value)}>
          {playing ? 'Pause' : 'Play'}
        </button>

        <label htmlFor="speed">Speed</label>
        <select
          id="speed"
          value={speed}
          onChange={(event) => setSpeed(Number(event.target.value))}
        >
          {SPEEDS.map((option, index) => (
            <option key={option.label} value={index}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <footer className="lessonLinks">
        <Link to={`/quiz/${TOPIC_ID}`}>Practise this topic →</Link>
        <Link to="/cheat-sheet">Cheat sheet</Link>
      </footer>
    </article>
  );
}

export default InstructionCycle;
