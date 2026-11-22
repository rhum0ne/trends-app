import { handleApi, preflight } from "@/lib/api/handler";
import { trendBody } from "@/lib/api/endpoints";
import { entitlements } from "@/lib/plans";
import { getLatestDay, getTrend } from "@/lib/trends/queries";

// GET /api/v1/trends/{slug} — une tendance, avec son historique de chaleur et sa prévision
export async function GET(request: Request, ctx: RouteContext<"/api/v1/trends/[slug]">) {
  const { slug } = await ctx.params;
  return handleApi(request, async ({ plan }) => {
    if (!/^[a-z0-9-]{1,80}$/.test(slug)) return { status: 404, code: "not_found", message: "Unknown trend" };
    const [view, latest] = await Promise.all([getTrend(slug, { historyDays: entitlements(plan).historyDays }), getLatestDay()]);
    return trendBody(plan, view, latest);
  });
}

export function OPTIONS() {
  return preflight();
}
