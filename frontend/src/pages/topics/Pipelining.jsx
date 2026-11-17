// Lesson: pipelining, with data hazards.
//
// Three knobs - how many stages, which program, forwarding on or off - and one clock. The
// reader steps through cycles and watches two views of the same thing: the pipeline as it
// is right now (which instruction sits in which stage, where the bubble is), and the
// timing diagram that the quiz draws (instructions down, cycles across).
//
// Every number on the page comes from schedule() in pipelineModel.js, so changing a knob
// re-derives everything rather than switching between pre-drawn pictures. That is the
// point of the lesson: "why does forwarding not fix the load-use stall?" is answered by
// turning forwarding on and seeing the one stall that is left.

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  PROGRAMS,
  STAGE_SETS,
  mnemonic,
  schedule,
  stagesAt,
  stateAt,
} from './pipelineModel.js';

const TOPIC_ID = 'pipelining';

const SPEEDS = [
  { label: 'Slow', ms: 2200 },
  { label: 'Normal', ms: 1300 },
  { label: 'Fast', ms: 650 },
];

// What happened in cycle c, in sentences. Stalls first: they are what the lesson is about.
function describeCycle(c, result, instructions, set, forwarding) {
  const name = (j) => mnemonic(instructions[j]);
  const stageId = (s) => set.stages[s].id;
  const lines = [];

  instructions.forEach((_, j) => {
    const state = stateAt(result, j, c);
    if (!state?.stalled) return;

    const why = result.cause[j][state.stage + 1];
    if (why?.kind === 'data') {
      const producer = name(why.producer);
      lines.push(
        forwarding
          ? `${name(j)} waits in ${stageId(state.stage)}: it needs ${why.reg}, which ${producer} only produces at the end of cycle ${why.ready}. Forwarding can deliver it from then — not before.`
          : `${name(j)} waits in ${stageId(state.stage)}: it needs ${why.reg}, and ${producer} writes ${why.reg} back in cycle ${why.ready}. Without forwarding, the register file is the only way to get it.`,
      );
    } else if (why?.kind === 'blocked') {
      lines.push(
        `${name(j)} is stuck in ${stageId(state.stage)} behind ${name(why.by)}: an in-order pipeline cannot let it overtake.`,
      );
    }
  });

  for (const f of result.forwards) {
    if (f.cycle === c) {
      lines.push(
        `${f.reg} is forwarded from ${name(f.producer)} straight into ${name(f.consumer)}'s ${stageId(set.exec)}, without waiting for write-back.`,
      );
    }
  }

  const stages = stagesAt(result, c);
  if (stages.includes('bubble')) {
    const where = stages
      .map((slot, s) => (slot === 'bubble' ? stageId(s) : null))
      .filter(Boolean)
      .join(', ');
    lines.push(`Bubble in ${where}: that stage does nothing useful this cycle.`);
  }

  if (lines.length === 0) {
    const busy = stages.filter((slot) => slot && slot !== 'bubble').length;
    if (busy === set.stages.length) {
      lines.push(
        `Every stage holds a different instruction: ${busy} in flight, one finishing per cycle.`,
      );
    } else if (c < set.stages.length) {
      lines.push('The pipeline is filling: the first instruction has not reached the end yet.');
    } else {
      lines.push('The pipeline is draining: no more instructions are being fetched.');
    }
  }

  return lines;
}

