// proxy.ts
// Next.js 16+ proxy (previously middleware) — refreshes Supabase sessions on every request

import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// In Next.js 16+, "proxy" is the new name for "middleware"
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     * - public folder files
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
