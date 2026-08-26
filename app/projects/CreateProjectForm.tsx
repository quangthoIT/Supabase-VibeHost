"use client";
// app/projects/CreateProjectForm.tsx
// Client Component for creating a project
// Uses: supabase.from('projects').insert() + supabase.from('project_members').insert()

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function CreateProjectForm({ userId }: { userId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(null);

    // Get active browser user to guarantee matching JWT session
    const { data: { user: activeUser } } = await supabase.auth.getUser();
    const currentUserId = activeUser?.id ?? userId;

    // PostgREST INSERT — projects
    const { data: project, error: insertError } = await supabase
      .from("projects")
      .insert({ name: name.trim(), description: description.trim() || null, created_by: currentUserId })
      .select("id")
      .single();

    if (insertError || !project) {
      setError(insertError?.message ?? "Failed to create project");
      setLoading(false);
      return;
    }

    // PostgREST INSERT / UPSERT — project_members (owner)
    const { error: memberError } = await supabase
      .from("project_members")
      .upsert(
        { project_id: project.id, user_id: currentUserId, role: "owner" },
        { onConflict: "project_id,user_id" }
      );

    if (memberError && memberError.code !== "23505") {
      setError(`Project created but failed to add member: ${memberError.message}`);
      setLoading(false);
      return;
    }

    setName("");
    setDescription("");
    setLoading(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleCreate}>
      {error && <div className="alert alert-error">{error}</div>}
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <input
          id="project-name"
          className="form-input"
          type="text"
          placeholder="Project name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          style={{ flex: 2, minWidth: "180px" }}
        />
        <input
          id="project-description"
          className="form-input"
          type="text"
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={{ flex: 3, minWidth: "200px" }}
        />
        <button
          id="btn-create-project"
          type="submit"
          className="btn btn-primary"
          disabled={loading}
        >
          {loading ? "Creating..." : "Create Project"}
        </button>
      </div>
    </form>
  );
}
