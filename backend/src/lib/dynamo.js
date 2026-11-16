// One DynamoDB document client for the whole API.
//
// The table names come from the environment because my teammate's CDK stack creates the
// tables and writes their generated names into the Lambda's environment. Nothing here
// should ever hard-code a table name.
//
// DYNAMO_ENDPOINT is for running DynamoDB Local on a laptop. Left unset, the SDK talks to
// the real service in AWS_REGION.

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const base = new DynamoDBClient({
  region: process.env.AWS_REGION || 'eu-central-1',
  ...(process.env.DYNAMO_ENDPOINT ? { endpoint: process.env.DYNAMO_ENDPOINT } : {}),
});

export const ddb = DynamoDBDocumentClient.from(base, {
  marshallOptions: {
    // A field set to undefined should mean "leave it out", not crash the request.
    removeUndefinedValues: true,
  },
});

export const tables = {
  progress: process.env.TABLE_PROGRESS,
  requests: process.env.TABLE_REQUESTS,
  feedback: process.env.TABLE_FEEDBACK,
};

/**
 * Throws a 503-shaped error when a table name is missing, instead of letting the SDK fail
 * with a confusing validation error half a second later.
 */
export function requireTable(name) {
  const table = tables[name];
  if (!table) {
    const error = new Error(`TABLE_${name.toUpperCase()} is not set`);
    error.statusCode = 503;
    throw error;
  }
  return table;
}
