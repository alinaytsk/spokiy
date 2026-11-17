// Progress helpers shared by the quiz page and the progress page.
//
// POST /progress is a Put: it replaces the whole row for that topic. Sending only
// { topicId, score } would wipe `completed` and `lastStep`, so every write reads the row
// first and merges the change into it.

import { api } from './api.js';

// Below this a topic counts as "weak" - the threshold the team agreed on.
export const WEAK_BELOW = 60;

export async function recordProgress(topicId, patch) {
  const { progress } = await api.getProgress();
  const existing = progress.find((row) => row.topicId === topicId) ?? {};

  return api.saveProgress({
    topicId,
    completed: patch.completed ?? existing.completed ?? false,
    lastStep: patch.lastStep ?? existing.lastStep ?? 0,
    score: patch.score ?? existing.score,
  });
}

/**
 * What a progress row says about a topic.
 *
 * `score` is stored as a percentage (0-100), written by the quiz page after grading.
 */
export function topicStatus(row) {
  if (!row) return 'new';
  if (Number.isFinite(row.score)) return row.score < WEAK_BELOW ? 'weak' : 'done';
  return row.completed ? 'visited' : 'new';
}
