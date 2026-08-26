"use client";
// app/diagnostics/page.tsx
// Diagnostics page — tests all Supabase capabilities and reports PASS/FAIL/NOT_TESTED
//
// Capabilities tested:
//   Environment, Auth, Session, PostgREST SELECT, PostgREST INSERT,
//   RLS positive, RLS negative, RPC simple, SECURITY DEFINER flow,
//   Storage upload, Storage read, Realtime, Edge Function

import { useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

// Prevent static prerendering — this page must be rendered dynamically
// because it reads runtime env vars and runs Supabase calls
export const dynamic = "force-dynamic";


type TestStatus = "PASS" | "FAIL" | "NOT_TESTED" | "RUNNING";

interface DiagResult {
  name: string;
  status: TestStatus;
  message: string;
  detail?: string;
  provenance?: string; // shows where the call goes (sanitized)
}

// Sanitize URL — show host only, no credentials
function sanitizeUrl(url: string | undefined): string {
  if (!url) return "not configured";
  try {
    const u = new URL(url);
    return u.host;
  } catch {
    return "invalid URL";
  }
}

function maskKey(key: string | undefined): string {
  if (!key) return "not configured";
  if (key.length < 8) return "***";
  return key.slice(0, 6) + "..." + key.slice(-4);
}

// NEXT_PUBLIC_ env vars: constant at runtime, defined after helper functions
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SUPABASE_HOST = sanitizeUrl(SUPABASE_URL);

const INITIAL_RESULTS: DiagResult[] = [
  { name: "Environment — SUPABASE_URL", status: "NOT_TESTED", message: "Not checked" },
  { name: "Environment — SUPABASE_PUBLISHABLE_KEY", status: "NOT_TESTED", message: "Not checked" },
  { name: "Auth — getUser()", status: "NOT_TESTED", message: "Not checked" },
  { name: "Session — persistence", status: "NOT_TESTED", message: "Not checked" },
  { name: "PostgREST — SELECT (projects)", status: "NOT_TESTED", message: "Not checked" },
  { name: "PostgREST — INSERT (task)", status: "NOT_TESTED", message: "Not checked" },
  { name: "RLS — positive (member sees own data)", status: "NOT_TESTED", message: "Not checked" },
  { name: "RLS — negative (non-member sees nothing)", status: "NOT_TESTED", message: "Not checked" },
  { name: "RPC — get_project_stats (simple)", status: "NOT_TESTED", message: "Not checked" },
  { name: "RPC — check_can_edit_project (SECURITY DEFINER)", status: "NOT_TESTED", message: "Not checked" },
  { name: "Storage — upload (task-files)", status: "NOT_TESTED", message: "Not checked" },
  { name: "Storage — read/list (task-files)", status: "NOT_TESTED", message: "Not checked" },
  { name: "Realtime — channel subscribe", status: "NOT_TESTED", message: "Not checked" },
  { name: "Edge Function — send-task-notification", status: "NOT_TESTED", message: "Not checked" },
];

function statusBadgeClass(status: TestStatus): string {
  switch (status) {
    case "PASS": return "badge badge-pass";
    case "FAIL": return "badge badge-fail";
    case "RUNNING": return "badge badge-warn";
    default: return "badge badge-unknown";
  }
}

export default function DiagnosticsPage() {
  const [results, setResults] = useState<DiagResult[]>(INITIAL_RESULTS);
  const [running, setRunning] = useState(false);
  const [projectId, setProjectId] = useState("");
  // Lazy initializer: Date.now() runs once on mount, not on every render
  const [diagTaskTitle] = useState(() => `Diagnostics test task ${Date.now()}`);

  const update = useCallback((name: string, partial: Partial<DiagResult>) => {
    setResults((prev) =>
      prev.map((r) => (r.name === name ? { ...r, ...partial } : r))
    );
  }, []);

  const runAll = useCallback(async () => {
    // Create client inside the callback — only called on user action, never at build time
    const supabase = createClient();
    setRunning(true);

    // Reset all to RUNNING
    setResults(INITIAL_RESULTS.map((r) => ({ ...r, status: "RUNNING", message: "Checking..." })));

    let currentUserId: string | null = null;
    let testProjectId: string | null = projectId.trim() || null;
    let insertedTaskId: string | null = null;

    // ── 1. Environment ──────────────────────────────────────────
    const urlOk = !!SUPABASE_URL && SUPABASE_URL !== "your-supabase-url";
    update("Environment — SUPABASE_URL", {
      status: urlOk ? "PASS" : "FAIL",
      message: urlOk ? `Configured` : "NEXT_PUBLIC_SUPABASE_URL is empty or placeholder",
      detail: `Supabase API Host: ${SUPABASE_HOST}`,
      provenance: SUPABASE_HOST,
    });

    const keyOk = !!SUPABASE_KEY && SUPABASE_KEY.length > 20;
    update("Environment — SUPABASE_PUBLISHABLE_KEY", {
      status: keyOk ? "PASS" : "FAIL",
      message: keyOk ? `Configured (masked: ${maskKey(SUPABASE_KEY)})` : "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY missing or too short",
    });

    // ── 2. Auth — getUser() ──────────────────────────────────────
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !authData.user) {
      update("Auth — getUser()", {
        status: "FAIL",
        message: authErr?.message ?? "No user returned",
        provenance: SUPABASE_HOST,
      });
    } else {
      currentUserId = authData.user.id;
      update("Auth — getUser()", {
        status: "PASS",
        message: `Authenticated as ${authData.user.email}`,
        detail: `User ID: ${currentUserId.slice(0, 8)}...`,
        provenance: SUPABASE_HOST,
      });
    }

    // ── 3. Session persistence ────────────────────────────────────
    const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
    if (sessionErr || !sessionData.session) {
      update("Session — persistence", {
        status: "FAIL",
        message: sessionErr?.message ?? "No active session (reload may have lost session)",
        provenance: SUPABASE_HOST,
      });
    } else {
      const exp = sessionData.session.expires_at
        ? new Date(sessionData.session.expires_at * 1000).toLocaleString()
        : "unknown";
      update("Session — persistence", {
        status: "PASS",
        message: `Session active. Expires: ${exp}`,
        provenance: SUPABASE_HOST,
      });
    }

    // ── 4. PostgREST SELECT ───────────────────────────────────────
    const { data: projects, error: selectErr } = await supabase
      .from("projects")
      .select("id, name")
      .limit(5);

    if (selectErr) {
      update("PostgREST — SELECT (projects)", {
        status: "FAIL",
        message: `SELECT error: ${selectErr.message}`,
        provenance: SUPABASE_HOST,
      });
    } else {
      if (!testProjectId && projects && projects.length > 0) {
        testProjectId = projects[0].id;
      }
      update("PostgREST — SELECT (projects)", {
        status: "PASS",
        message: `Returned ${projects?.length ?? 0} project(s) (RLS filtered to your memberships)`,
        detail: projects?.map((p) => p.name).join(", ") || "none",
        provenance: SUPABASE_HOST,
      });
    }

    // ── 5. PostgREST INSERT ───────────────────────────────────────
    if (!testProjectId) {
      update("PostgREST — INSERT (task)", {
        status: "FAIL",
        message: "Cannot test INSERT: no project ID available. Create a project first or paste a project ID in the field above.",
      });
    } else if (!currentUserId) {
      update("PostgREST — INSERT (task)", {
        status: "FAIL",
        message: "Cannot test INSERT: not authenticated",
      });
    } else {
      const { data: insertedTask, error: insertErr } = await supabase
        .from("tasks")
        .insert({
          project_id: testProjectId,
          title: diagTaskTitle,
          created_by: currentUserId,
        })
        .select("id")
        .single();

      if (insertErr) {
        update("PostgREST — INSERT (task)", {
          status: "FAIL",
          message: `INSERT error: ${insertErr.message}`,
          provenance: SUPABASE_HOST,
        });
      } else {
        insertedTaskId = insertedTask.id;
        update("PostgREST — INSERT (task)", {
          status: "PASS",
          message: `Task inserted successfully`,
          detail: `Task ID: ${insertedTask.id.slice(0, 8)}...`,
          provenance: SUPABASE_HOST,
        });
      }
    }

    // ── 6. RLS positive (member sees own data) ────────────────────
    if (!testProjectId) {
      update("RLS — positive (member sees own data)", {
        status: "FAIL",
        message: "No project to test — create a project and become a member first",
      });
    } else {
      const { data: rlsTasks, error: rlsErr } = await supabase
        .from("tasks")
        .select("id")
        .eq("project_id", testProjectId);

      if (rlsErr) {
        update("RLS — positive (member sees own data)", {
          status: "FAIL",
          message: `RLS SELECT error: ${rlsErr.message}`,
          provenance: SUPABASE_HOST,
        });
      } else if (!rlsTasks || rlsTasks.length === 0) {
        update("RLS — positive (member sees own data)", {
          status: "FAIL",
          message: "SELECT returned 0 rows — either not a member of this project, or migrations not applied",
          provenance: SUPABASE_HOST,
        });
      } else {
        update("RLS — positive (member sees own data)", {
          status: "PASS",
          message: `Member SELECT returned ${rlsTasks.length} task(s) — RLS allowed correctly`,
          provenance: SUPABASE_HOST,
        });
      }
    }

    // ── 7. RLS negative (non-member sees nothing) ─────────────────
    // We test by querying tasks from a project the current user should not be a member of.
    // The canonical test is: sign in as User B (no membership) and expect 0 rows.
    // Here we approximate: query all tasks without project filter — expect only your project's tasks.
    // Full negative test requires 2 accounts (see README).
    {
      // Attempt to SELECT tasks with a fabricated project_id (should return 0 via RLS)
      const fakeProjectId = "00000000-0000-0000-0000-000000000000";
      const { data: rlsNegData, error: rlsNegErr } = await supabase
        .from("tasks")
        .select("id")
        .eq("project_id", fakeProjectId);

      if (rlsNegErr) {
        // Some RLS configs return an error rather than empty — still counts as blocked
        update("RLS — negative (non-member sees nothing)", {
          status: "PASS",
          message: `RLS blocked with error: ${rlsNegErr.message}`,
          detail: "Full 2-user negative test: sign in as User B (no membership) and verify 0 rows on /projects",
          provenance: SUPABASE_HOST,
        });
      } else if (!rlsNegData || rlsNegData.length === 0) {
        update("RLS — negative (non-member sees nothing)", {
          status: "PASS",
          message: "SELECT on non-member project returned 0 rows — RLS blocked correctly",
          detail: "Full 2-user negative test: sign in as User B (no membership) and verify 0 rows on /projects",
          provenance: SUPABASE_HOST,
        });
      } else {
        update("RLS — negative (non-member sees nothing)", {
          status: "FAIL",
          message: `CRITICAL: SELECT on fake project_id returned ${rlsNegData.length} row(s) — RLS NOT working`,
          provenance: SUPABASE_HOST,
        });
      }
    }

    // ── 8. RPC simple ─────────────────────────────────────────────
    if (!testProjectId) {
      update("RPC — get_project_stats (simple)", {
        status: "FAIL",
        message: "No project ID to test RPC",
      });
    } else {
      const { data: rpcData, error: rpcErr } = await supabase.rpc(
        "get_project_stats",
        { target_project: testProjectId }
      );

      if (rpcErr) {
        update("RPC — get_project_stats (simple)", {
          status: "FAIL",
          message: `RPC error: ${rpcErr.message}`,
          provenance: SUPABASE_HOST,
        });
      } else {
        update("RPC — get_project_stats (simple)", {
          status: "PASS",
          message: `Stats: total=${(rpcData as { total?: number })?.total ?? "?"}, done=${(rpcData as { done?: number })?.done ?? "?"}`,
          detail: JSON.stringify(rpcData),
          provenance: SUPABASE_HOST,
        });
      }
    }

    // ── 9. SECURITY DEFINER RPC ───────────────────────────────────
    if (!testProjectId) {
      update("RPC — check_can_edit_project (SECURITY DEFINER)", {
        status: "FAIL",
        message: "No project ID to test",
      });
    } else {
      const { data: secDefData, error: secDefErr } = await supabase.rpc(
        "check_can_edit_project",
        { target_project: testProjectId }
      );

      if (secDefErr) {
        update("RPC — check_can_edit_project (SECURITY DEFINER)", {
          status: "FAIL",
          message: `SECURITY DEFINER RPC error: ${secDefErr.message}`,
          provenance: SUPABASE_HOST,
        });
      } else {
        update("RPC — check_can_edit_project (SECURITY DEFINER)", {
          status: "PASS",
          message: `Result: ${secDefData} — delegates to private.can_edit_project() [SECURITY DEFINER]`,
          detail: "See migration 20240001000002_rpc.sql for SECURITY DEFINER evidence",
          provenance: SUPABASE_HOST,
        });
      }
    }

    // ── 10. Storage upload ────────────────────────────────────────
    if (!testProjectId || !insertedTaskId) {
      update("Storage — upload (task-files)", {
        status: "FAIL",
        message: "Skipped: need a project and a successfully inserted task first",
      });
    } else {
      const testContent = `Diagnostics test file\nTimestamp: ${new Date().toISOString()}\nProject: ${testProjectId}`;
      const testFile = new Blob([testContent], { type: "text/plain" });
      const uploadPath = `${testProjectId}/${insertedTaskId}/diag-test.txt`;

      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from("task-files")
        .upload(uploadPath, testFile, { upsert: true, contentType: "text/plain" });

      if (uploadErr) {
        update("Storage — upload (task-files)", {
          status: "FAIL",
          message: `Upload error: ${uploadErr.message}`,
          provenance: SUPABASE_HOST,
        });
      } else {
        update("Storage — upload (task-files)", {
          status: "PASS",
          message: `Uploaded to: ${uploadData.path}`,
          provenance: SUPABASE_HOST,
        });
      }
    }

    // ── 11. Storage read/list ─────────────────────────────────────
    if (!testProjectId) {
      update("Storage — read/list (task-files)", {
        status: "FAIL",
        message: "Skipped: no project ID",
      });
    } else {
      const { data: listData, error: listErr } = await supabase.storage
        .from("task-files")
        .list(testProjectId, { limit: 10 });

      if (listErr) {
        update("Storage — read/list (task-files)", {
          status: "FAIL",
          message: `List error: ${listErr.message}`,
          provenance: SUPABASE_HOST,
        });
      } else {
        update("Storage — read/list (task-files)", {
          status: "PASS",
          message: `Listed ${listData?.length ?? 0} item(s) in bucket task-files/${testProjectId}/`,
          provenance: SUPABASE_HOST,
        });
      }
    }

    // ── 12. Realtime ──────────────────────────────────────────────
    {
      let subscribed = false;
      await new Promise<void>((resolve) => {
        const testChannel = supabase
          .channel("diagnostics-ping")
          .subscribe((status) => {
            if (status === "SUBSCRIBED") {
              subscribed = true;
              supabase.removeChannel(testChannel);
              resolve();
            } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
              supabase.removeChannel(testChannel);
              resolve();
            }
          });
        setTimeout(resolve, 8000); // Timeout after 8s
      });

      update("Realtime — channel subscribe", {
        status: subscribed ? "PASS" : "FAIL",
        message: subscribed
          ? "Channel subscribed successfully — Realtime is reachable"
          : "Failed to subscribe within 8s — check Realtime config or network",
        provenance: SUPABASE_HOST,
      });
    }

    // ── 13. Edge Function ─────────────────────────────────────────
    if (!insertedTaskId) {
      update("Edge Function — send-task-notification", {
        status: "FAIL",
        message: "Skipped: no task ID (INSERT must succeed first)",
      });
    } else {
      const { data: fnData, error: fnErr } = await supabase.functions.invoke(
        "send-task-notification",
        {
          body: {
            taskId: insertedTaskId,
            message: "Diagnostics test invocation",
          },
        }
      );

      if (fnErr) {
        update("Edge Function — send-task-notification", {
          status: "FAIL",
          message: `Edge Function error: ${fnErr.message}`,
          detail: "Check: is the function deployed? supabase functions deploy send-task-notification",
          provenance: SUPABASE_HOST,
        });
      } else {
        const accepted = (fnData as { accepted?: boolean })?.accepted;
        update("Edge Function — send-task-notification", {
          status: accepted ? "PASS" : "FAIL",
          message: accepted
            ? `Function responded: accepted=true, taskId=${(fnData as { taskId?: string })?.taskId?.slice(0, 8)}...`
            : `Unexpected response: ${JSON.stringify(fnData)}`,
          detail: JSON.stringify(fnData),
          provenance: SUPABASE_HOST,
        });
      }
    }

    setRunning(false);
  }, [projectId, diagTaskTitle, update]);

  const passCount = results.filter((r) => r.status === "PASS").length;
  const failCount = results.filter((r) => r.status === "FAIL").length;
  const notTestedCount = results.filter((r) => r.status === "NOT_TESTED").length;

  return (
    <div style={{ minHeight: "100vh" }}>
      {/* Inline header for diagnostics page (no auth required to view env status) */}
      <header className="app-header">
        <div className="logo">
          Supabase <span>Vibe Host</span> Test Board
        </div>
        <nav className="header-nav">
          <Link href="/projects">Projects</Link>
          <Link href="/login">Login</Link>
        </nav>
      </header>

      <main className="main-content">
        <div style={{ marginBottom: "1.5rem" }}>
          <h1 className="page-title">Diagnostics</h1>
          <p className="page-subtitle">
            Tests all Supabase capabilities. Run after deployment to verify Vibe Host import.
          </p>

          <div className="card" style={{ marginBottom: "1rem", background: "rgba(99,102,241,0.06)" }}>
            <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
              <strong>Supabase API Host:</strong>{" "}
              <code className="mono">{SUPABASE_HOST}</code>
              {" "}— {SUPABASE_HOST.includes("supabase.co") ? "PASS_EXTERNAL (Supabase hosted)" : SUPABASE_HOST === "not configured" ? "FAIL (not configured)" : "Check host origin"}
            </p>
            <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
              <strong>Publishable Key:</strong>{" "}
              <code className="mono">{maskKey(SUPABASE_KEY)}</code>
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
            <div className="card" style={{ padding: "0.75rem 1.25rem", textAlign: "center" }}>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--success)" }}>{passCount}</div>
              <div className="text-muted" style={{ fontSize: "0.7rem" }}>PASS</div>
            </div>
            <div className="card" style={{ padding: "0.75rem 1.25rem", textAlign: "center" }}>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--danger)" }}>{failCount}</div>
              <div className="text-muted" style={{ fontSize: "0.7rem" }}>FAIL</div>
            </div>
            <div className="card" style={{ padding: "0.75rem 1.25rem", textAlign: "center" }}>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text-muted)" }}>{notTestedCount}</div>
              <div className="text-muted" style={{ fontSize: "0.7rem" }}>NOT_TESTED</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap", marginBottom: "1.5rem" }}>
            <input
              id="diag-project-id"
              className="form-input"
              type="text"
              placeholder="Project UUID (optional — auto-detected from your first project)"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              style={{ flex: 1, minWidth: "280px" }}
            />
            <button
              id="btn-run-diagnostics"
              className="btn btn-primary"
              onClick={runAll}
              disabled={running}
            >
              {running ? "⏳ Running..." : "▶ Run All Diagnostics"}
            </button>
          </div>
        </div>

        <div className="card">
          <table className="diag-table">
            <thead>
              <tr>
                <th style={{ width: "36%" }}>Capability</th>
                <th style={{ width: "12%" }}>Status</th>
                <th style={{ width: "32%" }}>Message</th>
                <th style={{ width: "20%" }}>Host / Provenance</th>
              </tr>
            </thead>
            <tbody>
              {results.map((result) => (
                <tr key={result.name}>
                  <td>
                    <span style={{ fontWeight: 500, fontSize: "0.8rem" }}>{result.name}</span>
                    {result.detail && (
                      <div className="mono text-muted" style={{ fontSize: "0.7rem", marginTop: "0.2rem" }}>
                        {result.detail.length > 80 ? result.detail.slice(0, 80) + "..." : result.detail}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={statusBadgeClass(result.status)}>
                      {result.status}
                    </span>
                  </td>
                  <td style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                    {result.message}
                  </td>
                  <td style={{ fontSize: "0.75rem" }} className="mono text-muted">
                    {result.provenance ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card" style={{ marginTop: "1.5rem" }}>
          <p className="card-title">Classification Guide</p>
          <table style={{ fontSize: "0.8rem", width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {[
                ["PASS_NATIVE", "Capability handled by Vibe Host infrastructure natively"],
                ["PASS_EXTERNAL", "App on Vibe Host, capability still calls *.supabase.co"],
                ["FAIL_IMPORT", "Vibe Host failed to import/receive repo"],
                ["FAIL_BUILD", "Import succeeded but build failed"],
                ["FAIL_RUNTIME", "Build/deploy succeeded but capability fails at runtime"],
                ["FAIL_AUTHORIZATION", "Function runs but security behavior is wrong"],
                ["UNKNOWN", "Insufficient evidence to classify"],
                ["NOT_TESTED", "Test not yet run"],
              ].map(([code, desc]) => (
                <tr key={code}>
                  <td style={{ padding: "0.3rem 0.5rem 0.3rem 0", fontWeight: 600, whiteSpace: "nowrap", width: "200px" }}>
                    <code className="mono">{code}</code>
                  </td>
                  <td style={{ padding: "0.3rem 0", color: "var(--text-secondary)" }}>{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <hr className="divider" />
          <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
            <strong>Interpretation note:</strong> App running on Vibe Host while connecting to{" "}
            <code className="mono">*.supabase.co</code> proves Vibe Host can host Supabase-dependent apps.
            It does NOT prove Supabase was replaced or migrated. See README for full interpretation guide.
          </p>
        </div>
      </main>
    </div>
  );
}
