"use client";
// app/login/page.tsx
// Auth page: sign up + sign in via Supabase Auth
// Uses: supabase.auth.signUp(), supabase.auth.signInWithPassword(), supabase.auth.getUser()

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Suspense } from "react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? "/projects";

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "error" | "success";
    text: string;
  } | null>(null);

  const supabase = createClient();

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName || email.split("@")[0],
        },
      },
    });

    setLoading(false);

    if (error) {
      setMessage({ type: "error", text: error.message });
      return;
    }

    if (data.user && !data.user.email_confirmed_at) {
      setMessage({
        type: "success",
        text: "Account created. Check your email to confirm (or disable email confirmation in Supabase dashboard for testing).",
      });
    } else if (data.user) {
      setMessage({ type: "success", text: "Account created and confirmed!" });
      router.push(redirectTo);
      router.refresh();
    }
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setMessage({ type: "error", text: error.message });
      return;
    }

    router.push(redirectTo);
    router.refresh();
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
      }}
    >
      <div style={{ width: "100%", maxWidth: "400px" }}>
        <div style={{ marginBottom: "2rem", textAlign: "center" }}>
          <h1 className="page-title">Supabase Vibe Host</h1>
          <p className="page-subtitle">Test Board — Auth Capability Test</p>
          <div
            className="card"
            style={{ background: "rgba(99,102,241,0.08)", marginTop: "1rem" }}
          >
            <p
              style={{
                fontSize: "0.75rem",
                color: "var(--text-muted)",
                margin: 0,
              }}
            >
              <strong style={{ color: "var(--accent)" }}>FIXTURE A</strong> —
              This login form uses{" "}
              <code className="mono">supabase.auth.signInWithPassword()</code>{" "}
              and <code className="mono">supabase.auth.signUp()</code>.
            </p>
          </div>
        </div>

        {/* Tab switcher */}
        <div
          style={{
            display: "flex",
            background: "var(--bg-elevated)",
            borderRadius: "var(--radius-sm)",
            padding: "3px",
            marginBottom: "1.5rem",
            border: "1px solid var(--border)",
          }}
        >
          {(["signin", "signup"] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setMessage(null);
              }}
              style={{
                flex: 1,
                padding: "0.4rem",
                border: "none",
                borderRadius: "4px",
                background: mode === m ? "var(--accent)" : "transparent",
                color: mode === m ? "#fff" : "var(--text-secondary)",
                cursor: "pointer",
                fontSize: "0.875rem",
                fontWeight: 500,
                transition: "background 0.15s",
              }}
            >
              {m === "signin" ? "Sign In" : "Sign Up"}
            </button>
          ))}
        </div>

        {message && (
          <div
            className={`alert ${message.type === "error" ? "alert-error" : "alert-success"}`}
          >
            {message.text}
          </div>
        )}

        <form onSubmit={mode === "signup" ? handleSignUp : handleSignIn}>
          {mode === "signup" && (
            <div className="form-group">
              <label className="form-label" htmlFor="display-name">
                Display Name
              </label>
              <input
                id="display-name"
                className="form-input"
                type="text"
                placeholder="Your name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              className="form-input"
              type="email"
              placeholder="test@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              className="form-input"
              type="password"
              placeholder="Min 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
            />
          </div>

          <button
            id={mode === "signup" ? "btn-signup" : "btn-signin"}
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: "100%", justifyContent: "center" }}
          >
            {loading
              ? "..."
              : mode === "signup"
                ? "Create Account"
                : "Sign In"}
          </button>
        </form>

        <div style={{ marginTop: "1.5rem", textAlign: "center" }}>
          <a href="/diagnostics" style={{ fontSize: "0.8rem" }}>
            → Run diagnostics
          </a>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="loading">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}
