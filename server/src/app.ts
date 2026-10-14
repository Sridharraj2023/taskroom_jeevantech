import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { z } from "zod";
import {
  credentials,
  registration,
  taskInput,
  taskUpdate,
  userUpdate,
  idSchema,
  pagination,
} from "./validation.js";
export interface Database {
  query(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: any[]; rowCount?: number | null }>;
}
interface User {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "USER";
  token_version: number;
}
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}
class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function createApp(
  db: Database,
  config: {
    secret: string;
    origin: string;
    production?: boolean;
    staticDir?: string;
  },
) {
  if (config.secret.length < 32)
    throw new Error("JWT_SECRET must contain at least 32 characters");
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet(), express.json({ limit: "16kb" }), cookieParser());
  app.use(
    "/api",
    rateLimit({
      windowMs: 60_000,
      limit: 200,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
  );
  // Same-origin cookies, plus origin enforcement on every state-changing request.
  app.use("/api", (req, res, next) => {
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.get("origin") !== config.origin
    )
      return res.status(403).json({ message: "Untrusted request origin" });
    next();
  });
  const loginLimit = rateLimit({
    windowMs: 15 * 60_000,
    limit: 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  });
  const publicUser = (u: User) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
  });
  const session = (res: Response, u: User) =>
    res.cookie(
      "session",
      jwt.sign({ version: u.token_version }, config.secret, {
        subject: u.id,
        expiresIn: "8h",
        algorithm: "HS256",
        issuer: "taskroom",
        audience: "taskroom-web",
      }),
      {
        httpOnly: true,
        secure: !!config.production,
        sameSite: "strict",
        maxAge: 8 * 60 * 60_000,
        path: "/",
      },
    );
  const auth = async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const payload = jwt.verify(req.cookies.session || "", config.secret, {
        algorithms: ["HS256"],
        issuer: "taskroom",
        audience: "taskroom-web",
      }) as jwt.JwtPayload;
      const { rows } = await db.query(
        "SELECT id,name,email,role,token_version FROM users WHERE id=$1",
        [payload.sub],
      );
      if (!rows[0] || rows[0].token_version !== payload.version)
        throw new Error();
      req.user = rows[0];
      next();
    } catch (error) {
      if (
        error instanceof jwt.JsonWebTokenError ||
        error instanceof jwt.TokenExpiredError ||
        !(error as any)?.code
      )
        next(new HttpError(401, "Please sign in to continue"));
      else next(error);
    }
  };
  const admin = (req: Request, _res: Response, next: NextFunction) =>
    req.user?.role === "ADMIN"
      ? next()
      : next(new HttpError(403, "Administrator access required"));
  app.get("/api/health", async (_req, res) => {
    await db.query("SELECT 1");
    res.json({ status: "ok" });
  });
  app.post("/api/auth/register", loginLimit, async (req, res) => {
    const input = registration.parse(req.body);
    const hash = await bcrypt.hash(input.password, 12);
    const { rows } = await db.query(
      "INSERT INTO users(name,email,password_hash) VALUES($1,$2,$3) RETURNING id,name,email,role,token_version",
      [input.name, input.email, hash],
    );
    session(res, rows[0]);
    res.status(201).json({ user: publicUser(rows[0]) });
  });
  app.post("/api/auth/login", loginLimit, async (req, res) => {
    const input = credentials.parse(req.body);
    const { rows } = await db.query("SELECT * FROM users WHERE email=$1", [
      input.email,
    ]);
    const fallback =
      "$2b$12$012345678901234567890u5OBkswQr0N9PFYELTYFdMOCyKGXL0.Ku";
    const valid = await bcrypt.compare(
      input.password,
      rows[0]?.password_hash || fallback,
    );
    if (!rows[0] || !valid)
      throw new HttpError(401, "Email or password is incorrect");
    session(res, rows[0]);
    res.json({ user: publicUser(rows[0]) });
  });
  app.get("/api/auth/me", auth, (req, res) =>
    res.json({ user: publicUser(req.user!) }),
  );
  app.post("/api/auth/logout", auth, async (req, res) => {
    await db.query(
      "UPDATE users SET token_version=token_version+1 WHERE id=$1",
      [req.user!.id],
    );
    res
      .clearCookie("session", {
        path: "/",
        httpOnly: true,
        secure: !!config.production,
        sameSite: "strict",
      })
      .status(204)
      .end();
  });
  app.use("/api/tasks", auth);
  app.get("/api/tasks", async (req, res) => {
    const { page, limit } = pagination.parse(req.query);
    const owner = req.user!.role === "ADMIN" ? null : req.user!.id;
    const { rows } = await db.query(
      "SELECT t.*,u.name AS owner_name FROM tasks t JOIN users u ON u.id=t.owner_id WHERE ($1::uuid IS NULL OR t.owner_id=$1) ORDER BY t.created_at DESC LIMIT $2 OFFSET $3",
      [owner, limit, (page - 1) * limit],
    );
    const count = await db.query(
      "SELECT count(*)::int AS total FROM tasks WHERE ($1::uuid IS NULL OR owner_id=$1)",
      [owner],
    );
    res.json({ items: rows, total: count.rows[0].total, page, limit });
  });
  app.post("/api/tasks", async (req, res) => {
    const input = taskInput.parse(req.body);
    if (
      input.owner_id &&
      input.owner_id !== req.user!.id &&
      req.user!.role !== "ADMIN"
    )
      throw new HttpError(403, "You can only create your own tasks");
    const { rows } = await db.query(
      "INSERT INTO tasks(title,description,status,owner_id) VALUES($1,$2,$3,$4) RETURNING *",
      [
        input.title,
        input.description,
        input.status,
        input.owner_id || req.user!.id,
      ],
    );
    res.status(201).json(rows[0]);
  });
  const taskScope = (req: Request) =>
    req.user!.role === "ADMIN" ? null : req.user!.id;
  app.get("/api/tasks/:id", async (req, res) => {
    const { rows } = await db.query(
      "SELECT * FROM tasks WHERE id=$1 AND ($2::uuid IS NULL OR owner_id=$2)",
      [idSchema.parse(req.params.id), taskScope(req)],
    );
    if (!rows[0]) throw new HttpError(404, "Task not found");
    res.json(rows[0]);
  });
  app.patch("/api/tasks/:id", async (req, res) => {
    const input = taskUpdate.parse(req.body);
    if (input.owner_id && req.user!.role !== "ADMIN")
      throw new HttpError(403, "Only administrators can reassign tasks");
    const { rows } = await db.query(
      "UPDATE tasks SET title=COALESCE($3,title),description=COALESCE($4,description),status=COALESCE($5,status),owner_id=COALESCE($6,owner_id),updated_at=now() WHERE id=$1 AND ($2::uuid IS NULL OR owner_id=$2) RETURNING *",
      [
        idSchema.parse(req.params.id),
        taskScope(req),
        input.title ?? null,
        input.description ?? null,
        input.status ?? null,
        input.owner_id ?? null,
      ],
    );
    if (!rows[0]) throw new HttpError(404, "Task not found");
    res.json(rows[0]);
  });
  app.delete("/api/tasks/:id", async (req, res) => {
    const result = await db.query(
      "DELETE FROM tasks WHERE id=$1 AND ($2::uuid IS NULL OR owner_id=$2) RETURNING id",
      [idSchema.parse(req.params.id), taskScope(req)],
    );
    if (!result.rows.length) throw new HttpError(404, "Task not found");
    res.status(204).end();
  });
  app.use("/api/users", auth, admin);
  app.get("/api/users", async (req, res) => {
    const { page, limit } = pagination.parse(req.query);
    const result = await db.query(
      "SELECT id,name,email,role,created_at FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2",
      [limit, (page - 1) * limit],
    );
    const count = await db.query("SELECT count(*)::int AS total FROM users");
    res.json({ items: result.rows, total: count.rows[0].total, page, limit });
  });
  app.get("/api/users/:id", async (req, res) => {
    const { rows } = await db.query(
      "SELECT id,name,email,role,created_at FROM users WHERE id=$1",
      [idSchema.parse(req.params.id)],
    );
    if (!rows[0]) throw new HttpError(404, "User not found");
    res.json(rows[0]);
  });
  app.post("/api/users", async (req, res) => {
    const input = registration
      .extend({ role: z.enum(["ADMIN", "USER"]).default("USER") })
      .parse(req.body);
    const { rows } = await db.query(
      "INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,$4) RETURNING id,name,email,role",
      [
        input.name,
        input.email,
        await bcrypt.hash(input.password, 12),
        input.role,
      ],
    );
    res.status(201).json(rows[0]);
  });
  app.patch("/api/users/:id", async (req, res) => {
    const id = idSchema.parse(req.params.id),
      input = userUpdate.parse(req.body);
    if (id === req.user!.id && input.role !== "ADMIN")
      throw new HttpError(
        409,
        "You cannot remove your own administrator access",
      );
    const { rows } = await db.query(
      "UPDATE users SET name=$2,role=$3,token_version=token_version+1 WHERE id=$1 RETURNING id,name,email,role",
      [id, input.name, input.role],
    );
    if (!rows[0]) throw new HttpError(404, "User not found");
    res.json(rows[0]);
  });
  app.delete("/api/users/:id", async (req, res) => {
    const id = idSchema.parse(req.params.id);
    if (id === req.user!.id)
      throw new HttpError(
        409,
        "You cannot delete your own administrator account",
      );
    const result = await db.query(
      "DELETE FROM users WHERE id=$1 RETURNING id",
      [id],
    );
    if (!result.rows.length) throw new HttpError(404, "User not found");
    res.status(204).end();
  });
  app.use("/api", (_req, _res, next) =>
    next(new HttpError(404, "Endpoint not found")),
  );
  if (config.staticDir) {
    app.use(express.static(config.staticDir));
    app.get("/{*path}", (_req, res) =>
      res.sendFile("index.html", { root: config.staticDir }),
    );
  }
  app.use((error: any, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof z.ZodError)
      return res.status(400).json({
        message: "Check the submitted fields",
        errors: error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        })),
      });
    if (error.code === "23505")
      return res
        .status(409)
        .json({ message: "This email is already registered" });
    if (error.code === "23503")
      return res.status(400).json({ message: "Selected user does not exist" });
    const status =
      error instanceof HttpError
        ? error.status
        : error.status === 400
          ? 400
          : 500;
    if (status === 500) console.error("API error", error);
    res.status(status).json({
      message: status === 500 ? "An unexpected error occurred" : error.message,
    });
  });
  return app;
}
