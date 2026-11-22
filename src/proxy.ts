import { NextResponse, type NextRequest } from "next/server";

// Phase 0 (PUBLIC_SITE=false) : le site public n'affiche que la page d'attente ; l'API, l'admin,
// les tâches planifiées et /styleguide (noindex) restent accessibles. Lu à l'exécution, pas au build.
const ALWAYS_OPEN = [/^\/api\//, /^\/admin(\/|$)/, /^\/auth\//, /^\/styleguide$/, /^\/coming-soon$/, /^\/robots\.txt$/];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const publicSite = (process.env.PUBLIC_SITE ?? "").trim().toLowerCase() === "true";
  if (publicSite) {
    if (pathname === "/coming-soon") return NextResponse.redirect(new URL("/", request.url));
    return NextResponse.next();
  }
  if (ALWAYS_OPEN.some((re) => re.test(pathname))) return NextResponse.next();
  const res = NextResponse.rewrite(new URL("/coming-soon", request.url));
  res.headers.set("X-Robots-Tag", "noindex");
  return res;
}

export const config = {
  matcher: ["/((?!_next/|flags/|favicon.ico|icon|apple-icon).*)"],
};
