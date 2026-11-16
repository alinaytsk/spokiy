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
| Lessons: pipelining, cache/memory, buses/interrupts | teammate | placeholder routes in `App.jsx` |
| Quiz page, progress page, cheat-sheet page | teammate | placeholder routes in `App.jsx` |
| CDK stack and deploy | teammate | `infra/` |

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

Then the site:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. The two finished lessons are linked from the home page.

### Progress, requests and feedback need DynamoDB

Those three routes return **503 `TABLE_… is not set`** until there are tables to talk to.
That is deliberate — it says exactly what is missing instead of failing deeper in the SDK.
Two ways forward:

- Use the deployed tables: put the real names from the CDK output into `backend/.env`.
- Run [DynamoDB Local](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBLocal.html),
  create the three tables with the key schemas below, and set `DYNAMO_ENDPOINT=http://localhost:8000`.

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

## Deploying the backend

`backend/lambda.js` wraps the same Express app with `serverless-http`; `src/index.js`
exports the app and never calls `listen()`, which is what makes both targets possible.
Point the Lambda handler at `lambda.handler`.
