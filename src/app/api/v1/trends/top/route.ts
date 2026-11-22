import { handleApi, preflight } from "@/lib/api/handler";
import { validateCountry } from "@/lib/api/access";
import { topBody } from "@/lib/api/endpoints";
import { getTopTrend } from "@/lib/trends/queries";

// GET /api/v1/trends/top?country=FR — la tendance du jour (monde, ou du pays demandé)
export async function GET(request: Request) {
  return handleApi(request, async ({ plan, url }) => {
    const country = url.searchParams.get("country");
    const err = validateCountry(country, plan);
    if (err) return err;
    const data = await getTopTrend(country ? country.toUpperCase() : undefined);
    return topBody(plan, data, country);
  });
}

export function OPTIONS() {
  return preflight();
}
