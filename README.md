# Taskroom — Full-Stack Role-Based Task Dashboard

Taskroom is a responsive task management application built for the **Full-Stack Application Development** assignment. Users register, log in, and manage their own tasks. Admins manage all tasks, accounts, and roles. Access is enforced by both React route guards and Express authorization middleware.

## Technology

- React, TypeScript, React Router, Tailwind CSS, and TanStack Query
- Node.js, Express, TypeScript, Zod validation, and PostgreSQL
- JWT authentication in HttpOnly cookies and bcrypt password hashing
- Supertest/PGlite API tests and Playwright browser checks

## Screenshots

![Login](docs/login.png)
![Dashboard](docs/dashboard.png)

## Project structure

```text
client/src/       React pages, shared components, session context and route guards
server/src/       Express API, validation, database setup and Admin creation
server/tests/     Authentication and authorization API tests
database/        PostgreSQL schema
postman/         Importable API collection with response assertions
scripts/         Browser verification
docs/            Desktop and mobile screenshots
```

## Local setup

Requires Node.js **22.12+**, npm, and Docker (or an existing PostgreSQL database).

```bash
git clone https://github.com/Sridharraj2023/taskroom_jeevantech.git
cd taskroom_jeevantech
npm ci
cp .env.example .env
```

Edit `.env` before continuing:

```dotenv
DATABASE_URL=postgres://taskapp:taskapp@localhost:5439/taskapp
JWT_SECRET=replace-with-at-least-32-random-characters
APP_ORIGIN=http://localhost:5173
PORT=4100
NODE_ENV=development
```

Generate a JWT secret with this command and copy its output into `JWT_SECRET`:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Start PostgreSQL, initialize the schema, and run the app:

```bash
docker compose up -d
npm run db:migrate
npm run dev
```

- Frontend: **http://localhost:5173**
- Backend health: **http://localhost:4100/api/health**
- API prefix: **http://localhost:4100/api**

Keep the development terminal running. If using an existing PostgreSQL instance, set its connection string in `DATABASE_URL` and skip Docker startup. The schema setup is repeatable for a new installation; future schema changes need versioned migrations. Local `.env` files, installed dependencies, and build outputs are ignored by Git.

## Registration, login, and Admin creation

Open `/register` to create a **USER** account. Public registration always creates Users and rejects a submitted role field. Passwords must have at least 10 characters and at most 72 UTF-8 bytes.

Create an Admin from a second terminal in the project root:

```bash
npm run admin:create
```

Enter an Admin name, a unique email, and a password. Password input is visible in the terminal; use a private terminal. No default accounts or passwords are included. After the command reports success, sign out of your User account and log in with the Admin credentials.

| UI route              | Access                                                 |
| --------------------- | ------------------------------------------------------ |
| `/login`, `/register` | Public; signed-in accounts redirect to their dashboard |
| `/dashboard`          | Signed-in accounts; Users see their own tasks          |
| `/admin`              | Admin dashboard with all tasks                         |
| `/admin/users`        | Admin account management and role changes              |
| `/forbidden`          | Access-restricted page for Users opening Admin routes  |

After login, Users land on `/dashboard` and Admins on `/admin`. Session restoration calls `/api/auth/me` before protected pages render. Admins can open **People** to see the users table and roles.

To inspect roles directly in the local database:

```bash
docker compose exec db psql -U taskapp -d taskapp -c "SELECT id, name, email, role FROM users;"
```

## API reference

All paths below are relative to `http://localhost:4100/api`.

| Method | Endpoint                 | Access / purpose                                |
| ------ | ------------------------ | ----------------------------------------------- |
| GET    | `/health`                | Public database health check                    |
| POST   | `/auth/register`         | Public User registration                        |
| POST   | `/auth/login`            | Public login                                    |
| GET    | `/auth/me`               | Current signed-in account                       |
| POST   | `/auth/logout`           | Invalidate all sessions for the current account |
| GET    | `/tasks?page=1&limit=20` | Own tasks for User; all tasks for Admin         |
| POST   | `/tasks`                 | Create task                                     |
| GET    | `/tasks/:id`             | Read accessible task                            |
| PATCH  | `/tasks/:id`             | Update accessible task                          |
| DELETE | `/tasks/:id`             | Delete accessible task                          |
| GET    | `/users?page=1&limit=20` | Admin: list accounts                            |
| POST   | `/users`                 | Admin: create account                           |
| GET    | `/users/:id`             | Admin: read account                             |
| PATCH  | `/users/:id`             | Admin: update name and role                     |
| DELETE | `/users/:id`             | Admin: delete account and its tasks             |

**Updates use PATCH. There are no PUT endpoints.** Replace `:id` with an actual UUID; do not include the literal `id:` prefix.

