// supabase/functions/send-task-notification/index.ts
// Edge Function: send-task-notification
//
// Purpose: Simulate a task notification dispatch.
// Does NOT send real email/push notifications.
// Validates auth JWT and input, then returns a JSON receipt.
//
// Deploy with: supabase functions deploy send-task-notification

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed", method: req.method }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // --- Auth check ---
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({
        error: "Missing or invalid Authorization header",
        hint: "Include Bearer token from supabase.auth.getSession()",
      }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Validate JWT via Supabase client
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response(
      JSON.stringify({ error: "Server misconfiguration: missing env vars" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: { Authorization: authHeader },
    },
  });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return new Response(
      JSON.stringify({
        error: "Unauthorized: invalid or expired token",
        detail: authError?.message,
      }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // --- Parse body ---
  let body: { taskId?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const { taskId, message } = body;

  if (!taskId || typeof taskId !== "string") {
    return new Response(
      JSON.stringify({
        error: "Missing required field: taskId",
        received: body,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // --- Verify task exists and user has access ---
  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("id, title, project_id, completed")
    .eq("id", taskId)
    .single();

  if (taskError || !task) {
    return new Response(
      JSON.stringify({
        error: "Task not found or access denied",
        hint: "RLS may be blocking access if you are not a project member",
        detail: taskError?.message,
      }),
      {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // --- Simulate notification dispatch ---
  // In a real system, this would call an email/push API.
  // Here we just return a receipt to prove the function ran.
  const receipt = {
    accepted: true,
    taskId: task.id,
    taskTitle: task.title,
    projectId: task.project_id,
    notifiedUser: user.id,
    message: message ?? `Task "${task.title}" notification simulated`,
    timestamp: new Date().toISOString(),
    environment: {
      // Show where the function ran — useful for Vibe Host diagnostics
      functionName: "send-task-notification",
      supabaseUrl: supabaseUrl,
      runtime: "Deno (Supabase Edge Functions)",
    },
  };

  return new Response(JSON.stringify(receipt), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
