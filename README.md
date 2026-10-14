# Taskroom — role-based task dashboard

React + TypeScript, Tailwind CSS, TanStack Query, Express + TypeScript, and PostgreSQL. Registration and login use JWTs in HttpOnly, SameSite cookies. React guards routes; the API independently enforces permissions and task ownership.

## Run locally

Requires Node 22.12+ and Docker (or an existing PostgreSQL database).

```sh
npm ci
cp .env.example .env
# Replace JWT_SECRET with a random secret of at least 32 characters.
docker compose up -d
npm run db:migrate
npm run admin:create
npm run dev
```

Frontend: http://localhost:5173. API: http://localhost:4100/api.

The administrator setup command prompts for account details. Password input is visible in the terminal; use a private terminal. Public registration never accepts a role and always creates a User. Accounts are not preloaded with default passwords.

## Access rules

| Route / API           | User                                  | Admin                                 |
| --------------------- | ------------------------------------- | ------------------------------------- |
| `/login`, `/register` | Public; signed-in users redirect home | Same                                  |
| `/dashboard`          | Own tasks                             | All tasks                             |
| `/admin`              | Redirect to `/forbidden`              | Team dashboard                        |
| `/admin/users`        | Redirect to `/forbidden`              | User management                       |
| `/api/tasks`          | CRUD own tasks only                   | CRUD all tasks and reassign ownership |
| `/api/users`          | 403                                   | CRUD accounts and change roles        |

After login, Users go to `/dashboard`, Admins to `/admin`. Session restoration calls `/api/auth/me` before showing protected pages. Hiding a menu is only a UI convenience; Express authorization controls actual access. Every authenticated request reads the current database role and token version. Role changes invalidate that account’s sessions. Logout invalidates all sessions for the account. Admins cannot delete themselves or remove their own Admin role. Account deletion cascades to that account’s tasks, with a confirmation in the UI.

## API

- `POST /api/auth/register`: `{ name, email, password }` → `{ user }` + session cookie
- `POST /api/auth/login`: `{ email, password }` → `{ user }` + session cookie
- `GET /api/auth/me`, `POST /api/auth/logout`
- `GET /api/tasks?page=1&limit=20`, `POST /api/tasks`
- `GET`, `PATCH`, `DELETE /api/tasks/:id`
- `GET /api/users?page=1&limit=20`, `POST /api/users` (Admin)
- `GET`, `PATCH`, `DELETE /api/users/:id` (Admin)
- `GET /api/health` checks database connectivity

Task payload: `{ title, description?, status?, owner_id? }`. Status: `TODO`, `IN_PROGRESS`, `DONE`. Only Admins can create tasks for another account or reassign tasks. User update: `{ name, role }`. Admin account creation also requires email and password. List responses: `{ items, total, page, limit }` with maximum page size 100. Errors: `{ message, errors? }`; field validation errors return 400, authentication 401, authorization 403, missing resources 404, duplicates 409. Inaccessible tasks return 404 to avoid exposing another user’s resources.

All POST/PATCH/DELETE requests require `Origin` equal to `APP_ORIGIN`, including Postman requests. Development requests go through Vite’s `/api` proxy. Production serves the client and API from the same origin. Cookies use Secure in production. Serve production over HTTPS.

## Database

`database/schema.sql` defines users and tasks, UUID primary keys, case-normalized unique email, constrained roles and statuses, owner foreign key with cascading deletion, and an index on owner/creation date. Setup is repeatable for a new installation; future schema changes need versioned migrations.

Parameterized SQL prevents injected values from being executed. Passwords use bcrypt with cost 12. JWTs expire after 8 hours. Zod validates API and form inputs, rejects extra mutation fields, and constrains request sizes. Helmet sets security headers. In-process rate limits protect auth and general API traffic. For multiple instances, add a shared rate-limit store and configure a trusted proxy to match the hosting environment. Never set blanket proxy trust.

## Verification

```sh
npm run build
npm test
# With npm run dev running:
npx playwright install chromium
npm run test:browser
```

The API tests use real PostgreSQL semantics through an in-memory PGlite database and Supertest. They cover validation, duplicate registration, role injection, cookie flags, invalid login, missing authentication, origin enforcement, task ownership, Admin CRUD, self-protection, role-change revocation, and logout revocation. Production PostgreSQL is exercised separately via migration and local smoke checks.

Import `postman/Taskroom.postman_collection.json` into Postman. Set Admin credentials in its variables, use the cookie jar, and run requests in order on a fresh database. The collection was also run with Newman: 16 requests and 16 assertions passed. Newman was a temporary verification tool; it is not included in the project dependencies. Import the collection into Postman to repeat these checks.

## Production / deployment

`Dockerfile` builds both projects and runs Express as a non-root user. Express serves the built React app, including deep links. `render.yaml` supplies a web service and managed PostgreSQL blueprint. Hosting incurs the provider’s selected plan costs; review the blueprint before provisioning.

1. Create a GitHub repository and push this folder (the local `.env` is ignored).
2. Import the repository as a Render Blueprint.
3. Set `APP_ORIGIN` to the exact HTTPS origin assigned to your service, without a trailing slash.
4. The pre-deploy command initializes the schema. On hosts without pre-deploy support, run `npm run db:migrate` once before opening the app.
5. In a private server terminal run `npm run admin:create --prefix /app`.
6. Verify health, registration, login, and User denial of `/admin/users`.

Required environment variables: `DATABASE_URL`, `JWT_SECRET`, `APP_ORIGIN`; optional `PORT` and `NODE_ENV`. Use your provider’s PostgreSQL TLS settings; retain certificate verification. For a manual Docker launch pass environment variables through your runtime secret manager. JWT signing secrets must never be committed.

This project has no password reset, email verification, refresh tokens, or audit log yet. These are appropriate extensions before use with sensitive production data. GitHub publishing and live deployment require an authenticated repository/hosting account; the source and deployment configuration do not themselves create a public URL.

Implementation references: [React Router routing](https://reactrouter.com/start/declarative/routing), [TanStack Query](https://tanstack.com/query/latest/docs/framework/react), [Express security guidance](https://expressjs.com/en/advanced/best-practice-security/), and [Render Blueprint configuration](https://render.com/docs/blueprint-spec).