List responses contain `{ items, total, page, limit }`. Page sizes are limited to 100. Errors contain `{ message, errors? }`. API response codes include 400 for validation, 401 for authentication, 403 for authorization, 404 for missing/inaccessible resources, 409 for conflicts, and 429 for rate limits.

## Postman testing

### 1. Import and configure

With `npm run dev` running, open **Postman → Import → Files** and select:

```text
postman/Taskroom.postman_collection.json
```

This path is inside your cloned project. On macOS, press **Cmd + Shift + G** in the file picker to enter its full location.

Open the imported **Taskroom APIs** collection and its **Variables** tab. Set the values used by your requests:

| Variable        | Local value                                      |
| --------------- | ------------------------------------------------ |
| `baseUrl`       | `http://localhost:4100/api`                      |
| `origin`        | `http://localhost:5173`                          |
| `email`         | Your User email, or a new email for registration |
| `password`      | Your User password                               |
| `adminEmail`    | Email created with `npm run admin:create`        |
| `adminPassword` | Password created with `npm run admin:create`     |
| `taskId`        | Saved automatically by **Create task**           |
| `userId`        | Saved automatically by **Create user**           |

Keep Postman's **cookie jar enabled**. Login sets the session cookie, and subsequent requests send it automatically. A browser login does not log you into Postman. Leave **Authorization** set to **No Auth**; this API authenticates with a cookie rather than a manually entered Bearer token.

The collection includes the required `Origin` header and JSON content type. For manually created POST/PATCH/DELETE requests, set:

| Header         | Value                                                  |
| -------------- | ------------------------------------------------------ |
| `Origin`       | `http://localhost:5173`, matching `APP_ORIGIN` exactly |
| `Content-Type` | `application/json` when sending JSON                   |

### 2. Check backend health

Create and send:

```text
GET http://localhost:4100/api/health
```

Expected: **200 OK** with `{"status":"ok"}`. `/api` alone is a prefix and returns **404 Endpoint not found**.

### 3. Register or log in as a User

Run **Register User** for a new account:

```text
POST {{baseUrl}}/auth/register
```

Under **Body → raw → JSON**:

```json
{
  "name": "Test User",
  "email": "{{email}}",
  "password": "{{password}}"
}
```

Expected: **201 Created** with `user.role` equal to `USER`. If you already registered, skip this request; the same email returns **409**.

Run **Login User**:

```text
POST {{baseUrl}}/auth/login
```

```json
{
  "email": "{{email}}",
  "password": "{{password}}"
}
```

Expected: **200 OK**. Run **Current session** (`GET {{baseUrl}}/auth/me`) to see the account and role. Incorrect credentials return **401**.

### 4. Test tasks and User restrictions

Run these collection requests in order:

| Request                | Method and path            | Expected status             |
| ---------------------- | -------------------------- | --------------------------- |
| Create task            | `POST /tasks`              | 201; saves `taskId`         |
| List tasks             | `GET /tasks`               | 200; only this User's tasks |
| Read task              | `GET /tasks/{{taskId}}`    | 200                         |
| Update task            | `PATCH /tasks/{{taskId}}`  | 200                         |
| Delete task            | `DELETE /tasks/{{taskId}}` | 204, empty body             |
| User denied Admin list | `GET /users`               | 403                         |

Example creation body:

```json
{
  "title": "Review assignment",
  "description": "Verify role-based access",
  "status": "TODO"
}
```

Example update body: `{"status":"DONE"}`. Allowed statuses: `TODO`, `IN_PROGRESS`, `DONE`.

For an ownership test, log in as a second User and try reading, updating, or deleting a task created by the first User. Each returns **404**. Users cannot create tasks for other accounts or reassign ownership; these attempts return **403**. Admins can manage all tasks and set `owner_id` to an existing account's UUID.

### 5. Test Admin account management

Run **Login Admin** with the configured Admin credentials. Then run:

| Request     | Method and path            | Expected status             |
| ----------- | -------------------------- | --------------------------- |
| List users  | `GET /users`               | 200; includes account roles |
| Create user | `POST /users`              | 201; saves `userId`         |
| Read user   | `GET /users/{{userId}}`    | 200                         |
| Update user | `PATCH /users/{{userId}}`  | 200                         |
| Delete user | `DELETE /users/{{userId}}` | 204, empty body             |

The collection creates `managed@example.com`; change that email if it already exists. Deleting an account also deletes its tasks.

To read a user manually:

```text
GET http://localhost:4100/api/users/5d8099bd-b103-445c-ac07-1a5142ba8e30
```

The UUID above is an example. Replace it with an ID returned by **List users** in your database. Use the UUID directly, without `id:`.

To update that account, choose **PATCH**, use the same URL, and enter:

