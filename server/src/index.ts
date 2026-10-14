import { Pool } from "pg";
import { resolve } from "node:path";
import { createApp } from "./app.js";
if (
  !process.env.DATABASE_URL ||
  !process.env.JWT_SECRET ||
  !process.env.APP_ORIGIN
)
  throw new Error("Set DATABASE_URL, JWT_SECRET and APP_ORIGIN");
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
const app = createApp(pool, {
  secret: process.env.JWT_SECRET,
  origin: process.env.APP_ORIGIN,
  production: process.env.NODE_ENV === "production",
  staticDir: resolve("../client/dist"),
});
const server = app.listen(Number(process.env.PORT || 4100), () =>
  console.log("Taskroom API listening"),
);
process.on("SIGTERM", () => server.close(() => void pool.end()));
