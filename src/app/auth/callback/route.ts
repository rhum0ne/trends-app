import { NextResponse } from "next/server";
import { authClient, isAdminEmail } from "@/lib/supabase/auth";

// Retour du lien magique : échange le code contre une session, puis /admin.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (code) {
    const supabase = await authClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && isAdminEmail(data.user?.email)) return NextResponse.redirect(new URL("/admin", url.origin));
    await supabase.auth.signOut();
  }
  return NextResponse.redirect(new URL("/admin/login?error=1", url.origin));
}
