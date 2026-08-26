"use client";
// components/AppHeader.tsx
// Shared header with nav and sign-out

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface AppHeaderProps {
  userEmail?: string | null;
}

export function AppHeader({ userEmail }: AppHeaderProps) {
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="app-header">
      <div className="logo">
        Supabase <span>Vibe Host</span> Test Board
      </div>
      <nav className="header-nav">
        <Link href="/projects">Projects</Link>
        <Link href="/diagnostics">Diagnostics</Link>
        {userEmail && (
          <span className="text-muted" style={{ fontSize: "0.8rem" }}>
            {userEmail}
          </span>
        )}
        <button
          id="btn-signout"
          onClick={handleSignOut}
          className="btn btn-secondary btn-sm"
        >
          Sign Out
        </button>
      </nav>
    </header>
  );
}
