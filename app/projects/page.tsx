// app/projects/page.tsx
// Server Component: list projects + create project form
// Uses: supabase.from('projects').select(), supabase.from('projects').insert()

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import CreateProjectForm from "./CreateProjectForm";

export const metadata = {
  title: "Projects — Supabase Vibe Host Test Board",
  description: "View and create projects. Tests PostgREST SELECT and INSERT.",
};

export default async function ProjectsPage() {
  const supabase = await createClient();

  // Auth check — supabase.auth.getUser()
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // PostgREST SELECT: projects + member count via join
  const { data: projects, error } = await supabase
    .from("projects")
    .select(
      `
      id,
      name,
      description,
      created_at,
      created_by,
      project_members (
        user_id,
        role
      )
    `
    )
    .order("created_at", { ascending: false });

  const myRole = (projectId: string) => {
    const p = projects?.find((p) => p.id === projectId);
    const member = p?.project_members?.find((m: { user_id: string; role: string }) => m.user_id === user.id);
    return member?.role ?? null;
  };

  return (
    <>
      <AppHeader userEmail={user.email} />
      <main className="main-content">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1.5rem" }}>
          <div>
            <h1 className="page-title">Projects</h1>
            <p className="page-subtitle">
              PostgREST SELECT — showing projects you are a member of (RLS enforced)
            </p>
          </div>
        </div>

        {error && (
          <div className="alert alert-error">
            PostgREST error: {error.message}
          </div>
        )}

        {/* Create project form — tests PostgREST INSERT */}
        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <p className="card-title">Create Project (PostgREST INSERT)</p>
          <CreateProjectForm userId={user.id} />
        </div>

        {/* Project list */}
        {!projects || projects.length === 0 ? (
          <div className="card">
            <p className="text-muted">
              No projects yet. Create one above, or make sure migrations are applied and you have been added as a member.
            </p>
          </div>
        ) : (
          <div className="grid-2">
            {projects.map((project) => {
              const role = myRole(project.id);
              const memberCount = project.project_members?.length ?? 0;
              return (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  style={{ textDecoration: "none" }}
                >
                  <div
                    className="card"
                    style={{
                      cursor: "pointer",
                      transition: "border-color 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.borderColor = "var(--accent)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)";
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                      <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text-primary)" }}>
                        {project.name}
                      </h2>
                      {role && (
                        <span className="tag">{role}</span>
                      )}
                    </div>
                    {project.description && (
                      <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.75rem" }}>
                        {project.description}
                      </p>
                    )}
                    <p className="text-muted" style={{ fontSize: "0.75rem" }}>
                      {memberCount} member{memberCount !== 1 ? "s" : ""} ·{" "}
                      {new Date(project.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        <div style={{ marginTop: "2rem" }}>
          <Link href="/diagnostics" className="text-muted" style={{ fontSize: "0.8rem" }}>
            → Run diagnostics page
          </Link>
        </div>
      </main>
    </>
  );
}
