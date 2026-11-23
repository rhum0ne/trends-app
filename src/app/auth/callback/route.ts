import { NextResponse } from "next/server";
import { authClient, isAdminEmail } from "@/lib/supabase/auth";
import { publicOrigin } from "@/lib/links";

// Retour d'un lien magique PKCE (ancien format, encore accepté) : échange le code contre une session, puis /admin.
// Les nouveaux liens passent par /admin/verify/{token} (src/app/admin/verify).
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = publicOrigin(request.headers);
  const code = url.searchParams.get("code");
  if (code) {
    const supabase = await authClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && isAdminEmail(data.user?.email)) return NextResponse.redirect(new URL("/admin", origin));
    if (error) console.error(`[auth-callback] code exchange failed (${error.status ?? "no status"} ${error.code ?? error.name}): ${error.message}`);
    await supabase.auth.signOut();
  }
  return NextResponse.redirect(new URL("/admin/login?error=1", origin));
}
