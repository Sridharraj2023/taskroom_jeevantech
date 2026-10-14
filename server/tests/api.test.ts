import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import request from "supertest";
import { createApp } from "../src/app.js";
const db = new PGlite();
const origin = "http://localhost:5173";
const app = createApp(
  {
    query: async (text, values) => {
      const result = await db.query(text, values);
      return { rows: result.rows };
    },
  },
  { secret: "test-secret-with-more-than-thirty-two-characters", origin },
);
const alice = request.agent(app),
  bob = request.agent(app),
  admin = request.agent(app);
let taskId: string, aliceId: string, bobId: string;
before(async () => {
  await db.exec(
    await readFile(
      new URL("../../database/schema.sql", import.meta.url),
      "utf8",
    ),
  );
});
after(async () => {
  await db.close();
});
test("registration refuses injected roles and validates fields", async () => {
  await request(app)
    .post("/api/auth/register")
    .set("Origin", origin)
    .send({ name: "A", email: "invalid", password: "short" })
    .expect(400);
  await request(app)
    .post("/api/auth/register")
    .set("Origin", origin)
    .send({
      name: "Alice",
      email: "alice@example.com",
      password: "secure-password-123",
      role: "ADMIN",
    })
    .expect(400);
});
test("registration creates a User, uses HttpOnly cookie, rejects duplicates", async () => {
  const result = await alice
    .post("/api/auth/register")
    .set("Origin", origin)
    .send({
      name: "Alice",
      email: "ALICE@example.com",
      password: "secure-password-123",
    })
    .expect(201);
  aliceId = result.body.user.id;
  assert.equal(result.body.user.role, "USER");
  assert.equal(result.body.user.email, "alice@example.com");
  assert.match(String(result.headers["set-cookie"]), /HttpOnly/);
  assert.equal(result.body.user.password_hash, undefined);
  await request(app)
    .post("/api/auth/register")
    .set("Origin", origin)
    .send({
      name: "Alice",
      email: "alice@example.com",
      password: "secure-password-123",
    })
    .expect(409);
  const b = await bob
    .post("/api/auth/register")
    .set("Origin", origin)
    .send({
      name: "Bob",
      email: "bob@example.com",
      password: "secure-password-123",
    })
    .expect(201);
  bobId = b.body.user.id;
});
test("authentication, CSRF origin, and Admin authorization are enforced", async () => {
  await request(app).get("/api/tasks").expect(401);
  await request(app)
    .post("/api/auth/login")
    .send({ email: "alice@example.com", password: "secure-password-123" })
    .expect(403);
  await request(app)
    .post("/api/auth/login")
    .set("Origin", origin)
    .send({ email: "alice@example.com", password: "incorrect-password" })
    .expect(401);
  await alice.get("/api/users").expect(403);
  await alice
    .post("/api/tasks")
    .set("Origin", "https://other.example")
    .send({ title: "Bad origin" })
    .expect(403);
  await alice.get("/api/tasks?page=-1").expect(400);
});
test("Users can CRUD their tasks but cannot read or change another User’s tasks", async () => {
  const created = await alice
    .post("/api/tasks")
    .set("Origin", origin)
    .send({ title: "First task" })
    .expect(201);
  taskId = created.body.id;
  assert.equal(created.body.status, "TODO");
  await alice.get(`/api/tasks/${taskId}`).expect(200);
  await alice
    .patch(`/api/tasks/${taskId}`)
    .set("Origin", origin)
    .send({ status: "IN_PROGRESS" })
    .expect(200);
  await bob.get(`/api/tasks/${taskId}`).expect(404);
  await bob
    .patch(`/api/tasks/${taskId}`)
    .set("Origin", origin)
    .send({ title: "Stolen" })
    .expect(404);
  await bob.delete(`/api/tasks/${taskId}`).set("Origin", origin).expect(404);
  const list = await bob.get("/api/tasks").expect(200);
  assert.equal(list.body.total, 0);
  await alice
    .post("/api/tasks")
    .set("Origin", origin)
    .send({ title: "Unauthorized", owner_id: bobId })
    .expect(403);
  await alice
    .patch(`/api/tasks/${taskId}`)
    .set("Origin", origin)
    .send({ owner_id: bobId })
    .expect(403);
});
test("Admins can manage all users and tasks; role changes revoke existing sessions", async () => {
  await db.query("UPDATE users SET role='ADMIN' WHERE id=$1", [aliceId]);
  await admin
    .post("/api/auth/login")
    .set("Origin", origin)
    .send({ email: "alice@example.com", password: "secure-password-123" })
    .expect(200);
  const list = await admin.get("/api/users").expect(200);
  assert.equal(list.body.total, 2);
  await admin.get(`/api/users/${bobId}`).expect(200);
  await admin
    .patch(`/api/tasks/${taskId}`)
    .set("Origin", origin)
    .send({ owner_id: bobId })
    .expect(200);
  await admin
    .patch(`/api/users/${aliceId}`)
    .set("Origin", origin)
    .send({ name: "Alice", role: "USER" })
    .expect(409);
  await admin.delete(`/api/users/${aliceId}`).set("Origin", origin).expect(409);
  await admin
    .patch(`/api/users/${bobId}`)
    .set("Origin", origin)
    .send({ name: "Bob", role: "ADMIN" })
    .expect(200);
  await bob.get("/api/auth/me").expect(401);
  const added = await admin
    .post("/api/users")
    .set("Origin", origin)
    .send({
      name: "Charlie",
      email: "charlie@example.com",
      password: "secure-password-123",
    })
    .expect(201);
  await admin
    .delete(`/api/users/${added.body.id}`)
    .set("Origin", origin)
    .expect(204);
  await admin.delete(`/api/tasks/${taskId}`).set("Origin", origin).expect(204);
});
test("logout invalidates a previously issued JWT", async () => {
  const response = await request(app)
    .post("/api/auth/login")
    .set("Origin", origin)
    .send({ email: "alice@example.com", password: "secure-password-123" })
    .expect(200);
  const cookie = (
    response.headers["set-cookie"] as unknown as string[]
  )[0].split(";")[0];
  await request(app)
    .post("/api/auth/logout")
    .set("Origin", origin)
    .set("Cookie", cookie)
    .expect(204);
  await request(app).get("/api/auth/me").set("Cookie", cookie).expect(401);
});
