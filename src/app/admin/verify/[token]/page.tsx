import type { Metadata } from "next";
import { Suspense } from "react";
import { LogIn } from "lucide-react";
import { AuthCard } from "@/components/admin/AuthCard";
import { verifyMagicLink } from "../../actions";

// Lien de connexion envoyé par email (modèle public/email/sign-in.html, réglé dans Supabase Auth).
// Ouvrir la page ne fait rien : le jeton n'est vérifié qu'au clic, il reste valable si un antivirus ouvre le lien.

export const metadata: Metadata = { title: "Sign in · Admin · trends°", robots: { index: false, follow: false }, referrer: "no-referrer" };

async function VerifyForm({ params }: { params: PageProps<"/admin/verify/[token]">["params"] }) {
  const { token } = await params;
  return (
    <form action={verifyMagicLink}>
      <input type="hidden" name="token" value={token} />
      <button type="submit" className="tr-btn primary w-full">
        <LogIn strokeWidth={1.75} aria-hidden="true" /> Sign in to admin
      </button>
    </form>
  );
}

export default function VerifyPage({ params }: PageProps<"/admin/verify/[token]">) {
  return (
    <AuthCard>
      <p className="tr-muted m-0 text-[15px] leading-[22px]">One click to finish signing in. The link works once.</p>
      <Suspense fallback={<div className="min-h-[44px]" />}>
        <VerifyForm params={params} />
      </Suspense>
    </AuthCard>
  );
}
