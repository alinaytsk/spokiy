// The Express app, and nothing else.
//
// This file deliberately does not call listen(). Two things import it: server.js, which
// listens on a port for local development, and ../lambda.js, which wraps it for API
// Gateway. Calling listen() here would break the second one.

import express from 'express';
import cors from 'cors';

import topicsRouter from './routes/topics.js';
import progressRouter from './routes/progress.js';
import requestsRouter from './routes/requests.js';
import feedbackRouter from './routes/feedback.js';
import { authBypassed } from './middleware/auth.js';

export const app = express();

// CORS_ORIGINS is a comma-separated list. Unset means "allow anything", which is right for
// local development and wrong in production - the deploy sets it to the site's origin.
const origins = process.env.CORS_ORIGINS?.split(',').map((value) => value.trim()).filter(Boolean);

app.use(cors(origins?.length ? { origin: origins } : {}));
app.use(express.json({ limit: '64kb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, authBypassed });
});

app.use('/topics', topicsRouter);
app.use('/progress', progressRouter);
app.use('/requests', requestsRouter);
app.use('/feedback', feedbackRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Four arguments, or Express does not recognise it as an error handler.
//
// An error carrying statusCode was thrown on purpose and its message is safe to show - a
// missing table name is the obvious one, and "TABLE_PROGRESS is not set" is far more use
// to whoever is running this than "Internal error". Anything else is a surprise, so it
// gets a stack trace in the log and nothing but a status in the response.
// eslint-disable-next-line no-unused-vars
app.use((error, _req, res, _next) => {
  const deliberate = Number.isInteger(error.statusCode);
  const status = deliberate ? error.statusCode : 500;

  if (deliberate) {
    console.warn(`${status}: ${error.message}`);
  } else {
    console.error(error);
  }

  res.status(status).json({ error: deliberate ? error.message : 'Internal error' });
});

export default app;
