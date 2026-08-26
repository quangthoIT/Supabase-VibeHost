"use client";
// app/projects/[id]/ProjectBoard.tsx
// Client Component: handles Realtime, Storage upload, RPC, Edge Function
//
// Supabase capabilities exercised here:
//   - supabase.channel(...).on('postgres_changes', ...).subscribe()  [Realtime]
//   - supabase.from('tasks').insert()                                [PostgREST INSERT]
//   - supabase.from('tasks').update()                                [PostgREST UPDATE]
//   - supabase.storage.from('task-files').upload()                   [Storage]
//   - supabase.storage.from('task-files').list()                     [Storage read]
//   - supabase.rpc('get_project_stats', ...)                         [RPC simple]
//   - supabase.rpc('check_can_edit_project', ...)                    [SECURITY DEFINER wrapper]
//   - supabase.functions.invoke('send-task-notification', ...)       [Edge Function]

import { useEffect, useState, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

interface Task {
  id: string;
  title: string;
  description: string | null;
  completed: boolean;
  file_path: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface ProjectStats {
  total: number;
  done: number;
  todo: number;
  project_id: string;
}

interface Props {
  project: {
    id: string;
    name: string;
    description: string | null;
    created_by: string;
    created_at: string;
  };
  userRole: string | null;
  currentUserId: string;
  members: { user_id: string; role: string }[];
  initialTasks: Task[];
}

export function ProjectBoard({ project, userRole, currentUserId, members, initialTasks }: Props) {
  const supabase = createClient();

  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [realtimeStatus, setRealtimeStatus] = useState<"connecting" | "subscribed" | "error">("connecting");
  const [realtimeEvents, setRealtimeEvents] = useState<string[]>([]);

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [taskLoading, setTaskLoading] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);

  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  const [canEdit, setCanEdit] = useState<boolean | null>(null);

  const [edgeFnResult, setEdgeFnResult] = useState<string | null>(null);
  const [edgeFnLoading, setEdgeFnLoading] = useState(false);
  const [edgeFnError, setEdgeFnError] = useState<string | null>(null);

  const [uploadingTaskId, setUploadingTaskId] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [addMemberUserId, setAddMemberUserId] = useState("");
  const [addMemberRole, setAddMemberRole] = useState<"editor" | "viewer">("viewer");
  const [addMemberLoading, setAddMemberLoading] = useState(false);
  const [addMemberMsg, setAddMemberMsg] = useState<string | null>(null);

  const canWrite = userRole === "owner" || userRole === "editor";
  const isOwner = userRole === "owner";

  // ---- Realtime subscription ----
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    const channel = supabase
      .channel(`project:${project.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: `project_id=eq.${project.id}`,
        },
        (payload) => {
          const eventLabel = `[${new Date().toLocaleTimeString()}] ${payload.eventType}: ${
            (payload.new as Task)?.title ?? (payload.old as Task)?.id ?? "?"
          }`;
          setRealtimeEvents((prev) => [eventLabel, ...prev.slice(0, 9)]);

          if (payload.eventType === "INSERT") {
            setTasks((prev) => {
              if (prev.find((t) => t.id === (payload.new as Task).id)) return prev;
              return [...prev, payload.new as Task];
            });
          } else if (payload.eventType === "UPDATE") {
            setTasks((prev) =>
              prev.map((t) => (t.id === (payload.new as Task).id ? (payload.new as Task) : t))
            );
          } else if (payload.eventType === "DELETE") {
            setTasks((prev) => prev.filter((t) => t.id !== (payload.old as { id: string }).id));
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setRealtimeStatus("subscribed");
        else if (status === "CHANNEL_ERROR") setRealtimeStatus("error");
      });

    channelRef.current = channel;

    return () => {
      // Cleanup — unsubscribe on unmount
      supabase.removeChannel(channel);
    };
  }, [project.id, supabase]);

  // ---- Load RPC stats ----
  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError(null);
    const { data, error } = await supabase.rpc("get_project_stats", {
      target_project: project.id,
    });
    setStatsLoading(false);
    if (error) {
      setStatsError(error.message);
    } else {
      setStats(data as ProjectStats);
    }
  }, [project.id, supabase]);

  // ---- Check SECURITY DEFINER via wrapper RPC ----
  const checkCanEdit = useCallback(async () => {
    const { data, error } = await supabase.rpc("check_can_edit_project", {
      target_project: project.id,
    });
    if (!error) setCanEdit(data as boolean);
  }, [project.id, supabase]);

  useEffect(() => {
    loadStats();
    checkCanEdit();
  }, [loadStats, checkCanEdit]);

  // ---- Create task ----
  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    setTaskLoading(true);
    setTaskError(null);

    const { error } = await supabase.from("tasks").insert({
      project_id: project.id,
      title: newTaskTitle.trim(),
      created_by: currentUserId,
    });

    setTaskLoading(false);
    if (error) {
      setTaskError(error.message);
    } else {
      setNewTaskTitle("");
      loadStats();
    }
  }

  // ---- Toggle task complete ----
  async function handleToggleComplete(task: Task) {
    if (!canWrite) return;
    const { error } = await supabase
      .from("tasks")
      .update({ completed: !task.completed })
      .eq("id", task.id);
    if (!error) loadStats();
  }

  // ---- Storage upload ----
  async function handleFileUpload(taskId: string, file: File) {
    setUploadingTaskId(taskId);
    setUploadResult(null);
    setUploadError(null);

    const path = `${project.id}/${taskId}/${Date.now()}-${file.name}`;

    const { data, error } = await supabase.storage
      .from("task-files")
      .upload(path, file, { upsert: true });

    setUploadingTaskId(null);

    if (error) {
      setUploadError(`Upload failed: ${error.message}`);
      return;
    }

    // Update task with file_path
    await supabase.from("tasks").update({ file_path: data.path }).eq("id", taskId);

    setUploadResult(`Uploaded: ${data.path}`);
    loadStats();
  }

  // ---- Edge Function invoke ----
  async function handleEdgeFn(taskId: string) {
    setEdgeFnLoading(true);
    setEdgeFnError(null);
    setEdgeFnResult(null);

    const { data, error } = await supabase.functions.invoke(
      "send-task-notification",
      {
        body: { taskId, message: "Test notification from Vibe Host fixture" },
      }
    );

    setEdgeFnLoading(false);
    if (error) {
      setEdgeFnError(`Edge Function error: ${error.message}`);
    } else {
      setEdgeFnResult(JSON.stringify(data, null, 2));
    }
  }

  // ---- Add member ----
  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    if (!addMemberUserId.trim()) return;
    setAddMemberLoading(true);
    setAddMemberMsg(null);

    const { error } = await supabase.from("project_members").insert({
      project_id: project.id,
      user_id: addMemberUserId.trim(),
      role: addMemberRole,
    });

    setAddMemberLoading(false);
    if (error) {
      setAddMemberMsg(`Error: ${error.message}`);
    } else {
      setAddMemberMsg(`Added as ${addMemberRole}`);
      setAddMemberUserId("");
    }
  }

  return (
    <div>
      {/* Project header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.25rem" }}>
          <h1 className="page-title" style={{ marginBottom: 0 }}>{project.name}</h1>
          {userRole && <span className="tag">{userRole}</span>}
        </div>
        {project.description && (
          <p className="page-subtitle">{project.description}</p>
        )}
        <p className="text-muted" style={{ fontSize: "0.75rem" }}>
          Project ID: <code className="mono">{project.id}</code>
        </p>
      </div>

      {/* Realtime status bar */}
      <div className="card" style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
          <span
            className={realtimeStatus === "subscribed" ? "realtime-dot" : ""}
            style={{
              width: 8, height: 8, borderRadius: "50%",
              background: realtimeStatus === "subscribed" ? "var(--success)" : realtimeStatus === "error" ? "var(--danger)" : "var(--warning)",
              display: "inline-block",
            }}
          />
          <strong style={{ fontSize: "0.8rem" }}>
            Realtime: {realtimeStatus.toUpperCase()}
          </strong>
          <span className="text-muted" style={{ fontSize: "0.75rem" }}>
            — Channel: project:{project.id.slice(0, 8)}...
          </span>
        </div>
        {realtimeEvents.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            {realtimeEvents.map((ev, i) => (
              <span key={i} className="mono text-muted" style={{ fontSize: "0.75rem" }}>
                {ev}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-muted" style={{ fontSize: "0.75rem" }}>
            No events yet. Open in another browser tab and create/update a task.
          </p>
        )}
      </div>

      <div className="grid-2" style={{ marginBottom: "1rem" }}>
        {/* RPC Stats */}
        <div className="card">
          <p className="card-title">RPC — get_project_stats</p>
          {statsLoading && <p className="loading">Loading stats...</p>}
          {statsError && <p className="text-danger" style={{ fontSize: "0.8rem" }}>{statsError}</p>}
          {stats && !statsLoading && (
            <div style={{ display: "flex", gap: "1.5rem" }}>
              <div>
                <div style={{ fontSize: "1.75rem", fontWeight: 700 }}>{stats.total}</div>
                <div className="text-muted" style={{ fontSize: "0.75rem" }}>Total</div>
              </div>
              <div>
                <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--success)" }}>{stats.done}</div>
                <div className="text-muted" style={{ fontSize: "0.75rem" }}>Done</div>
              </div>
              <div>
                <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--warning)" }}>{stats.todo}</div>
                <div className="text-muted" style={{ fontSize: "0.75rem" }}>Todo</div>
              </div>
            </div>
          )}
          <button onClick={loadStats} className="btn btn-secondary btn-sm" style={{ marginTop: "0.75rem" }}>
            Refresh Stats
          </button>
        </div>

        {/* SECURITY DEFINER check */}
        <div className="card">
          <p className="card-title">RPC — check_can_edit_project (SECURITY DEFINER)</p>
          <p style={{ fontSize: "0.875rem", marginBottom: "0.5rem" }}>
            Can you edit this project?{" "}
            <strong style={{ color: canEdit === null ? "var(--text-muted)" : canEdit ? "var(--success)" : "var(--danger)" }}>
              {canEdit === null ? "Checking..." : canEdit ? "YES" : "NO"}
            </strong>
          </p>
          <p className="text-muted" style={{ fontSize: "0.75rem" }}>
            Calls <code className="mono">check_can_edit_project()</code> → delegates to{" "}
            <code className="mono">private.can_edit_project()</code> (SECURITY DEFINER).
          </p>
          <button onClick={checkCanEdit} className="btn btn-secondary btn-sm" style={{ marginTop: "0.75rem" }}>
            Recheck
          </button>
        </div>
      </div>

      {/* Members */}
      <div className="card" style={{ marginBottom: "1rem" }}>
        <p className="card-title">Members ({members.length})</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.75rem" }}>
          {members.map((m) => (
            <div key={m.user_id} style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              padding: "0.25rem 0.5rem",
              fontSize: "0.75rem",
            }}>
              <code className="mono">{m.user_id.slice(0, 8)}...</code>
              {" "}<span className="tag">{m.role}</span>
              {m.user_id === currentUserId && <span className="text-muted"> (you)</span>}
            </div>
          ))}
        </div>

        {/* Add member — owner only (RLS test) */}
        {isOwner && (
          <form onSubmit={handleAddMember} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <input
              id="add-member-uuid"
              className="form-input"
              type="text"
              placeholder="User UUID to add"
              value={addMemberUserId}
              onChange={(e) => setAddMemberUserId(e.target.value)}
              style={{ flex: 3, minWidth: "200px" }}
            />
            <select
              id="add-member-role"
              value={addMemberRole}
              onChange={(e) => setAddMemberRole(e.target.value as "editor" | "viewer")}
              className="form-input"
              style={{ flex: 1, minWidth: "100px" }}
            >
              <option value="editor">editor</option>
              <option value="viewer">viewer</option>
            </select>
            <button
              id="btn-add-member"
              type="submit"
              className="btn btn-secondary btn-sm"
              disabled={addMemberLoading}
            >
              {addMemberLoading ? "Adding..." : "Add Member"}
            </button>
          </form>
        )}
        {addMemberMsg && (
          <p style={{ fontSize: "0.8rem", marginTop: "0.5rem", color: addMemberMsg.startsWith("Error") ? "var(--danger)" : "var(--success)" }}>
            {addMemberMsg}
          </p>
        )}
      </div>

      {/* Create Task */}
      {canWrite && (
        <div className="card" style={{ marginBottom: "1rem" }}>
          <p className="card-title">Create Task (PostgREST INSERT)</p>
          {taskError && <div className="alert alert-error">{taskError}</div>}
          <form onSubmit={handleCreateTask} style={{ display: "flex", gap: "0.75rem" }}>
            <input
              id="task-title"
              className="form-input"
              type="text"
              placeholder="Task title"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              required
              style={{ flex: 1 }}
            />
            <button
              id="btn-create-task"
              type="submit"
              className="btn btn-primary"
              disabled={taskLoading}
            >
              {taskLoading ? "Creating..." : "Add Task"}
            </button>
          </form>
        </div>
      )}

      {!canWrite && (
        <div className="alert alert-info" style={{ marginBottom: "1rem" }}>
          You are a <strong>viewer</strong> — read-only access. Task creation and editing are blocked by RLS.
        </div>
      )}

      {/* Upload/Edge Function results */}
      {uploadResult && <div className="alert alert-success">{uploadResult}</div>}
      {uploadError && <div className="alert alert-error">{uploadError}</div>}
      {edgeFnResult && (
        <div className="alert alert-success">
          <strong>Edge Function response:</strong>
          <pre className="mono" style={{ marginTop: "0.5rem", fontSize: "0.75rem", whiteSpace: "pre-wrap" }}>{edgeFnResult}</pre>
        </div>
      )}
      {edgeFnError && <div className="alert alert-error">{edgeFnError}</div>}

      {/* Task list */}
      <div>
        <p className="card-title" style={{ marginBottom: "0.75rem" }}>
          Tasks ({tasks.length}) — Realtime enabled
        </p>
        {tasks.length === 0 ? (
          <div className="card">
            <p className="text-muted">No tasks yet. {canWrite ? "Create one above." : "Ask an owner/editor to create tasks."}</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {tasks.map((task) => (
              <div key={task.id} className="card" style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                <div style={{ paddingTop: "2px" }}>
                  <input
                    type="checkbox"
                    id={`task-check-${task.id}`}
                    checked={task.completed}
                    onChange={() => handleToggleComplete(task)}
                    disabled={!canWrite}
                    style={{ cursor: canWrite ? "pointer" : "not-allowed", width: 16, height: 16 }}
                    title={canWrite ? "Toggle complete" : "Viewer: cannot edit"}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span
                      style={{
                        textDecoration: task.completed ? "line-through" : "none",
                        color: task.completed ? "var(--text-muted)" : "var(--text-primary)",
                        fontWeight: 500,
                      }}
                    >
                      {task.title}
                    </span>
                    {task.completed && <span className="badge badge-pass">Done</span>}
                    {task.file_path && <span className="badge badge-warn">📎 File</span>}
                  </div>
                  <div style={{ display: "flex", gap: "1rem", marginTop: "0.25rem" }}>
                    <span className="mono text-muted" style={{ fontSize: "0.7rem" }}>{task.id.slice(0, 8)}...</span>
                    <span className="text-muted" style={{ fontSize: "0.7rem" }}>
                      updated {new Date(task.updated_at).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.375rem", flexShrink: 0 }}>
                  {/* Storage upload */}
                  {canWrite && (
                    <label
                      htmlFor={`file-upload-${task.id}`}
                      className="btn btn-secondary btn-sm"
                      style={{ cursor: "pointer" }}
                      title="Upload file (Storage)"
                    >
                      {uploadingTaskId === task.id ? "↑..." : "↑ File"}
                      <input
                        id={`file-upload-${task.id}`}
                        type="file"
                        style={{ display: "none" }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(task.id, file);
                        }}
                      />
                    </label>
                  )}
                  {/* Edge Function */}
                  <button
                    id={`btn-edge-fn-${task.id}`}
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleEdgeFn(task.id)}
                    disabled={edgeFnLoading}
                    title="Invoke send-task-notification Edge Function"
                  >
                    {edgeFnLoading ? "..." : "⚡ Notify"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
