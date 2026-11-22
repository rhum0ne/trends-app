// Connexion à /admin par lien magique (Supabase Auth), réservée aux adresses de ADMIN_EMAILS (CLAUDE.md § 9).
// Le seul cookie posé est celui de la session admin ; aucun visiteur public n'en reçoit.

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminEmails, env, requireEnv } from "@/lib/env";

export async function authClient() {
  const store = await cookies();
  return createServerClient(env("SUPABASE_INTERNAL_URL") ?? requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_ANON_KEY"), {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Appelé pendant un rendu : la session sera rafraîchie à la prochaine action
        }
      },
    },
  });
}

export function isAdminEmail(email: string | null | undefined): boolean {
  return Boolean(email) && adminEmails().includes(email!.trim().toLowerCase());
}

/** Renvoie l'email de l'admin connecté, sinon redirige vers /admin/login. */
export async function requireAdmin(): Promise<string> {
  let email: string | undefined;
  try {
    const supabase = await authClient();
    const { data } = await supabase.auth.getUser();
    email = data.user?.email ?? undefined;
  } catch {
    email = undefined;
  }
  if (!email || !isAdminEmail(email)) redirect("/admin/login");
  return email;
}
