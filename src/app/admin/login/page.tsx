import type { Metadata } from "next";
import { Suspense } from "react";
import { AlertTriangle, Mail } from "lucide-react";
import { AuthCard } from "@/components/admin/AuthCard";
import { sendMagicLink } from "../actions";

export const metadata: Metadata = { title: "Admin · trends°", robots: { index: false, follow: false } };

async function Message({ searchParams }: { searchParams: PageProps<"/admin/login">["searchParams"] }) {
  const sp = await searchParams;
  if (sp.sent) {
    return (
      <div className="flex items-start gap-3 rounded-[14px] bg-surface-2 p-4 text-sm" role="status">
        <Mail strokeWidth={1.75} className="mt-[2px] size-4 shrink-0" aria-hidden="true" />
        <div className="flex flex-col gap-1">
          <b>If this address is allowed, a sign-in link is on its way.</b>
          <span className="tr-muted">Check your spam folder too. The link works once.</span>
        </div>
      </div>
    );
  }
  if (sp.error) {
    return (
      <div className="flex items-start gap-3 rounded-[14px] bg-surface-2 p-4 text-sm" role="alert">
        <AlertTriangle strokeWidth={1.75} className="mt-[2px] size-4 shrink-0 text-caution" aria-hidden="true" />
        <b>That link didn&apos;t work. Ask for a new one.</b>
      </div>
    );
  }
  return null;
}

export default function AdminLogin({ searchParams }: PageProps<"/admin/login">) {
  return (
    <AuthCard>
      <p className="tr-muted m-0 text-[15px] leading-[22px]">Sign in with a one-time link sent to your email.</p>
      <form action={sendMagicLink} className="flex flex-col gap-4">
        <label className="flex flex-col gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">Email</span>
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="min-h-[44px] rounded-[8px] border border-line bg-surface-2 px-3 text-[15px] text-ink placeholder:text-ink-muted"
          />
        </label>
        <button type="submit" className="tr-btn primary w-full">
          Send me a sign-in link
        </button>
      </form>
      <Suspense fallback={null}>
        <Message searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}
