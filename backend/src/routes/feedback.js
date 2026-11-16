// Feedback on a lesson. Both routes need a signed-in user: GET returns only what the
// caller wrote, never anyone else's.
//
// Table shape this expects (TABLE_FEEDBACK):
//   partition key  userId     (S)
//   sort key       createdAt  (S, ISO 8601)
//
// Sorting by the timestamp means a Query comes back oldest-first for free, and a user can
// leave more than one note without the second overwriting the first.

import { Router } from 'express';
import { QueryCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

import { ddb, requireTable } from '../lib/dynamo.js';
import { requireAuth } from '../middleware/auth.js';
import { findTopic } from '../data/topics.js';

const MAX_MESSAGE_LENGTH = 2000;

const router = Router();

router.use(requireAuth);

// GET /feedback  - this user's own notes
router.get('/', async (req, res, next) => {
  try {
    const TableName = requireTable('feedback');

    const { Items = [] } = await ddb.send(
      new QueryCommand({
        TableName,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: { ':userId': req.user.sub },
      }),
    );

    res.json({ feedback: Items });
  } catch (error) {
    next(error);
  }
});

// POST /feedback
//
// Body: { message, topicId?, rating? }
router.post('/', async (req, res, next) => {
  try {
    const TableName = requireTable('feedback');
    const { message, topicId, rating } = req.body ?? {};

    if (typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'A message is required' });
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ error: `message must be ${MAX_MESSAGE_LENGTH} characters or fewer` });
    }
    // Feedback about the site in general has no topic, so topicId is optional - but if it
    // is given it has to be real, or the dashboard would show counts against a typo.
    if (topicId && !findTopic(topicId)) {
      return res.status(400).json({ error: 'Unknown topicId' });
    }
    if (rating !== undefined && !(Number.isInteger(rating) && rating >= 1 && rating <= 5)) {
      return res.status(400).json({ error: 'rating must be an integer from 1 to 5' });
    }

    const item = {
      userId: req.user.sub,
      createdAt: new Date().toISOString(),
      message: message.trim(),
      topicId: topicId || undefined,
      rating: rating ?? undefined,
      email: req.user.email,
    };

    await ddb.send(new PutCommand({ TableName, Item: item }));

    res.status(201).json({ feedback: item });
  } catch (error) {
    next(error);
  }
});

export default router;
