// Topic requests: students vote for the topic they want explained next, and may flag that
// they would donate towards it.
//
// GET is public - the tally is the point, and showing it to visitors is what makes them
// vote. POST needs a signed-in user, because one person should not be able to vote fifty
// times by reloading.
//
// Table shape this expects (TABLE_REQUESTS):
//   partition key  topic   (S)
//   sort key       userId  (S)
//
// One row per user per topic, so voting twice updates the same row instead of inflating
// the count. The tally is computed with a Scan: the table holds one row per vote, which
// for a class of students is a few hundred rows at most. If this ever grew, the counts
// would move to a separate aggregate row updated with UpdateCommand ADD.

import { Router } from 'express';
import { ScanCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

import { ddb, requireTable } from '../lib/dynamo.js';
import { requireAuth } from '../middleware/auth.js';

const MAX_TOPIC_LENGTH = 120;

const router = Router();

// GET /requests  - the tally, public
router.get('/', async (_req, res, next) => {
  try {
    const TableName = requireTable('requests');

    const { Items = [] } = await ddb.send(new ScanCommand({ TableName }));

    const byTopic = new Map();
    for (const item of Items) {
      const entry = byTopic.get(item.topic) ?? { topic: item.topic, votes: 0, wouldDonate: 0 };
      entry.votes += 1;
      if (item.wouldDonate) entry.wouldDonate += 1;
      byTopic.set(item.topic, entry);
    }

    const requests = [...byTopic.values()].sort((a, b) => b.votes - a.votes);

    res.json({ requests });
  } catch (error) {
    next(error);
  }
});

// POST /requests  - cast or change this user's vote
//
// Body: { topic, wouldDonate? }
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const TableName = requireTable('requests');
    const { topic, wouldDonate } = req.body ?? {};

    if (typeof topic !== 'string' || topic.trim().length === 0) {
      return res.status(400).json({ error: 'A topic is required' });
    }
    if (topic.length > MAX_TOPIC_LENGTH) {
      return res.status(400).json({ error: `topic must be ${MAX_TOPIC_LENGTH} characters or fewer` });
    }

    const item = {
      topic: topic.trim(),
      userId: req.user.sub,
      wouldDonate: Boolean(wouldDonate),
      createdAt: new Date().toISOString(),
    };

    await ddb.send(new PutCommand({ TableName, Item: item }));

    res.status(201).json({ request: item });
  } catch (error) {
    next(error);
  }
});

export default router;
