# sPOKiy

Short, clickable explanations of the parts of *Computer Organization Principles* that are
hard to hold in your head — the instruction cycle, pipelining, the memory hierarchy, number
representation, buses and interrupts. Read a lesson, change the parameters, watch what
moves, then practise on quiz questions written in the style the course actually asks.

Built by three students at UCU for second-year CS and Robotics.

## Layout

```
backend/    Node + Express API: topics, cheat sheets, quizzes, progress, requests, feedback
frontend/   React + Vite site: the lessons, the auth flow, the API client
infra/      AWS CDK: Cognito, DynamoDB, Lambda, the static site  (see infra/README.md)
```

## Who owns what

| Area | Owner | State |
|---|---|---|
| Backend API, quiz bank, auth middleware | Alina | done |
| Frontend scaffold, Cognito auth, API client | Alina | done |
| Lesson: the instruction cycle | Alina | done |
| Lesson: number representation | Alina | done |
| Lessons: memory hierarchy, cache hits and misses | Mykhailo | done |
| Quiz page (per topic + random practice), progress page, cheat-sheet page | Mykhailo | done |
| Lesson: pipelining with hazards | Sofia | done |
| Request page: topic votes and donation intent | Sofia | done |
| CDK stack and deploy | Sofia | done — see [`infra/README.md`](infra/README.md) |
| Lesson: buses/interrupts | teammate | placeholder route in `App.jsx` |

Every placeholder is a single `<Route>` in [`frontend/src/App.jsx`](frontend/src/App.jsx)
rendering `<Placeholder>`. Replace the element with your component; nothing else has to
change, and the API routes each page needs already work.

## Running it locally

Two terminals. The API first:

```bash
cd backend
npm install
cp .env.example .env     # the defaults are enough to start
AUTH_BYPASS=true npm run dev
```

`AUTH_BYPASS=true` makes every request look like a signed-in user, so the site works before
the Cognito pool exists. It is refused when `NODE_ENV=production`.

`npm run dev` and `npm start` read `backend/.env` through Node's own `--env-file-if-exists`
(Node 22.9 or later), so there is no dotenv package. Plain `node src/server.js` does **not**
read it.

Then the site:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. The finished lessons are linked from the home page.

`npm test` in `frontend/` checks the pipelining model against the textbook cases.

### Progress, requests and feedback need DynamoDB

Those three routes return **503 `TABLE_… is not set`** until there are tables to talk to.
That is deliberate — it says exactly what is missing instead of failing deeper in the SDK.
Two ways forward:

- Use the deployed tables: put the real names from the CDK output into `backend/.env`.
- Run [DynamoDB Local](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBLocal.html),
  create the three tables with the key schemas below, and set `DYNAMO_ENDPOINT=http://localhost:8000`
  and the three `TABLE_*` names in `.env`:

  ```bash
  docker run -d --rm --name spokiy-ddb -p 8000:8000 amazon/dynamodb-local
  ```

  DynamoDB Local keeps a separate set of tables per access key and region, so create the
  tables and run the API with the **same** dummy credentials, e.g.
  `AWS_ACCESS_KEY_ID=local AWS_SECRET_ACCESS_KEY=local AWS_REGION=eu-central-1`. With a
  different key the API answers 500 and logs `ResourceNotFoundException`.

The lessons, the cheat sheets and the quizzes need none of this — they are files on disk.

## The API

Base URL comes from `apiUrl` in `frontend/public/config.json`.

| Method | Path | Auth | What |
|---|---|---|---|
| `GET` | `/health` | — | liveness, and whether the auth bypass is on |
| `GET` | `/topics` | — | the five topics: `id`, `title`, `owner`, `cheatSheet` |
| `GET` | `/topics/:id/cheat-sheet` | — | the full sheet, as headed sections |
| `GET` | `/topics/:id/quiz` | — | questions **without** answers |
| `POST` | `/topics/:id/quiz/grade` | — | `{ answers: [{ questionId, selectedIndex }] }` → score and explanations |
| `GET` | `/progress` | ✅ | everything this user has done |
| `POST` | `/progress` | ✅ | `{ topicId, completed?, lastStep?, score? }` |
| `GET` | `/requests` | — | the topic-request tally, with donation-intent counts |
| `POST` | `/requests` | ✅ | `{ topic, wouldDonate? }` |
| `GET` | `/feedback` | ✅ | this user's own notes |
| `POST` | `/feedback` | ✅ | `{ message, topicId?, rating? }` |

Authenticated routes expect the Cognito **ID token** as `Authorization: Bearer <token>`.
Not the access token — the backend verifies with `tokenUse: 'id'`.

Answers never leave the server on `GET /quiz`: `correctIndex` and `explanation` are stripped
and only come back from the grading route. Unanswered questions grade as wrong rather than
being rejected, so a student who runs out of time still sees the explanations.

## Configuration is loaded at runtime, not baked in

`frontend/public/config.json` holds the API URL and the Cognito pool:

```json
{ "apiUrl": "...", "region": "...", "userPoolId": "...", "userPoolClientId": "..." }
```

It is fetched at startup, **not** read through `import.meta.env`. Vite would freeze env
variables into the bundle at build time, and the real pool does not exist until CDK has
deployed — which happens after the build. The deploy overwrites this file in `dist/`, so one
bundle works against any environment. Anything that needs config waits for `loadConfig()`.

The file committed here is a placeholder pointing at `http://localhost:4000` with empty pool
fields. With no pool, the site runs signed out and expects `AUTH_BYPASS=true` on the API.

## DynamoDB table shapes

The CDK stack creates these; the API only ever reads their names from the environment.

| Env var | Partition key | Sort key |
|---|---|---|
| `TABLE_PROGRESS` | `userId` (S) | `topicId` (S) |
| `TABLE_REQUESTS` | `topic` (S) | `userId` (S) |
| `TABLE_FEEDBACK` | `userId` (S) | `createdAt` (S) |

One row per user per topic in the first two, so voting or finishing a lesson twice updates a
row instead of adding one. No secondary indexes are needed.

## Deploying

Everything — Cognito, the tables, the API on Lambda, the site on CloudFront — is one CDK
stack. With Node 22+ and a signed-in AWS CLI:

```bash
cd infra
npm install
npx cdk bootstrap     # once per AWS account and region
npm run deploy        # builds backend + frontend, then deploys; prints the site URL
```

The deploy writes the real `config.json` into the site, so there is nothing to edit
afterwards. Prerequisites, outputs, costs, teardown and troubleshooting are in
[`infra/README.md`](infra/README.md).

`backend/lambda.js` wraps the same Express app with `serverless-http`; `src/index.js`
exports the app and never calls `listen()`, which is what makes both targets possible.
The Lambda handler is `lambda.handler`.
