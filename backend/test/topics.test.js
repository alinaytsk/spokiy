// The static-content routes, run against the real Express app on a random port.
//
// These need no AWS: topics, cheat sheets and quizzes are read from disk. The checks that
// matter most are the ones a student could exploit or trip over - the quiz must not leak
// its answer key, and every question in the bank must be gradable.

import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

import { app } from '../src/index.js';
import { topics } from '../src/data/topics.js';

let server;
let base;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

const get = (path) => fetch(base + path);
const post = (path, body) =>
  fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

const bankDir = new URL('../src/data/quizBank/', import.meta.url);
const banks = readdirSync(bankDir).map((file) => JSON.parse(readFileSync(new URL(file, bankDir), 'utf8')));

describe('quiz bank', () => {
  for (const bank of banks) {
    test(`${bank.topicId}: every question is well formed`, () => {
      assert.ok(topics.some((topic) => topic.id === bank.topicId), 'bank for an unknown topic');
      const ids = bank.questions.map((question) => question.id);
      assert.equal(new Set(ids).size, ids.length, 'duplicate question ids');

      for (const question of bank.questions) {
        assert.ok(question.prompt, `${question.id}: no prompt`);
        assert.ok(question.options.length >= 2, `${question.id}: too few options`);
        assert.ok(
          Number.isInteger(question.correctIndex) &&
            question.correctIndex >= 0 &&
            question.correctIndex < question.options.length,
          `${question.id}: correctIndex out of range`,
        );
        assert.ok(question.explanation, `${question.id}: no explanation`);
      }
    });
  }
});

describe('GET /topics/:id/quiz', () => {
  test('sends questions without answers', async () => {
    const response = await get('/topics/pipelining/quiz');
    assert.equal(response.status, 200);
    const { questions } = await response.json();
    assert.ok(questions.length > 0);
    for (const question of questions) {
      assert.equal(question.correctIndex, undefined);
      assert.equal(question.explanation, undefined);
    }
  });

  test('404 for an unknown topic', async () => {
    assert.equal((await get('/topics/nope/quiz')).status, 404);
  });
});

describe('POST /topics/:id/quiz/grade', () => {
  const bank = banks.find((item) => item.topicId === 'pipelining');
  const [first, ...rest] = bank.questions;

  test('checking one question reveals only that answer', async () => {
    const response = await post('/topics/pipelining/quiz/grade', {
      answers: [{ questionId: first.id, selectedIndex: first.correctIndex }],
    });
    assert.equal(response.status, 200);
    const { results, score, total } = await response.json();

    const mine = results.find((result) => result.questionId === first.id);
    assert.equal(mine.correct, true);
    assert.equal(mine.correctIndex, first.correctIndex);
    assert.ok(mine.explanation);

    for (const other of results.filter((result) => result.questionId !== first.id)) {
      assert.equal(other.correctIndex, undefined, `${other.questionId} leaked its answer`);
      assert.equal(other.explanation, undefined, `${other.questionId} leaked its explanation`);
      assert.equal(other.correct, false);
    }
    assert.equal(score, 1);
    assert.equal(total, bank.questions.length);
  });

  test('a full set of right answers scores 100%', async () => {
    const answers = bank.questions.map((question) => ({ questionId: question.id, selectedIndex: question.correctIndex }));
    const { percentage } = await (await post('/topics/pipelining/quiz/grade', { answers })).json();
    assert.equal(percentage, 100);
  });

  test('a wrong answer is graded wrong and still explained', async () => {
    const wrong = (rest[0].correctIndex + 1) % rest[0].options.length;
    const { results } = await (
      await post('/topics/pipelining/quiz/grade', { answers: [{ questionId: rest[0].id, selectedIndex: wrong }] })
    ).json();
    const mine = results.find((result) => result.questionId === rest[0].id);
    assert.equal(mine.correct, false);
    assert.equal(mine.correctIndex, rest[0].correctIndex);
    assert.ok(mine.explanation);
  });

  test('400 when answers is not a list', async () => {
    assert.equal((await post('/topics/pipelining/quiz/grade', { answers: 'A' })).status, 400);
  });
});

describe('GET /topics and cheat sheets', () => {
  test('lists every topic', async () => {
    const body = await (await get('/topics')).json();
    assert.equal(body.topics.length, topics.length);
  });

  test('every topic has a cheat sheet', async () => {
    for (const topic of topics) {
      const response = await get(`/topics/${topic.id}/cheat-sheet`);
      assert.equal(response.status, 200, topic.id);
      const sheet = await response.json();
      assert.ok(sheet.sections?.length > 0, `${topic.id}: empty sheet`);
    }
  });
});
