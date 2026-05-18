import { NextRequest, NextResponse } from "next/server";

const FIELDS = "code,product_name,brands,image_front_small_url";

async function tryFetch(url: string): Promise<Response> {
  return fetch(url, { signal: AbortSignal.timeout(8000) });
}

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json([]);

  // Try v2 REST search first (more reliable than CGI)
  const v2Url = `https://world.openfoodfacts.org/api/v2/search?search_terms=${encodeURIComponent(q)}&page_size=15&fields=${encodeURIComponent(FIELDS)}&json=1`;
  // Fallback: dedicated search service
  const searchUrl = `https://search.openfoodfacts.org/search?q=${encodeURIComponent(q)}&page_size=15&fields=${encodeURIComponent(FIELDS)}`;

  const attempts = [v2Url, searchUrl];

  for (const url of attempts) {
    try {
      const res = await tryFetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      // v2 returns { products: [] }, search service returns { hits: [] }
      const products = Array.isArray(data?.products)
        ? data.products
        : Array.isArray(data?.hits)
        ? data.hits.map((h: Record<string, unknown>) => h._source ?? h)
        : [];
      return NextResponse.json(products, {
        headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=60" },
      });
    } catch {
      // try next
    }
  }

  return NextResponse.json({ error: "search_failed" }, { status: 502 });
}
