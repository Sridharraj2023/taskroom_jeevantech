import { Pool } from "pg";
import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import bcrypt from "bcryptjs";
import { registration } from "./validation.js";
const db = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  if (process.argv[2] === "migrate") {
    await db.query(
      await readFile(
        new URL("../../database/schema.sql", import.meta.url),
        "utf8",
      ),
    );
    console.log("Schema ready");
  } else {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    const input = registration.parse({
      name: await rl.question("Admin name: "),
      email: await rl.question("Admin email: "),
      password: await rl.question("Password (10+ characters; input visible): "),
    });
    rl.close();
    await db.query(
      "INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,'ADMIN')",
      [input.name, input.email, await bcrypt.hash(input.password, 12)],
    );
    console.log("Administrator created");
  }
} finally {
  await db.end();
}
