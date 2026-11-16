# infra/

The AWS CDK stack. **This folder belongs to the teammate doing the deploy — I have not put
anything in it beyond this note**, which records what the backend and frontend expect so the
two halves meet.

## What the stack needs to create

**Cognito** — a user pool and an app client. The frontend signs up, confirms by e-mailed
code, and signs in with `aws-amplify/auth`, so the client must allow `USER_SRP_AUTH` and must
*not* require a client secret (a browser cannot keep one).

**DynamoDB** — three tables, on-demand billing:

| Purpose | Partition key | Sort key |
|---|---|---|
| progress | `userId` (S) | `topicId` (S) |
| requests | `topic` (S) | `userId` (S) |
| feedback | `userId` (S) | `createdAt` (S) |

No secondary indexes. The API reads the generated names from the environment and never
hard-codes them.

**Lambda** — the API. Handler `lambda.handler`, Node 22 or later, with the backend folder as
the bundle. Environment:

```
COGNITO_USER_POOL_ID    the pool
COGNITO_CLIENT_ID       the app client
TABLE_PROGRESS          generated table names
TABLE_REQUESTS
TABLE_FEEDBACK
CORS_ORIGINS            the site's origin, comma-separated
NODE_ENV=production     also what disables the AUTH_BYPASS escape hatch
```

Grant the function read/write on the three tables and nothing else.

**The static site** — S3 and CloudFront serving `frontend/dist`.

## The one step that is easy to miss

After the stack deploys, **write the real values into `config.json` in the deployed site**:

```json
{
  "apiUrl": "https://<api>",
  "region": "<region>",
  "userPoolId": "<pool id>",
  "userPoolClientId": "<client id>"
}
```

The frontend fetches that file at startup rather than reading build-time env variables,
precisely so the bundle can be built before the stack exists. If the file is left as the
committed placeholder, the deployed site will try to call `http://localhost:4000` and will
run with sign-in disabled.
