// app/projects/[id]/page.tsx
// Server Component: project detail shell
// Loads project + initial tasks server-side, passes to client component for Realtime

import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { ProjectBoard } from "./ProjectBoard";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("name")
    .eq("id", id)
    .single();
  return {
    title: project ? `${project.name} — Supabase Vibe Host Test Board` : "Project",
    description: "Project board with Realtime, Storage, RPC, and Edge Function testing.",
  };
}

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // PostgREST SELECT — project details
  const { data: project } = await supabase
    .from("projects")
    .select("id, name, description, created_by, created_at")
    .eq("id", id)
    .single();

  if (!project) {
    notFound();
  }

  // PostgREST SELECT — current user's role
  const { data: membership } = await supabase
    .from("project_members")
    .select("role")
    .eq("project_id", id)
    .eq("user_id", user.id)
    .single();

  // PostgREST SELECT — all members
  const { data: members } = await supabase
    .from("project_members")
    .select("user_id, role")
    .eq("project_id", id);

  // PostgREST SELECT — initial tasks (Realtime will keep them updated)
  const { data: initialTasks } = await supabase
    .from("tasks")
    .select("id, title, description, completed, file_path, created_by, created_at, updated_at")
    .eq("project_id", id)
    .order("created_at", { ascending: true });

  return (
    <>
      <AppHeader userEmail={user.email} />
      <main className="main-content">
        <ProjectBoard
          project={project}
          userRole={membership?.role ?? null}
          currentUserId={user.id}
          members={members ?? []}
          initialTasks={initialTasks ?? []}
        />
      </main>
    </>
  );
}
