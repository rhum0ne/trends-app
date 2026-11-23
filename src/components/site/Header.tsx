import Link from "next/link";
import { Logo } from "@/components/Logo";
import { PoweredBy } from "@/components/PoweredBy";

const NAV = [
  { href: "/", label: "Today" },
  { href: "/#week", label: "This week" },
  { href: "/c", label: "By country" },
  { href: "/api", label: "API" },
];

export function Header() {
  return (
    // Hauteur minimale --header-h (globals.css) : le héros de l'accueil s'en sert pour remplir le reste de l'écran
    <header className="tr-wrap flex min-h-(--header-h) flex-wrap content-center items-center justify-between gap-x-6 gap-y-3">
      <div className="flex items-center gap-6">
        <Logo size={36} />
        <nav aria-label="Main" className="hidden md:block">
          <ul className="m-0 flex list-none gap-5 p-0 text-sm font-bold">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="no-underline hover:underline">
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <PoweredBy />
      <nav aria-label="Main (mobile)" className="w-full md:hidden">
        <ul className="m-0 flex list-none gap-4 overflow-x-auto p-0 text-sm font-bold">
          {NAV.map((n) => (
            <li key={n.href} className="whitespace-nowrap">
              <Link href={n.href} className="no-underline">
                {n.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
