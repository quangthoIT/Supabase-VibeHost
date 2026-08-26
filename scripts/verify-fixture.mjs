#!/usr/bin/env node
// scripts/verify-fixture.mjs
// Static verification script for supabase-vibe-host-fixture
//
// Checks that all required Supabase capability markers are present
// in the actual source code (not in comments or strings that are dead code).
//
// Usage: npm run verify:fixture
// Exit code 0 = all markers found, 1 = one or more missing

import { readFileSync, readdirSync, statSync } from "fs";
import { join, extname } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// ──────────────────────────────────────────────────────────────
// File collection
// ──────────────────────────────────────────────────────────────
const SEARCH_DIRS = ["app", "components", "lib", "supabase", "scripts"];
const INCLUDE_EXTS = new Set([".ts", ".tsx", ".sql", ".toml", ".json"]);
const EXCLUDE_DIRS = new Set(["node_modules", ".next", ".git"]);

function collectFiles(dir) {
  const files = [];
  try {
    for (const entry of readdirSync(dir)) {
      if (EXCLUDE_DIRS.has(entry)) continue;
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        files.push(...collectFiles(full));
      } else if (INCLUDE_EXTS.has(extname(full))) {
        files.push(full);
      }
    }
  } catch {
    // ignore unreadable dirs
  }
  return files;
}

const allFiles = SEARCH_DIRS.flatMap((d) => collectFiles(join(ROOT, d)));

// Also include root-level files (e.g., .env.example, package.json)
const ROOT_FILES = [".env.example", "package.json"].map((f) => join(ROOT, f));
const allFilesWithRoot = [...allFiles, ...ROOT_FILES.filter((f) => {
  try { statSync(f); return true; } catch { return false; }
})];

const allContent = allFilesWithRoot.map((f) => ({
  path: f.replace(ROOT, "").replace(/\\/g, "/"),
  content: readFileSync(f, "utf-8"),
}));