export function Pipelining() {
  const [setKey, setSetKey] = useState('five');
  const [programKey, setProgramKey] = useState('chain');
  const [forwarding, setForwarding] = useState(false);
  const [cycle, setCycle] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const set = STAGE_SETS[setKey];
  const { instructions } = PROGRAMS[programKey];

  const result = useMemo(
    () => schedule(instructions, set, forwarding),
    [instructions, set, forwarding],
  );

  const total = result.totalCycles;
  const current = Math.min(cycle, total);
  const isLast = current === total;

  // Any knob restarts the clock: the old cycle number means nothing in the new schedule.
  function reconfigure(apply) {
    apply();
    setCycle(1);
    setPlaying(false);
  }

  useEffect(() => {
    if (!playing) return undefined;
    const timer = setTimeout(() => {
      if (isLast) setPlaying(false);
      else setCycle((value) => value + 1);
    }, SPEEDS[speed].ms);
    return () => clearTimeout(timer);
  }, [playing, current, speed, isLast]);

  const slots = stagesAt(result, current);
  const lines = describeCycle(current, result, instructions, set, forwarding);
  const cycles = Array.from({ length: total }, (_, index) => index + 1);
  const speedup = result.unpipelinedCycles / total;

  return (
    <article className="lesson">
      <header>
        <p className="eyebrow">Lesson</p>
        <h1>Pipelining, with hazards</h1>
        <p className="lede">
          Pipelining overlaps instructions the way a laundry overlaps loads: while one is
          executing, the next is being decoded and the one after that fetched. It makes
          throughput better, not any single instruction faster — until one instruction needs a
          result that is not there yet.
        </p>
      </header>

      {/* --- knobs ---------------------------------------------------------------------- */}
      <div className="pipeConfig">
        <div>
          <label htmlFor="stages">Stages</label>
          <select
            id="stages"
            value={setKey}
            onChange={(event) => reconfigure(() => setSetKey(event.target.value))}
          >
            {Object.entries(STAGE_SETS).map(([key, option]) => (
              <option key={key} value={key}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="program">Program</label>
          <select
            id="program"
            value={programKey}
            onChange={(event) => reconfigure(() => setProgramKey(event.target.value))}
          >
            {Object.entries(PROGRAMS).map(([key, option]) => (
              <option key={key} value={key}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <span className="configLabel" id="forwardingLabel">
            Forwarding
          </span>
          <button
            type="button"
            className={forwarding ? 'toggle on' : 'toggle'}
            aria-pressed={forwarding}
            aria-labelledby="forwardingLabel"
            onClick={() => reconfigure(() => setForwarding((value) => !value))}
          >
            {forwarding ? 'On' : 'Off'}
          </button>
        </div>
      </div>

      <p className="muted">{set.note}</p>

      {/* --- the program ---------------------------------------------------------------- */}
      <ol className="program">
        {instructions.map((instruction, j) => {
          const deps = result.deps[j];
          return (
            <li key={instruction.text}>
              <code>{instruction.text}</code>
              {deps.length > 0 && (
                <span className="muted">
                  {' '}
                  needs{' '}
                  {deps
                    .map((d) => `${d.reg} from ${mnemonic(instructions[d.producer])}`)
                    .join(', ')}
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {/* --- the pipeline right now ----------------------------------------------------- */}
      <div className="stageRow" aria-label={`Pipeline in cycle ${current}`}>
        {set.stages.map((stage, s) => {
          const slot = slots[s];
          let content = <span className="muted">—</span>;
          let state = 'empty';

          if (slot === 'bubble') {
            content = <span>bubble</span>;
            state = 'bubble';
          } else if (slot) {
            content = <code>{mnemonic(instructions[slot.instruction])}</code>;
            state = slot.stalled ? 'stalled' : 'busy';
          }

          return (
            <div key={stage.id} className={`stageBox ${state}`} title={stage.name}>
              <span className="stageId">{stage.id}</span>
              <span className="stageName">{stage.name}</span>
              <span className="stageContent">{content}</span>
            </div>
          );
        })}
      </div>

      <div className="stepBox">
        <p className="stepCount">
          Cycle {current} of {total}
        </p>
        {lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>

      <div className="controls">
        <button
          type="button"
          onClick={() => {
            setCycle(1);
            setPlaying(false);
          }}
          disabled={current === 1 && !playing}
        >
          Reset
        </button>
        <button
          type="button"
          onClick={() => setCycle((value) => Math.max(1, value - 1))}
          disabled={current === 1}
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => setCycle((value) => Math.min(total, value + 1))}
          disabled={isLast}
        >
          Next cycle
        </button>
        <button
          type="button"
          className="primary"
          onClick={() => {
            if (isLast) setCycle(1);
            setPlaying((value) => !value);
          }}
        >
          {playing ? 'Pause' : 'Play'}
        </button>

        <label htmlFor="speed">Speed</label>
        <select id="speed" value={speed} onChange={(event) => setSpeed(Number(event.target.value))}>
          {SPEEDS.map((option, index) => (
            <option key={option.label} value={index}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* --- the timing diagram --------------------------------------------------------- */}
      <h2 className="sectionTitle">Timing diagram</h2>
      <p className="muted">
        Instructions down, clock cycles across. Click a cycle to jump to it. Hatched cells are
        an instruction waiting where it is.
      </p>

      <div className="timingWrap">
        <table className="timing">
          <thead>
            <tr>
              <th scope="col">Instruction</th>
              {cycles.map((c) => (
                <th key={c} scope="col" className={c === current ? 'now' : ''}>
                  <button type="button" className="cycleButton" onClick={() => setCycle(c)}>
                    {c}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {instructions.map((instruction, j) => (
              <tr key={instruction.text}>
                <th scope="row">
                  <code>{mnemonic(instruction)}</code>
                </th>
                {cycles.map((c) => {
                  const state = stateAt(result, j, c);
                  const classes = [];
                  if (c === current) classes.push('now');
                  if (c > current) classes.push('future');
                  if (state) classes.push(state.stalled ? 'stall' : 'work');
                  return (
                    <td key={c} className={classes.join(' ')}>
                      {state ? set.stages[state.stage].id : ''}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* --- the numbers ---------------------------------------------------------------- */}
      <div className="readout">
        <div>
          <span className="readoutLabel">Cycles, pipelined</span>
          <span className="readoutValue">{total}</span>
        </div>
        <div>
          <span className="readoutLabel">Ideal (k + n − 1)</span>
          <span className="readoutValue">{result.idealCycles}</span>
        </div>
        <div>
          <span className="readoutLabel">Stall cycles</span>
          <span className="readoutValue">{result.stallCycles}</span>
        </div>
        <div>
          <span className="readoutLabel">Speedup vs n · k = {result.unpipelinedCycles}</span>
          <span className="readoutValue">×{speedup.toFixed(2)}</span>
        </div>
      </div>

      <div className="trick">
        <h2>Try this</h2>
        <ul>
          <li>
            <strong>ALU chain, forwarding off:</strong> SUB sits in ID for two extra cycles and
            a bubble rolls down the pipe behind it. Turn forwarding on — both stalls vanish.
          </li>
          <li>
            <strong>Load, then use, 5 stages:</strong> with forwarding on there is still one
            stall. The loaded value only exists after MEM; the ALU wanted it a cycle earlier.
          </li>
          <li>
            <strong>Switch to 3 stages:</strong> no stalls at all — but the speedup is lower
            too. More stages mean more overlap and more chances to collide.
          </li>
        </ul>
      </div>

      <footer className="lessonLinks">
        <Link to={`/quiz/${TOPIC_ID}`}>Practise this topic →</Link>
        <Link to="/cheat-sheet">Cheat sheet</Link>
      </footer>
    </article>
  );
}

export default Pipelining;
