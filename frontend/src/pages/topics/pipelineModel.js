// The pipeline model behind the Pipelining lesson. No React here, so it can be tested on
// its own (see pipelineModel.test.js).
//
// The model is a classic in-order pipeline: one instruction enters per cycle, an
// instruction that has to wait stays in the stage it is in, and everything behind it
// waits too. That last part is where the bubble comes from - the stage in front of the
// waiting instruction has nobody to work on.
//
// A data hazard is resolved in one of two ways:
//
//   without forwarding  the consumer may not LEAVE its register-read stage until the
//                       producer has reached write-back. Write-back writes in the first
//                       half of the cycle and read happens in the second half, so reading
//                       in the same cycle as WB is allowed - the usual textbook rule.
//
//   with forwarding     the consumer may not ENTER its execute stage until the cycle after
//                       the producer's result exists: end of EX for ALU instructions, end
//                       of MEM for loads. A load followed by a use therefore still costs
//                       one stall in the five-stage pipeline, forwarding or not.

// --- stage sets ------------------------------------------------------------------------
//
// read      index of the stage that reads the register file
// exec      index of the stage that computes (and where forwarded values arrive)
// loadReady index of the stage at whose end a load's value exists
// wb        index of the stage that writes the register file

export const STAGE_SETS = {
  three: {
    label: '3 stages',
    stages: [
      { id: 'IF', name: 'Fetch' },
      { id: 'EX', name: 'Read registers, execute, access memory' },
      { id: 'WB', name: 'Write back' },
    ],
    read: 1,
    exec: 1,
    loadReady: 1,
    wb: 2,
    note: 'Reading and executing share a stage, so the producer is always far enough ahead: this short pipeline never stalls on data - and never overlaps much either.',
  },
  four: {
    label: '4 stages',
    stages: [
      { id: 'IF', name: 'Fetch' },
      { id: 'ID', name: 'Decode, read registers' },
      { id: 'EX', name: 'Execute, access memory' },
      { id: 'WB', name: 'Write back' },
    ],
    read: 1,
    exec: 2,
    loadReady: 2,
    wb: 3,
    note: 'Memory access is folded into EX, so a load is ready as early as an ALU result.',
  },
  five: {
    label: '5 stages (classic RISC)',
    stages: [
      { id: 'IF', name: 'Fetch' },
      { id: 'ID', name: 'Decode, read registers' },
      { id: 'EX', name: 'Execute (ALU)' },
      { id: 'MEM', name: 'Memory access' },
      { id: 'WB', name: 'Write back' },
    ],
    read: 1,
    exec: 2,
    loadReady: 3,
    wb: 4,
    note: 'The textbook pipeline. A load has its value only after MEM, one stage later than an ALU result.',
  },
  six: {
    label: '6 stages (Stallings)',
    stages: [
      { id: 'FI', name: 'Fetch instruction' },
      { id: 'DI', name: 'Decode instruction' },
      { id: 'CO', name: 'Calculate operands' },
      { id: 'FO', name: 'Fetch operands' },
      { id: 'EI', name: 'Execute instruction' },
      { id: 'WO', name: 'Write operand' },
    ],
    read: 3,
    exec: 4,
    loadReady: 3,
    wb: 5,
    note: "Stallings' six stages. Memory operands are fetched in FO, before EI - so a load-use pair needs no stall once forwarding is on.",
  },
};

// --- programs --------------------------------------------------------------------------
//
// op: 'alu' | 'load' | 'store'. `dest` is the register written (none for a store),
// `srcs` the registers read.

export const PROGRAMS = {
  independent: {
    label: 'No dependencies',
    instructions: [
      { text: 'ADD R1, R2, R3', op: 'alu', dest: 'R1', srcs: ['R2', 'R3'] },
      { text: 'SUB R4, R5, R6', op: 'alu', dest: 'R4', srcs: ['R5', 'R6'] },
      { text: 'AND R7, R8, R9', op: 'alu', dest: 'R7', srcs: ['R8', 'R9'] },
      { text: 'OR  R10, R11, R12', op: 'alu', dest: 'R10', srcs: ['R11', 'R12'] },
      { text: 'XOR R13, R14, R15', op: 'alu', dest: 'R13', srcs: ['R14', 'R15'] },
    ],
  },
  chain: {
    label: 'ALU chain (data hazards)',
    instructions: [
      { text: 'ADD R1, R2, R3', op: 'alu', dest: 'R1', srcs: ['R2', 'R3'] },
      { text: 'SUB R4, R1, R5', op: 'alu', dest: 'R4', srcs: ['R1', 'R5'] },
      { text: 'AND R6, R1, R7', op: 'alu', dest: 'R6', srcs: ['R1', 'R7'] },
      { text: 'OR  R8, R4, R6', op: 'alu', dest: 'R8', srcs: ['R4', 'R6'] },
      { text: 'XOR R9, R10, R11', op: 'alu', dest: 'R9', srcs: ['R10', 'R11'] },
    ],
  },
  loadUse: {
    label: 'Load, then use',
    instructions: [
      { text: 'LOAD  R1, 0(R2)', op: 'load', dest: 'R1', srcs: ['R2'] },
      { text: 'ADD   R3, R1, R4', op: 'alu', dest: 'R3', srcs: ['R1', 'R4'] },
      { text: 'SUB   R5, R3, R6', op: 'alu', dest: 'R5', srcs: ['R3', 'R6'] },
      { text: 'STORE R5, 4(R2)', op: 'store', dest: null, srcs: ['R5', 'R2'] },
    ],
  },
};

