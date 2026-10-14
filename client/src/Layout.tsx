import { useContext } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Check,
  LayoutDashboard,
  Users,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { AuthContext } from "./auth";
import { api, ApiError } from "./api";
import { Notice } from "./components";
export function Layout() {
  const { user } = useContext(AuthContext);
  const cache = useQueryClient(),
    navigate = useNavigate();
  const logout = useMutation({
    mutationFn: () => api("/auth/logout", "POST"),
    onSuccess: () => {
      cache.removeQueries({ predicate: (q) => q.queryKey[0] !== "session" });
      cache.setQueryData(["session"], null);
      navigate("/login");
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 401) {
        cache.removeQueries({ predicate: (q) => q.queryKey[0] !== "session" });
        cache.setQueryData(["session"], null);
        navigate("/login");
      }
    },
  });
  return (
    <div className="workspace">
      <aside className="sidebar">
        <Link className="brand" to="/">
          {" "}
          <span className="brand-icon">
            <Check size={22} />
          </span>{" "}
          taskroom.
        </Link>
        <div className="workspace-label">YOUR WORKSPACE</div>
        <nav>
          <NavLink to={user?.role === "ADMIN" ? "/admin" : "/dashboard"} end>
            <LayoutDashboard size={19} />
            Overview
          </NavLink>
          {user?.role === "ADMIN" && (
            <NavLink to="/admin/users">
              <Users size={19} />
              People
            </NavLink>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="account-avatar">{user?.name[0]}</div>
          <div>
            <strong>{user?.name}</strong>
            <small>
              {user?.role === "ADMIN" ? "Administrator" : "Personal workspace"}
            </small>
          </div>
          <button
            aria-label="Sign out"
            disabled={logout.isPending}
            onClick={() => logout.mutate()}
          >
            <LogOut size={18} />
          </button>
        </div>
        <Notice error={logout.error} />
      </aside>
      <main className="workspace-main">
        <header className="topbar">
          <span className="muted">
            Workspace /{" "}
            <strong>
              {user?.role === "ADMIN" ? "Administration" : "Overview"}
            </strong>
          </span>
          <span className="pill">
            <ShieldCheck size={14} />
            {user?.role === "ADMIN" ? "Admin access" : "User access"}
          </span>
        </header>
        <div className="page-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
