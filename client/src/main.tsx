import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { ApiError } from "./api";
import { AuthProvider, ProtectedRoute, GuestRoute, Home } from "./auth";
import { AuthForm } from "./AuthForm";
import { Layout } from "./Layout";
import { Dashboard } from "./Dashboard";
import { People } from "./People";
import "./style.css";
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (n, e) => !(e instanceof ApiError && e.status < 500) && n < 2,
      staleTime: 30_000,
    },
  },
});
function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route element={<GuestRoute />}>
            <Route path="/login" element={<AuthForm />} />
            <Route path="/register" element={<AuthForm register />} />
          </Route>
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route element={<ProtectedRoute roles={["ADMIN"]} />}>
                <Route path="/admin" element={<Dashboard />} />
                <Route path="/admin/users" element={<People />} />
              </Route>
              <Route
                path="/forbidden"
                element={
                  <div className="empty">
                    <ShieldCheck size={40} />
                    <h1>Access restricted</h1>
                    <p>You need Admin access to open this page.</p>
                    <Link className="primary" to="/dashboard">
                      Back to dashboard
                    </Link>
                  </div>
                }
              />
            </Route>
          </Route>
          <Route
            path="*"
            element={
              <div className="screen">
                <h1>Page not found</h1>
                <Link to="/">Return home</Link>
              </div>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
