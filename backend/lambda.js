// The Lambda entry point.
//
// serverless-http turns the API Gateway event into the req/res pair Express expects. The
// handler is created once, outside the function, so it is reused across warm invocations.
//
// The app is imported from src/index.js precisely because that file does not listen().

import serverlessHttp from 'serverless-http';

import { app } from './src/index.js';

export const handler = serverlessHttp(app);
