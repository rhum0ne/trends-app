import type { Metadata } from "next";
import { Suspense } from "react";
import { Logo } from "@/components/Logo";
import { sendMagicLink } from "../actions";

export const metadata: Metadata = { title: "Admin · trends°", robots: { index: false, follow: false } };

async function Message({ searchParams }: { searchParams: PageProps<"/admin/login">["searchParams"] }) {
  const sp = await searchParams;
  if (sp.sent) return <p className="m-0 font-bold" role="status">If this address is allowed, a sign-in link is on its way.</p>;
  if (sp.error) return <p className="m-0 text-caution" role="alert">That link didn&apos;t work. Ask for a new one.</p>;
  return null;
}

export default function AdminLogin({ searchParams }: PageProps<"/admin/login">) {
  return (
    <main className="tr-wrap flex min-h-dvh max-w-md flex-col justify-center gap-6">
      <Logo href={null} size={48} />
      <h1 className="tr-display m-0 text-[56px]">admin</h1>
      <form action={sendMagicLink} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm font-bold">
          Email
          <input type="email" name="email" required autoComplete="email" className="rounded-[8px] border border-line bg-surface-2 px-3 py-2 font-normal text-ink" />
        </label>
        <button type="submit" className="tr-btn primary self-start">
          Send me a sign-in link
        </button>
      </form>
      <Suspense fallback={null}>
        <Message searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
