import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, ShieldCheck, ArrowRight } from "lucide-react";
import { z } from "zod";
import { api, type User } from "./api";
import { Field, Notice } from "./components";
export function AuthForm({ register = false }: { register?: boolean }) {
  const navigate = useNavigate(),
    cache = useQueryClient();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const mutation = useMutation({
    mutationFn: (body: unknown) =>
      api<{ user: User }>(
        `/auth/${register ? "register" : "login"}`,
        "POST",
        body,
      ),
    onSuccess: ({ user }) => {
      cache.removeQueries({ predicate: (q) => q.queryKey[0] !== "session" });
      cache.setQueryData(["session"], user);
      navigate(user.role === "ADMIN" ? "/admin" : "/dashboard", {
        replace: true,
      });
    },
  });
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(e.currentTarget));
    const schema = z.object({
      email: z.email(),
      password: z
        .string()
        .min(10, "Use at least 10 characters")
        .max(72)
        .refine(
          (v) => new TextEncoder().encode(v).length <= 72,
          "Use at most 72 UTF-8 bytes",
        ),
      ...(register
        ? { name: z.string().trim().min(2, "Enter your full name").max(80) }
        : {}),
    });
    const result = schema.safeParse(values);
    if (!result.success) {
      setErrors(
        Object.fromEntries(
          result.error.issues.map((i) => [i.path[0], i.message]),
        ),
      );
      return;
    }
    setErrors({});
    mutation.mutate(result.data);
  }
  return (
    <div className="auth-grid">
      <aside className="auth-story">
        <Link className="brand" to="/">
          {" "}
          <span className="brand-icon">
            <Check size={22} />
          </span>{" "}
          taskroom<span className="brand-dot">.</span>
        </Link>
        <div>
          <span className="eyebrow">LESS BUSYWORK. MORE PROGRESS.</span>
          <h1>
            A little structure.
            <br />A lot of possibility.
          </h1>
          <p>
            Your tasks, your team, and your next big thing.
            <br />
            One thoughtful place to bring it all together.
          </p>
          <div className="story-card">
            <div className="flex items-center gap-3">
              <span className="round-check">
                <Check size={17} />
              </span>
              <span>Make room for what matters</span>
            </div>
            <div className="story-line" />
            <div className="flex items-center justify-between">
              <span className="text-sm opacity-70">
                A workspace that works with you
              </span>
              <span className="avatars">J &nbsp; M &nbsp; A</span>
            </div>
          </div>
        </div>
        <span className="story-footer">
          A clearer day starts here. © {new Date().getFullYear()} Taskroom
        </span>
      </aside>
      <main className="auth-main">
        <div className="auth-form">
          <span className="pill">
            <ShieldCheck size={14} /> Your secure workspace
          </span>
          <h2>{register ? "Start something great." : "Welcome back."}</h2>
          <p className="muted">
            {register
              ? "Create your account and make your first move."
              : "Sign in to pick up where you left off."}
          </p>
          <form onSubmit={submit} noValidate>
            {register && (
              <Field
                label="Full name"
                name="name"
                autoComplete="name"
                placeholder="Alex Morgan"
                error={errors.name}
                required
              />
            )}
            <Field
              label="Email address"
              type="email"
              name="email"
              autoComplete="email"
              placeholder="you@example.com"
              error={errors.email}
              required
            />
            <Field
              label="Password"
              type="password"
              name="password"
              autoComplete={register ? "new-password" : "current-password"}
              placeholder="At least 10 characters"
              error={errors.password}
              required
            />
            <Notice error={mutation.error} />
            <button className="primary w-full" disabled={mutation.isPending}>
              {mutation.isPending
                ? "Please wait…"
                : register
                  ? "Create account"
                  : "Sign in"}
              <ArrowRight size={18} />
            </button>
          </form>
          <p className="auth-switch">
            {register ? "Already have an account?" : "New to Taskroom?"}{" "}
            <Link to={register ? "/login" : "/register"}>
              {register ? "Sign in" : "Create an account"}
            </Link>
          </p>
          <div className="auth-note">
            <ShieldCheck size={16} />
            <span>
              {register
                ? "New accounts have User access. Your administrator manages permissions."
                : "Your workspace permissions are set by your account role."}
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}
