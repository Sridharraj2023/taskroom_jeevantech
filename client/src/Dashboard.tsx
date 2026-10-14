import { useContext, useState, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Layers,
  Clock,
  CheckCircle2,
  ArrowRight,
  Pencil,
  Trash2,
} from "lucide-react";
import { z } from "zod";
import { AuthContext } from "./auth";
import { api, type Task, type Page } from "./api";
import { Field, Notice, Pager } from "./components";
function TaskEditor({ task, onClose }: { task?: Task; onClose: () => void }) {
  const cache = useQueryClient();
  const [error, setError] = useState("");
  const mutation = useMutation({
    mutationFn: (body: unknown) =>
      api(`/tasks${task ? "/" + task.id : ""}`, task ? "PATCH" : "POST", body),
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ["tasks"] });
      onClose();
    },
  });
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input = Object.fromEntries(new FormData(e.currentTarget));
    const result = z
      .object({
        title: z.string().trim().min(1, "A title is required").max(160),
        description: z.string().max(2000),
        status: z.enum(["TODO", "IN_PROGRESS", "DONE"]),
      })
      .safeParse(input);
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
        aria-labelledby="editor-title"
      >
        <h2 id="editor-title">{task ? "Edit task" : "A new next step"}</h2>
        <form onSubmit={submit}>
          <Field
            label="Task title"
            name="title"
            autoFocus
            defaultValue={task?.title}
            maxLength={160}
            required
          />
          <label className="field">
            Description
            <textarea
              name="description"
              defaultValue={task?.description}
              maxLength={2000}
              rows={3}
            />
          </label>
          <label className="field">
            Status
            <select name="status" defaultValue={task?.status || "TODO"}>
              <option value="TODO">To do</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="DONE">Done</option>
            </select>
          </label>
          {error && (
            <p role="alert" className="notice">
              {error}
            </p>
          )}
          <Notice error={mutation.error} />
          <div className="flex justify-end gap-3">
            <button type="button" className="secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="primary" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : "Save task"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
export function Dashboard() {
  const { user } = useContext(AuthContext);
  const [page, setPage] = useState(1),
    [editor, setEditor] = useState<Task | "new" | null>(null);
  const cache = useQueryClient();
  const query = useQuery({
    queryKey: ["tasks", page],
    queryFn: () => api<Page<Task>>(`/tasks?page=${page}`),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/tasks/${id}`, "DELETE"),
    onSuccess: () => void cache.invalidateQueries({ queryKey: ["tasks"] }),
  });
  const tasks = query.data?.items || [];
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">LET’S MAKE TODAY COUNT</span>
          <h1>
            Hello, {user?.name.split(" ")[0]}
            <span className="heading-dot">.</span>
          </h1>
          <p className="muted">
            {user?.role === "ADMIN"
              ? "A clear view of everything your team is working on."
              : "A little progress, every day. Here’s what’s on your plate."}
          </p>
        </div>
        <button className="primary" onClick={() => setEditor("new")}>
          <Plus size={18} />
          New task
        </button>
      </div>
      <div className="stats">
        {[
          {
            label: "Total tasks",
            value: query.data?.total ?? "—",
            icon: Layers,
          },
          {
            label: "In progress on this page",
            value: tasks.filter((t) => t.status === "IN_PROGRESS").length,
            icon: Clock,
          },
          {
            label: "Completed on this page",
            value: tasks.filter((t) => t.status === "DONE").length,
            icon: CheckCircle2,
          },
        ].map((s) => (
          <div className="stat" key={s.label}>
            <span className="stat-icon">
              <s.icon size={20} />
            </span>
            <span className="muted text-sm">{s.label}</span>
            <strong>{s.value}</strong>
          </div>
        ))}
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>{user?.role === "ADMIN" ? "Team tasks" : "Your tasks"}</h2>
            <p className="muted text-sm">Small steps. Meaningful progress.</p>
          </div>
          <span className="pill">{query.data?.total ?? 0} tasks</span>
        </div>
        <Notice error={query.error} />
        <Notice error={remove.error} />
        {query.isPending ? (
          <div className="empty">Loading your tasks…</div>
        ) : query.isError ? (
          <div className="empty">
            <button className="secondary" onClick={() => void query.refetch()}>
              Try again
            </button>
          </div>
        ) : tasks.length === 0 ? (
          <div className="empty">
            <span className="empty-icon">
              <CheckCircle2 size={32} />
            </span>
            <h3>A fresh start.</h3>
            <p className="muted">
              Add a task and turn your plans into progress.
            </p>
            <button className="secondary" onClick={() => setEditor("new")}>
              Create your first task <ArrowRight size={16} />
            </button>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Task</th>
                  {user?.role === "ADMIN" && <th>Owner</th>}
                  <th>Status</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <strong>{t.title}</strong>
                      <small>{t.description}</small>
                    </td>
                    {user?.role === "ADMIN" && <td>{t.owner_name}</td>}
                    <td>
                      <span className={`status ${t.status}`}>
                        {t.status.replaceAll("_", " ").toLowerCase()}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button
                          aria-label={`Edit ${t.title}`}
                          onClick={() => setEditor(t)}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          aria-label={`Delete ${t.title}`}
                          disabled={remove.isPending}
                          onClick={() => {
                            if (window.confirm(`Delete “${t.title}”?`))
                              remove.mutate(t.id);
                          }}
                        >
                          <Trash2 size={16} />
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
        <TaskEditor
          task={editor === "new" ? undefined : editor}
          onClose={() => setEditor(null)}
        />
      )}
    </>
  );
}
