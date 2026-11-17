// Run with `npm test` in frontend/. Checks the model against the numbers any textbook
// gives for the classic cases, so a change to the scheduling rules cannot quietly make the
// lesson teach something wrong.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { PROGRAMS, STAGE_SETS, schedule, stagesAt, stateAt } from './pipelineModel.js';

const five = STAGE_SETS.five;

test('no dependencies: k + n - 1 cycles, no stalls', () => {
  const r = schedule(PROGRAMS.independent.instructions, five, false);
  assert.equal(r.totalCycles, 5 + 5 - 1);
  assert.equal(r.stallCycles, 0);
  assert.equal(r.unpipelinedCycles, 25);
});

test('ALU result used next, no forwarding: two stalls held in ID', () => {
  const r = schedule(PROGRAMS.chain.instructions, five, false);
  // ADD: IF1 ID2 EX3 MEM4 WB5. SUB reads R1 in the WB cycle (5), so EX is cycle 6.
  assert.deepEqual(r.enter[0], [1, 2, 3, 4, 5]);
  assert.deepEqual(r.enter[1], [2, 3, 6, 7, 8]);
  assert.equal(r.cause[1][2].kind, 'data');
  assert.equal(r.cause[1][2].reg, 'R1');
  // SUB waits in ID during cycles 4 and 5; AND waits behind it in IF.
  assert.deepEqual(stateAt(r, 1, 4), { stage: 1, stalled: true });
  assert.equal(r.cause[2][1].kind, 'blocked');
  // EX is empty while SUB waits: that is the bubble.
  assert.equal(stagesAt(r, 4)[2], 'bubble');
  // docs/user-testing/plan.md, task 3, quotes this number.
  assert.equal(r.totalCycles, 13);
});

test('ALU result used next, with forwarding: no stall', () => {
  const r = schedule(PROGRAMS.chain.instructions, five, true);
  assert.equal(r.stallCycles, 0);
  assert.equal(r.totalCycles, 9);
  assert.ok(r.forwards.some((f) => f.consumer === 1 && f.reg === 'R1'));
});

test('load-use costs exactly one stall even with forwarding', () => {
  const r = schedule(PROGRAMS.loadUse.instructions, five, true);
  // LOAD: IF1 ID2 EX3 MEM4. ADD may enter EX at 5, not 4.
  assert.equal(r.enter[1][2], 5);
  assert.equal(r.stallCycles, 1);
});

test('three-stage pipeline never stalls on data', () => {
  for (const program of Object.values(PROGRAMS)) {
    const r = schedule(program.instructions, STAGE_SETS.three, false);
    assert.equal(r.stallCycles, 0, program.label);
  }
});

test('stalls never make an instruction overtake the one ahead', () => {
  for (const set of Object.values(STAGE_SETS)) {
    for (const program of Object.values(PROGRAMS)) {
      for (const forwarding of [false, true]) {
        const r = schedule(program.instructions, set, forwarding);
        for (let j = 1; j < r.enter.length; j += 1) {
          for (let s = 0; s < set.stages.length; s += 1) {
            assert.ok(r.enter[j][s] > r.enter[j - 1][s]);
          }
        }
      }
    }
  }
});