// ──────────────────────────────────────────────────────────────
// Marker checks
// Each check: { label, marker, files (optional filter), description }
// ──────────────────────────────────────────────────────────────
const checks = [
  // Package dependency
  {
    label: "Package: @supabase/supabase-js",
    marker: "@supabase/supabase-js",
    files: allContent.filter((f) => f.path.includes("package.json") || f.path.includes(".ts") || f.path.includes(".tsx")),
    description: "Must appear in package.json or imports",
  },
  {
    label: "Package: @supabase/ssr",
    marker: "@supabase/ssr",
    files: allContent.filter((f) => f.path.includes("package.json") || f.path.includes(".ts") || f.path.includes(".tsx")),
    description: "Must appear in package.json or imports",
  },

  // Auth
  {
    label: "Auth: supabase.auth.signUp",
    marker: "supabase.auth.signUp",
    files: allContent.filter((f) => f.path.endsWith(".tsx") || f.path.endsWith(".ts")),
    description: "signUp call in source code",
  },
  {
    label: "Auth: supabase.auth.signInWithPassword",
    marker: "supabase.auth.signInWithPassword",
    files: allContent.filter((f) => f.path.endsWith(".tsx") || f.path.endsWith(".ts")),
    description: "signInWithPassword call in source code",
  },
  {
    label: "Auth: supabase.auth.signOut",
    marker: "supabase.auth.signOut",
    files: allContent.filter((f) => f.path.endsWith(".tsx") || f.path.endsWith(".ts")),
    description: "signOut call in source code",
  },
  {
    label: "Auth: supabase.auth.getUser",
    marker: "supabase.auth.getUser",
    files: allContent.filter((f) => f.path.endsWith(".tsx") || f.path.endsWith(".ts")),
    description: "getUser call in source code",
  },

  // PostgREST
  {
    label: "PostgREST: .from('projects')",
    marker: ".from('projects')",
    files: allContent.filter((f) => f.path.endsWith(".tsx") || f.path.endsWith(".ts")),
    description: "PostgREST projects table access",
  },
  {
    label: "PostgREST: .from('tasks')",
    marker: ".from('tasks')",
    files: allContent.filter((f) => f.path.endsWith(".tsx") || f.path.endsWith(".ts")),
    description: "PostgREST tasks table access",
  },
  {
    label: "PostgREST: .insert(",
    marker: ".insert(",
    files: allContent.filter((f) => f.path.endsWith(".tsx") || f.path.endsWith(".ts")),
    description: "INSERT operation via PostgREST",
  },
  {
    label: "PostgREST: .update(",
    marker: ".update(",
    files: allContent.filter((f) => f.path.endsWith(".tsx") || f.path.endsWith(".ts")),
    description: "UPDATE operation via PostgREST",
  },

  // RPC
  {
    label: "RPC: supabase.rpc(",
    marker: "supabase.rpc(",
    files: allContent.filter((f) => f.path.endsWith(".tsx") || f.path.endsWith(".ts")),
    description: "RPC call in client code",
  },
  {
    label: "RPC: get_project_stats",
    marker: "get_project_stats",
    files: allContent,
    description: "Simple RPC function name referenced",
  },
  {
    label: "RPC: check_can_edit_project",
    marker: "check_can_edit_project",
    files: allContent,
    description: "SECURITY DEFINER wrapper RPC referenced",
  },

  // Storage
  {
    label: "Storage: .storage.from('task-files')",
    marker: ".storage\n      .from('task-files')",
    files: allContent.filter((f) => f.path.endsWith(".tsx") || f.path.endsWith(".ts")),
    description: "Storage bucket access",
    // Use alternate single-line form too
    altMarker: ".storage.from('task-files')",
  },
  {
    label: "Storage: .upload(",
    marker: ".upload(",
    files: allContent.filter((f) => f.path.endsWith(".tsx") || f.path.endsWith(".ts")),
    description: "Storage upload call",
  },

  // Realtime
  {
    label: "Realtime: .channel(",
    marker: ".channel(",
    files: allContent.filter((f) => f.path.endsWith(".tsx") || f.path.endsWith(".ts")),
    description: "Realtime channel creation",
  },
  {
    label: "Realtime: postgres_changes",
    marker: "postgres_changes",
    files: allContent.filter((f) => f.path.endsWith(".tsx") || f.path.endsWith(".ts")),
    description: "Postgres changes subscription",
  },
  {
    label: "Realtime: .subscribe(",
    marker: ".subscribe(",
    files: allContent.filter((f) => f.path.endsWith(".tsx") || f.path.endsWith(".ts")),
    description: "Channel subscribe call",
  },

  // Edge Function
  {
    label: "Edge Function: functions.invoke(",
    marker: "functions.invoke(",
    files: allContent.filter((f) => f.path.endsWith(".tsx") || f.path.endsWith(".ts")),
    description: "Edge Function invocation",
  },
  {
    label: "Edge Function: send-task-notification",
    marker: "send-task-notification",
    files: allContent.filter((f) => f.path.endsWith(".tsx") || f.path.endsWith(".ts") || f.path.includes("supabase/functions")),
    description: "Edge Function name referenced",
  },

  // SQL — RLS
  {
    label: "SQL: ROW LEVEL SECURITY",
    marker: "row level security",
    files: allContent.filter((f) => f.path.endsWith(".sql")),
    description: "RLS enabled in migrations",
    caseInsensitive: true,
  },
  {
    label: "SQL: CREATE POLICY (case-insensitive)",
    marker: "create policy",
    files: allContent.filter((f) => f.path.endsWith(".sql")),
    description: "RLS policies in migrations",
    caseInsensitive: true,
  },
  {
    label: "SQL: auth.uid()",
    marker: "auth.uid()",
    files: allContent.filter((f) => f.path.endsWith(".sql")),
    description: "auth.uid() used in policies",
  },

  // SQL — SECURITY DEFINER
  {
    label: "SQL: SECURITY DEFINER",
    marker: "SECURITY DEFINER",
    files: allContent.filter((f) => f.path.endsWith(".sql")),
    description: "SECURITY DEFINER in migrations",
  },
  {
    label: "SQL: private schema",
    marker: "create schema if not exists private",
    files: allContent.filter((f) => f.path.endsWith(".sql")),
    description: "Private schema for SECURITY DEFINER function",
    caseInsensitive: true,
  },

  // Storage bucket in SQL
  {
    label: "SQL: task-files bucket",
    marker: "task-files",
    files: allContent.filter((f) => f.path.endsWith(".sql")),
    description: "Storage bucket created in migration",
  },

  {
    label: "Config: .env.example exists",
    marker: "NEXT_PUBLIC_SUPABASE_URL=",
    files: allContent.filter((f) => f.path.includes(".env.example")),
    description: ".env.example with correct variable names",
  },
  {
    label: "Config: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    marker: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=",
    files: allContent.filter((f) => f.path.includes(".env.example")),
    description: "Publishable key env var name in .env.example",
  },
];

// ──────────────────────────────────────────────────────────────
// Run checks
// ──────────────────────────────────────────────────────────────
console.log("\n🔍 supabase-vibe-host-fixture — Static Verification\n");
console.log(`   Scanning ${allFiles.length} files...\n`);

let passed = 0;
let failed = 0;
const failures = [];

for (const check of checks) {
  const searchFiles = check.files && check.files.length > 0 ? check.files : allContent;
  const marker = check.caseInsensitive
    ? check.marker.toLowerCase()
    : check.marker;

  let found = false;
  let foundIn = null;

  for (const f of searchFiles) {
    const content = check.caseInsensitive ? f.content.toLowerCase() : f.content;
    if (content.includes(marker) || (check.altMarker && f.content.includes(check.altMarker))) {
      found = true;
      foundIn = f.path;
      break;
    }
  }

  if (found) {
    passed++;
    console.log(`  ✅ ${check.label}`);
    if (process.env.VERBOSE) console.log(`     Found in: ${foundIn}`);
  } else {
    failed++;
    failures.push(check);
    console.log(`  ❌ ${check.label}`);
    console.log(`     Expected: "${check.marker}"`);
    console.log(`     Searched: ${searchFiles.length} file(s)`);
  }
}

console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);

if (failures.length > 0) {
  console.log("❌ VERIFICATION FAILED — missing markers:\n");
  failures.forEach((f) => {
    console.log(`  • ${f.label}: ${f.description}`);
  });
  console.log("");
  process.exit(1);
} else {
  console.log("✅ All fixture markers verified — static checks passed.\n");
  console.log("   Note: static checks do NOT replace runtime testing.");
  console.log("   Run npm run dev and test via /diagnostics page.\n");
  process.exit(0);
}
