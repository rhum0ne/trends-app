import type { ReactNode } from "react";
import { ShieldAlert, ShieldCheck, Sun } from "lucide-react";
import { CATEGORY_LABEL } from "@/lib/format";

type Variant = "default" | "r" | "flat" | "ghost" | "safe" | "caution";

interface Props {
  children: ReactNode;
  variant?: Variant | Variant[];
  onPhoto?: boolean;
  className?: string;
}

/** Sticker incliné (catégorie, sécurité de marque, heatwave). Trois au plus par carte. */
export function Sticker({ children, variant = "default", onPhoto = false, className = "" }: Props) {
  const variants = (Array.isArray(variant) ? variant : [variant]).filter((v) => v !== "default");
  const cls = ["tr-sticker", ...variants, onPhoto ? "on-photo" : "", className].filter(Boolean).join(" ");
  return <span className={cls}>{children}</span>;
}

export function CategorySticker({ category, onPhoto, tilt = "left" }: { category: string; onPhoto?: boolean; tilt?: "left" | "right" | "flat" }) {
  return (
    <Sticker variant={tilt === "right" ? "r" : tilt === "flat" ? "flat" : "default"} onPhoto={onPhoto}>
      {CATEGORY_LABEL[category] ?? category}
    </Sticker>
  );
}

export function SafetySticker({ brandSafe, tilt = "right" }: { brandSafe: boolean; tilt?: "left" | "right" | "flat" }) {
  const t: Variant = tilt === "right" ? "r" : tilt === "flat" ? "flat" : "default";
  return brandSafe ? (
    <Sticker variant={["safe", t]}>
      <ShieldCheck strokeWidth={1.75} aria-hidden="true" />
      Brand-safe
    </Sticker>
  ) : (
    <Sticker variant={["caution", t]}>
      <ShieldAlert strokeWidth={1.75} aria-hidden="true" />
      Caution
    </Sticker>
  );
}

export function HeatwaveSticker({ days, onPhoto }: { days: number; onPhoto?: boolean }) {
  if (days < 2) return null;
  return (
    <Sticker variant={["ghost", "flat"]} onPhoto={onPhoto}>
      <Sun strokeWidth={1.75} aria-hidden="true" />
      Heatwave · day {days}
    </Sticker>
  );
}
