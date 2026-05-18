import { NextRequest, NextResponse } from "next/server";

const FIELDS = "code,product_name,brands,image_front_url,image_front_small_url,nutriments";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  if (!code?.trim()) return NextResponse.json({ product: null });

  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code.trim())}?fields=${encodeURIComponent(FIELDS)}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=300" },
    });
  } catch {
    return NextResponse.json({ error: "product_failed" }, { status: 502 });
  }
}
