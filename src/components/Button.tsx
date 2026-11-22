import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "ink" | "line";

interface Common {
  variant?: Variant;
  small?: boolean;
  onPhoto?: boolean;
  className?: string;
  children: ReactNode;
}

function classes({ variant = "line", small, onPhoto, className = "" }: Omit<Common, "children">) {
  return ["tr-btn", variant, small ? "small" : "", onPhoto ? "on-photo" : "", className].filter(Boolean).join(" ");
}

/** Bouton-lien. `primary` (heat-4) : un seul par écran (docs/design.md). */
export function ButtonLink({ href, external, ...rest }: Common & { href: string; external?: boolean }) {
  const cls = classes(rest);
  if (external || /^https?:/.test(href)) {
    return (
      <a href={href} className={cls} target={external ? "_blank" : undefined} rel="noopener">
        {rest.children}
      </a>
    );
  }
  return (
    <Link href={href} className={cls}>
      {rest.children}
    </Link>
  );
}

export function Button({ variant, small, onPhoto, className, children, ...props }: Common & Omit<ComponentProps<"button">, "className">) {
  return (
    <button type="button" className={classes({ variant, small, onPhoto, className })} {...props}>
      {children}
    </button>
  );
}
