const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 960 },
  });
  let errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const email = `qa-${randomUUID()}@example.com`,
    password = `qa-${randomUUID()}`;
  await page.goto("http://localhost:5173/register");
  await page.getByLabel("Full name").fill("QA Reviewer");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/dashboard");
  await page
    .getByRole("heading", { name: "Your tasks", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "New task", exact: true }).click();
  await page.getByLabel("Task title").fill("Verify role access");
  await page.getByLabel("Description").fill("Browser verification task");
  await page.getByRole("button", { name: "Save task" }).click();
  await page.getByText("Verify role access", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Edit Verify role access" }).click();
  await page.getByRole("combobox").selectOption("DONE");
  await page.getByRole("button", { name: "Save task" }).click();
  await page.getByText("done", { exact: true }).waitFor();
  await page.screenshot({ path: "docs/dashboard.png", fullPage: true });
  await page.goto("http://localhost:5173/admin/users");
  await page.waitForURL("**/forbidden");
  await page.getByRole("heading", { name: "Access restricted" }).waitFor();
  await page.reload();
  await page.getByRole("heading", { name: "Access restricted" }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://localhost:5173/dashboard");
  await page
    .getByRole("heading", { name: "Your tasks", exact: true })
    .waitFor();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
    false,
  );
  await page.screenshot({ path: "docs/mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.waitForURL("**/login");
  await page.getByRole("heading", { name: "Welcome back." }).waitFor();
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/dashboard");
  // Promote only the test account directly, then verify the role is restored from the API.
  const { Pool } = require("pg");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query(
    "UPDATE users SET role='ADMIN', token_version=token_version+1 WHERE email=$1",
    [email],
  );
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.waitForURL("**/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/admin");
  await page.getByRole("link", { name: "People", exact: true }).click();
  await page.waitForURL("**/admin/users");
  await page.getByRole("button", { name: "Add person" }).click();
  await page.getByLabel("Full name").fill("Managed Reviewer");
  await page
    .getByLabel("Email", { exact: true })
    .fill(`managed-${randomUUID()}@example.com`);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Save account" }).click();
  await page.getByText("Managed Reviewer", { exact: true }).waitFor();
  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Delete Managed Reviewer" }).click();
  await page
    .getByText("Managed Reviewer", { exact: true })
    .waitFor({ state: "detached" });
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.waitForURL("**/login");
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.screenshot({ path: "docs/login.png", fullPage: true });
  await pool.query("DELETE FROM users WHERE email=$1", [email]);
  await pool.end();
  assert.deepEqual(errors, []);
  await browser.close();
  console.log(
    "PASS: registration, login, session restore, task create/edit, User denial, Admin users CRUD, logout, mobile overflow; no browser errors.",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
