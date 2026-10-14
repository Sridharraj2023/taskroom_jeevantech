import { useContext, useState, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { z } from "zod";
import { AuthContext } from "./auth";
import { api, type User, type Page } from "./api";
import { Field, Notice, Pager } from "./components";
function UserEditor({ user, onClose }: { user?: User; onClose: () => void }) {
  const cache = useQueryClient();
  const [error, setError] = useState("");
  const mutation = useMutation({
    mutationFn: (body: unknown) =>
      api(`/users${user ? "/" + user.id : ""}`, user ? "PATCH" : "POST", body),
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ["users"] });
      void cache.invalidateQueries({ queryKey: ["session"] });
      onClose();
    },
  });
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(e.currentTarget));
    const common = {
      name: z.string().trim().min(2).max(80),
      role: z.enum(["ADMIN", "USER"]),
    };
    const result = z
      .object(
        user
          ? common
          : {
              ...common,
              email: z.email().max(254),
              password: z
                .string()
                .min(10)
                .max(72)
                .refine(
                  (v) => new TextEncoder().encode(v).length <= 72,
                  "Use at most 72 UTF-8 bytes",
                ),
            },
      )
      .safeParse(values);
    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }
    setError("");
    mutation.mutate(result.data);
  }
  return (
    <div className="modal-backdrop">
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-editor"
      >
        <h2 id="user-editor">{user ? "Edit account" : "Create account"}</h2>
        <form onSubmit={submit}>
          <Field
            label="Full name"
            name="name"
            defaultValue={user?.name}
            autoFocus
            required
          />
          {!user && (
            <>
              <Field label="Email" name="email" type="email" required />
              <Field
                label="Password"
                name="password"
                type="password"
                minLength={10}
                required
              />
            </>
          )}
          <label className="field">
            Role
            <select name="role" defaultValue={user?.role || "USER"}>
              <option value="USER">User</option>
              <option value="ADMIN">Admin</option>
            </select>
          </label>
          {error && (
            <p className="notice" role="alert">
              {error}
            </p>
          )}
          <Notice error={mutation.error} />
          <div className="flex justify-end gap-3">
            <button className="secondary" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="primary" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : "Save account"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
export function People() {
  const { user } = useContext(AuthContext);
  const [page, setPage] = useState(1),
    [editor, setEditor] = useState<User | "new" | null>(null);
  const cache = useQueryClient();
  const query = useQuery({
    queryKey: ["users", page],
    queryFn: () => api<Page<User>>(`/users?page=${page}`),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/users/${id}`, "DELETE"),
    onSuccess: () => void cache.invalidateQueries({ queryKey: ["users"] }),
  });
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">BETTER TOGETHER</span>
          <h1>Your people.</h1>
          <p className="muted">Manage accounts and workspace permissions.</p>
        </div>
        <button className="primary" onClick={() => setEditor("new")}>
          <Plus size={18} />
          Add person
        </button>
      </div>
      <section className="panel">
        <Notice error={query.error} />
        <Notice error={remove.error} />
        {query.isPending ? (
          <div className="empty">Loading accounts…</div>
        ) : query.isError ? (
          <div className="empty">
            <button className="secondary" onClick={() => void query.refetch()}>
              Try again
            </button>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Role</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {query.data?.items.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <strong>{u.name}</strong>
                      <small>{u.email}</small>
                    </td>
                    <td>
                      <span className="pill">{u.role}</span>
                    </td>
                    <td>
                      <div className="flex gap-3">
                        <button
                          onClick={() => setEditor(u)}
                          aria-label={`Edit ${u.name}`}
                        >
                          <Pencil size={17} />
                        </button>
                        <button
                          disabled={u.id === user?.id || remove.isPending}
                          aria-label={`Delete ${u.name}`}
                          onClick={() => {
                            if (
                              window.confirm(
                                `Delete ${u.name} and all their tasks?`,
                              )
                            )
                              remove.mutate(u.id);
                          }}
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={page} total={query.data?.total || 0} onChange={setPage} />
      </section>
      {editor && (
        <UserEditor
          user={editor === "new" ? undefined : editor}
          onClose={() => setEditor(null)}
        />
      )}
    </>
  );
}
