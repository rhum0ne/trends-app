import { handleApi, preflight } from "@/lib/api/handler";
import { canListCountries } from "@/lib/api/access";
import { countriesBody } from "@/lib/api/endpoints";
import { getCountries } from "@/lib/trends/queries";

// GET /api/v1/countries — les pays suivis, avec la tendance la plus chaude de chacun
export async function GET(request: Request) {
  return handleApi(request, async ({ plan }) => {
    if (!canListCountries(plan)) return { status: 403, code: "countries_not_included", message: "The country list is not included in your plan" };
    return countriesBody(plan, await getCountries());
  });
}

export function OPTIONS() {
  return preflight();
}
