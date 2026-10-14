import { createContext, useContext, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navigate, Outlet } from "react-router-dom";
import { api, ApiError, type User, type Role } from "./api";
import { Notice } from "./components";
export const AuthContext = createContext<{
  user: User | null;
  loading: boolean;
  error: Error | null;
  refresh: () => void;
}>({ user: null, loading: true, error: null, refresh: () => {} });
export function AuthProvider({ children }: { children: ReactNode }) {
  const query = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      try {
        return (await api<{ user: User }>("/auth/me")).user;
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    retry: false,
  });
  return (
    <AuthContext.Provider
      value={{
        user: query.data ?? null,
        loading: query.isPending,
        error: query.error,
        refresh: () => void query.refetch(),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function ProtectedRoute({ roles }: { roles?: Role[] }) {
  const { user, loading, error, refresh } = useContext(AuthContext);
  if (loading) return <div className="screen">Checking your session…</div>;
  if (error)
    return (
      <div className="screen">
        <Notice error={error} />
        <button onClick={refresh}>Try again</button>
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role))
    return <Navigate to="/forbidden" replace />;
  return <Outlet />;
}
export function GuestRoute() {
  const { user, loading } = useContext(AuthContext);
  if (loading) return <div className="screen">Loading…</div>;
  return user ? (
    <Navigate to={user.role === "ADMIN" ? "/admin" : "/dashboard"} replace />
  ) : (
    <Outlet />
  );
}
export function Home() {
  const { user, loading } = useContext(AuthContext);
  return loading ? (
    <div className="screen">Loading…</div>
  ) : (
    <Navigate
      to={user ? (user.role === "ADMIN" ? "/admin" : "/dashboard") : "/login"}
      replace
    />
  );
}
