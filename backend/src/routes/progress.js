// Per-user progress through the lessons. Both routes need a signed-in user.
//
// Table shape this expects (TABLE_PROGRESS):
//   partition key  userId   (S)
//   sort key       topicId  (S)
//
// One row per user per topic, so a read is a Query on the partition key and a write is a
// Put that overwrites the row. No GSI needed.

import { Router } from 'express';
import { QueryCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

import { ddb, requireTable } from '../lib/dynamo.js';
import { requireAuth } from '../middleware/auth.js';
import { findTopic } from '../data/topics.js';

const router = Router();

router.use(requireAuth);

// GET /progress  - everything this user has done
router.get('/', async (req, res, next) => {
  try {
    const TableName = requireTable('progress');

    const { Items = [] } = await ddb.send(
      new QueryCommand({
        TableName,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: { ':userId': req.user.sub },
      }),
    );

    res.json({ progress: Items });
  } catch (error) {
    next(error);
  }
});

// POST /progress  - record or update one topic
//
// Body: { topicId, completed?, lastStep?, score? }
router.post('/', async (req, res, next) => {
  try {
    const TableName = requireTable('progress');
    const { topicId, completed, lastStep, score } = req.body ?? {};

    if (!topicId || !findTopic(topicId)) {
      return res.status(400).json({ error: 'A known topicId is required' });
    }

    const item = {
      userId: req.user.sub,
      topicId,
      completed: Boolean(completed),
      lastStep: Number.isInteger(lastStep) ? lastStep : 0,
      // A missing score stays missing rather than becoming 0, which would read as
      // "took the quiz and got nothing right".
      score: Number.isFinite(score) ? score : undefined,
      updatedAt: new Date().toISOString(),
    };

    await ddb.send(new PutCommand({ TableName, Item: item }));

    res.status(200).json({ progress: item });
  } catch (error) {
    next(error);
  }
});

export default router;