```json
{
  "name": "Updated Name",
  "role": "USER"
}
```

Both `name` and `role` are required for account updates. Use `ADMIN` to grant Admin access. Account updates revoke the target's existing sessions. Admins cannot delete themselves or change their own role to User; these requests return **409**.

### 6. Test logout and error responses

Run **Logout** (`POST {{baseUrl}}/auth/logout`) → **204**. Run **Current session** again → **401**. Logout invalidates all sessions for that account, including browser sessions.

| Test case                                          | Expected result                     |
| -------------------------------------------------- | ----------------------------------- |
| Invalid email, short password, or empty task title | 400 validation error                |
| Invalid UUID in URL                                | 400 validation error                |
| Duplicate registration email                       | 409 conflict                        |
| Mutation with missing/wrong Origin                 | 403 untrusted origin                |
| User requests `/users`                             | 403 administrator access required   |
| Missing/expired cookie                             | 401 sign-in required                |
| Nonexistent or inaccessible task                   | 404                                 |
| Too many requests                                  | 429; wait for the rate-limit window |

Use **Collection Runner** to run the complete collection on a fresh test database after setting Admin credentials. Requests include status assertions and save created IDs automatically. For an existing User, run requests individually and skip registration. The collection was verified with Newman: **16 requests and 16 assertions passed**. Newman was a temporary verification tool and is not a project dependency.

### Common Postman errors

- **Connection refused:** start `npm run dev` and check port 4100.
- **404 at `/api`:** send a complete endpoint, such as `/api/health`.
- **401 after browser login:** log in separately in Postman and enable its cookie jar.
- **403 on `/users`:** log in as an Admin in Postman.
- **403 on login/update:** match the `Origin` header to `APP_ORIGIN`.
- **400 with an ID:** remove `id:` and use the actual UUID.
- **PUT fails:** use PATCH for updates.

## Automated checks

```bash
npm run build
npm test
```

The API suite uses an in-memory PGlite database and Supertest. Six test groups cover validation, duplicate registration, role injection, cookie flags, invalid login, authentication, Origin enforcement, task ownership, Admin CRUD, self-protection, role-change revocation, and logout revocation. Local PostgreSQL schema migration and API smoke checks were also verified.

With `npm run dev` running, verify the browser flows:

```bash
npx playwright install chromium
npm run test:browser
```

Browser checks cover registration, login, session restoration, task create/edit, User denial of Admin routes, Admin account create/delete, logout, mobile overflow, and browser runtime errors. The script creates temporary test accounts and uses the configured database; run it against your local test database.

Format source files with `npm run format`.

## Database and security

`database/schema.sql` defines users and tasks with UUID keys, unique lowercase emails, constrained roles/statuses, an owner foreign key with cascading deletion, and an owner/creation index. Database records persist in a Docker volume.

SQL uses parameterized values. Passwords use bcrypt with cost 12. JWTs expire after eight hours. Every authenticated request reads the current role and token version from PostgreSQL. Account updates and logout invalidate sessions. Zod validates inputs; the API constrains body sizes. Helmet sets security headers. Cookies are HttpOnly, SameSite Strict, and Secure in production. All API mutations require the configured Origin.

Rate limits use in-process storage. Before deploying multiple instances, configure shared rate-limit storage and a trusted proxy that matches the hosting infrastructure. Never enable blanket proxy trust. Production requires HTTPS. Password reset, email verification, refresh tokens, and an audit log are future extensions.

## Deployment

The Dockerfile builds the frontend and backend and runs Express as a non-root user. Express serves the React build and supports deep links. `render.yaml` provides a web service and managed PostgreSQL blueprint.

1. Connect this GitHub repository to Render and import it as a Blueprint.
2. Review the selected paid hosting/database plans before provisioning.
3. Set `APP_ORIGIN` to the exact assigned HTTPS origin without a trailing slash.
4. The pre-deploy command initializes the schema. On hosts without this support, run `npm run db:migrate` before opening the app.
5. In a private server terminal, run `npm run admin:create --prefix /app`.
6. Verify health, login, registration, and User denial of Admin routes.

Required environment variables: `DATABASE_URL`, `JWT_SECRET`, `APP_ORIGIN`. Optional: `PORT`, `NODE_ENV`. Use the database provider's TLS settings and retain certificate verification. Keep secrets in the hosting environment, never in Git.

**Deployment configuration is included; a live deployment has not been provisioned.** Pushing source to GitHub does not deploy the application.

## References

[React Router](https://reactrouter.com/start/declarative/routing), [TanStack Query](https://tanstack.com/query/latest/docs/framework/react), [Express security](https://expressjs.com/en/advanced/best-practice-security/), [Render Blueprints](https://render.com/docs/blueprint-spec).
