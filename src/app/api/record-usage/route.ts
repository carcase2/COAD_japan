import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();
  // 로컬 개발 시 헤더에 IP가 없음 → 'local'로 기록해 두면 테스트 구분 가능
  if (process.env.NODE_ENV === "development") return "local";
  return null;
}

function getLocationFromRequest(request: Request): string | null {
  const geo = (request as Request & { geo?: { city?: string; region?: string; country?: string } }).geo;
  if (geo) {
    const parts = [geo.city, geo.region, geo.country].filter(Boolean);
    if (parts.length > 0) return parts.join(", ");
  }
  // 로컬 개발 시 Vercel geo 없음
  if (process.env.NODE_ENV === "development") return "로컬";
  return null;
}

export async function POST(request: Request) {
  let body: {
    productType: string;
    widthMm: number;
    heightMm: number;
    priceYen: number;
    typeInfo: string;
    referrer?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { productType, widthMm, heightMm, priceYen, typeInfo, referrer } = body;
  if (
    !productType ||
    typeof widthMm !== "number" ||
    typeof heightMm !== "number" ||
    typeof priceYen !== "number" ||
    !typeInfo
  ) {
    return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
  }
  if (productType !== "sheet_shutter" && productType !== "garage_shutter") {
    return NextResponse.json({ error: "Invalid productType" }, { status: 400 });
  }

  const ipAddress = getClientIp(request);
  const location = getLocationFromRequest(request);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const rowWithGeo = {
    product_type: productType,
    width_mm: widthMm,
    height_mm: heightMm,
    price_yen: priceYen,
    type_info: typeInfo,
    referrer: referrer ?? null,
    ip_address: ipAddress,
    location: location,
  };
  const rowBase = {
    product_type: productType,
    width_mm: widthMm,
    height_mm: heightMm,
    price_yen: priceYen,
    type_info: typeInfo,
    referrer: referrer ?? null,
  };

  let { error } = await supabase.from("usage_history").insert(rowWithGeo);
  if (error && (error.message.includes("ip_address") || error.message.includes("location") || error.message.includes("schema cache"))) {
    ({ error } = await supabase.from("usage_history").insert(rowBase));
  }
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
