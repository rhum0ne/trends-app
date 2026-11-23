import type { ReactNode } from "react";
import { Logo } from "@/components/Logo";
import { Sticker } from "@/components/Sticker";

/** Carte centrée des écrans de connexion à l'administration (/admin/login, /admin/verify). */
export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-[400px] flex-col gap-6 rounded-[24px] bg-surface p-8 shadow-[inset_0_0_0_1px_var(--line)] max-sm:p-6">
        <div className="flex items-center gap-3">
          <Logo href={null} size={40} />
          <Sticker variant={["ghost", "flat"]}>Admin</Sticker>
        </div>
        {children}
      </div>
    </main>
  );
}
