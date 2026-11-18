// Topics, cheat sheets and quizzes. All of it is static content read from disk, so none
// of these routes need auth and none of them touch DynamoDB.
//
// The quiz bank is loaded once at startup rather than per request: the files are small,
// they never change while the process runs, and on Lambda this happens during init, which
// is not billed at the same rate as the invocation.

import { Router } from 'express';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { topics, findTopic } from '../data/topics.js';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, '..', 'data');

function loadJson(kind, id) {
  const path = join(dataDir, kind, `${id}.json`);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8'));
}

// id -> { topicId, questions: [...] }, answers included. Never sent out as it is.
const quizzes = new Map();
for (const topic of topics) {
  const bank = loadJson('quizBank', topic.id);
  if (bank) quizzes.set(topic.id, bank);
}

const router = Router();

// GET /topics
router.get('/', (_req, res) => {
  res.json({ topics });
});

// GET /topics/:id/cheat-sheet
router.get('/:id/cheat-sheet', (req, res) => {
  if (!findTopic(req.params.id)) {
    return res.status(404).json({ error: 'Unknown topic' });
  }

  const sheet = loadJson('cheatSheets', req.params.id);
  if (!sheet) {
    return res.status(404).json({ error: 'No cheat sheet for this topic yet' });
  }

  res.json(sheet);
});

// GET /topics/:id/quiz
//
// The correct answer and the explanation are stripped here. Sending them and hiding them
// in the UI would put every answer in the browser's network tab.
router.get('/:id/quiz', (req, res) => {
  if (!findTopic(req.params.id)) {
    return res.status(404).json({ error: 'Unknown topic' });
  }

  const bank = quizzes.get(req.params.id);
  if (!bank) {
    return res.status(404).json({ error: 'No quiz for this topic yet' });
  }

  res.json({
    topicId: bank.topicId,
    questions: bank.questions.map(({ id, prompt, options }) => ({ id, prompt, options })),
  });
});

// POST /topics/:id/quiz/grade
//
// Body: { answers: [{ questionId, selectedIndex }] }
//
// Unanswered questions are graded as wrong rather than rejected, so a student who runs out
// of time still gets a score. Only answered questions come back with the correct answer
// and the explanation: the quiz page checks one question at a time, and returning every
// question's answer on the first "Check" would put the whole key in the network tab.
router.post('/:id/quiz/grade', (req, res) => {
  if (!findTopic(req.params.id)) {
    return res.status(404).json({ error: 'Unknown topic' });
  }

  const bank = quizzes.get(req.params.id);
  if (!bank) {
    return res.status(404).json({ error: 'No quiz for this topic yet' });
  }

  const submitted = req.body?.answers;
  if (!Array.isArray(submitted)) {
    return res.status(400).json({ error: 'Body must be { answers: [{ questionId, selectedIndex }] }' });
  }

  const chosen = new Map(
    submitted
      .filter((answer) => answer && typeof answer.questionId === 'string')
      .map((answer) => [answer.questionId, answer.selectedIndex]),
  );

  const results = bank.questions.map((question) => {
    if (!chosen.has(question.id)) {
      return { questionId: question.id, prompt: question.prompt, selectedIndex: null, correct: false };
    }
    const selectedIndex = chosen.get(question.id);
    return {
      questionId: question.id,
      prompt: question.prompt,
      selectedIndex,
      correctIndex: question.correctIndex,
      correct: selectedIndex === question.correctIndex,
      explanation: question.explanation,
    };
  });

  const score = results.filter((result) => result.correct).length;
  const total = results.length;

  res.json({
    topicId: bank.topicId,
    score,
    total,
    percentage: total === 0 ? 0 : Math.round((score / total) * 100),
    results,
  });
});

export default router;