/** Short name for an instruction: its mnemonic. */
export function mnemonic(instruction) {
  return instruction.text.split(/\s+/)[0];
}

/**
 * For each instruction, which earlier instruction produces each register it reads.
 * Only the most recent writer counts - an older value has been overwritten.
 */
export function findDependencies(instructions) {
  return instructions.map((instruction, j) =>
    instruction.srcs
      .map((reg) => {
        for (let i = j - 1; i >= 0; i -= 1) {
          if (instructions[i].dest === reg) return { reg, producer: i };
        }
        return null;
      })
      .filter(Boolean),
  );
}

/**
 * Works out the cycle in which every instruction enters every stage.
 *
 * Returns:
 *   enter[j][s]   1-based cycle in which instruction j enters stage s
 *   cause[j][s]   why entering s was delayed past the natural cycle, or null:
 *                   { kind: 'data', reg, producer, ready }   waiting for an operand
 *                   { kind: 'blocked', by }                  the instruction ahead is stuck
 *   forwards      [{ consumer, producer, reg, cycle }] forwarded operands (forwarding on)
 *   totalCycles, idealCycles, unpipelinedCycles, stallCycles
 */
export function schedule(instructions, set, forwarding) {
  const k = set.stages.length;
  const n = instructions.length;
  const deps = findDependencies(instructions);
  const last = k - 1;

  const enter = [];
  const cause = [];

  for (let j = 0; j < n; j += 1) {
    enter.push(new Array(k).fill(0));
    cause.push(new Array(k).fill(null));

    for (let s = 0; s < k; s += 1) {
      // Naturally: the cycle after this instruction entered the previous stage, or for
      // fetch, the cycle after the previous instruction was fetched.
      let natural;
      if (s > 0) natural = enter[j][s - 1] + 1;
      else natural = j === 0 ? 1 : enter[j - 1][0] + 1;

      // The stage must be free: the instruction ahead has to have moved on.
      let blocked = 0;
      if (j > 0) blocked = s < last ? enter[j - 1][s + 1] : enter[j - 1][s] + 1;

      // Data hazards that bind on entering this stage.
      let data = 0;
      let dataCause = null;
      for (const { reg, producer } of deps[j]) {
        const p = instructions[producer];
        let earliest = 0;

        if (!forwarding && s === set.read + 1) {
          // May leave the read stage only once the producer is in write-back.
          earliest = enter[producer][set.wb] + 1;
        } else if (forwarding && s === set.exec) {
          const readyStage = p.op === 'load' ? set.loadReady : set.exec;
          earliest = enter[producer][readyStage] + 1;
        }

        if (earliest > data) {
          data = earliest;
          dataCause = { kind: 'data', reg, producer, ready: earliest - 1 };
        }
      }

      const at = Math.max(natural, blocked, data);
      enter[j][s] = at;

      if (at > natural) {
        // A data wait that is no longer than the queue it is in is not the reason this
        // instruction is late; the instruction ahead is.
        cause[j][s] = data > blocked ? dataCause : { kind: 'blocked', by: j - 1 };
      }
    }
  }

  // Which operands travelled over a forwarding path rather than through the register
  // file: those the register file could not have supplied by the last read cycle.
  const forwards = [];
  if (forwarding) {
    for (let j = 0; j < n; j += 1) {
      const lastReadCycle = enter[j][set.read + 1] - 1;
      for (const { reg, producer } of deps[j]) {
        if (lastReadCycle < enter[producer][set.wb]) {
          forwards.push({ consumer: j, producer, reg, cycle: enter[j][set.exec] });
        }
      }
    }
  }

  const totalCycles = n === 0 ? 0 : enter[n - 1][last];
  const idealCycles = n === 0 ? 0 : k + n - 1;

  return {
    enter,
    cause,
    forwards,
    deps,
    totalCycles,
    idealCycles,
    unpipelinedCycles: n * k,
    stallCycles: totalCycles - idealCycles,
  };
}

/** The cycle in which instruction j leaves stage s (exclusive). */
export function leaveCycle(result, j, s) {
  const { enter } = result;
  const k = enter[j].length;
  return s < k - 1 ? enter[j][s + 1] : enter[j][s] + 1;
}

/**
 * What instruction j is doing in cycle c:
 *   null                          not in the pipeline
 *   { stage, stalled: false }     doing the work of `stage`
 *   { stage, stalled: true }      sitting in `stage`, waiting
 */
export function stateAt(result, j, c) {
  const k = result.enter[j].length;
  for (let s = 0; s < k; s += 1) {
    if (c >= result.enter[j][s] && c < leaveCycle(result, j, s)) {
      return { stage: s, stalled: c > result.enter[j][s] };
    }
  }
  return null;
}

/**
 * What each stage holds in cycle c: an instruction index, 'bubble' (a gap inside the
 * stream, caused by a stall), or null (pipeline filling or draining).
 */
export function stagesAt(result, c) {
  const { enter } = result;
  const n = enter.length;
  if (n === 0) return [];
  const k = enter[0].length;

  return Array.from({ length: k }, (_, s) => {
    for (let j = 0; j < n; j += 1) {
      if (c >= enter[j][s] && c < leaveCycle(result, j, s)) {
        return { instruction: j, stalled: c > enter[j][s] };
      }
    }
    const inStream = c >= enter[0][s] && c < enter[n - 1][s];
    return inStream ? 'bubble' : null;
  });
}
