import type React from "react";
export function Notice({ error }: { error: Error | null }) {
  return error ? (
    <p role="alert" className="notice">
      {error.message}
    </p>
  ) : null;
}
export function Field({
  label,
  error,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
}) {
  return (
    <label className="field">
      {label}
      <input {...props} aria-invalid={!!error} />
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}
export function Pager({
  page,
  total,
  onChange,
}: {
  page: number;
  total: number;
  onChange: (p: number) => void;
}) {
  return (
    <div className="pager">
      <span>
        {total} total · Page {page} of {Math.max(1, Math.ceil(total / 20))}
      </span>
      <button
        className="secondary"
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
      >
        Previous
      </button>
      <button
        className="secondary"
        disabled={page * 20 >= total}
        onClick={() => onChange(page + 1)}
      >
        Next
      </button>
    </div>
  );
}
