import { handleApi, preflight } from "@/lib/api/handler";
import { validateTrendsQuery } from "@/lib/api/access";
import { listBody } from "@/lib/api/endpoints";
import { getDailyTrends, getLatestDay } from "@/lib/trends/queries";

// GET /api/v1/trends?day=YYYY-MM-DD&country=FR&category=… — tendances du jour, triées par chaleur
export async function GET(request: Request) {
  return handleApi(request, async ({ plan, url }) => {
    const params = { day: url.searchParams.get("day"), country: url.searchParams.get("country"), category: url.searchParams.get("category") };
    const latest = await getLatestDay();
    const err = validateTrendsQuery(params, plan, latest);
    if (err) return err;
    const data = await getDailyTrends({
      ...(params.day ? { day: params.day } : {}),
      ...(params.country ? { country: params.country.toUpperCase() } : {}),
      ...(params.category ? { category: params.category } : {}),
    });
    return listBody(plan, data, params);
  });
}

export function OPTIONS() {
  return preflight();
}
