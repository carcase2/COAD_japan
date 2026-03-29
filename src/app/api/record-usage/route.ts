import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";

function pickClientIp(h: Headers): string | null {
  const names = [
    "x-forwarded-for",
    "x-real-ip",
    "cf-connecting-ip",
    "x-vercel-forwarded-for",
    "true-client-ip",
    "fastly-client-ip",
  ];
  for (const name of names) {
    const raw = h.get(name);
    if (raw) {
      const first = raw.split(",")[0].trim();
      if (first) return first;
    }
  }
  return null;
}

async function getClientIp(request: Request): Promise<string | null> {
  const fromRequest = pickClientIp(request.headers);
  const h = await headers();
  const fromNext = pickClientIp(h);
  const ip = fromRequest || fromNext;
  if (ip) return ip;
  if (process.env.NODE_ENV === "development") return "local";
  return null;
}

/** localhost:3000 등 — NODE_ENV가 production이어도 로컬 테스트 구분 */
function isLocalHostHeader(host: string | null): boolean {
  if (!host) return false;
  const lower = host.toLowerCase();
  return (
    lower.startsWith("localhost") ||
    lower.startsWith("127.0.0.1") ||
    lower.startsWith("[::1]") ||
    lower === "::1"
  );
}

function getLocationFromRequest(request: Request): string | null {
  const geo = (request as Request & { geo?: { city?: string; region?: string; country?: string } }).geo;
  if (geo) {
    const parts = [geo.city, geo.region, geo.country].filter(Boolean);
    if (parts.length > 0) return parts.join(", ");
  }
  if (process.env.NODE_ENV === "development") return "로컬";
  return null;
}

function isPrivateOrLocalIp(ip: string): boolean {
  if (!ip || ip === "local" || ip === "unknown") return true;
  if (ip.startsWith("10.")) return true;
  if (ip.startsWith("192.168.")) return true;
  if (ip.startsWith("127.")) return true;
  if (ip === "::1") return true;
  if (ip.startsWith("172.")) {
    const n = parseInt(ip.split(".")[1] ?? "", 10);
    if (n >= 16 && n <= 31) return true;
  }
  return false;
}

async function getUserAgent(request: Request): Promise<string | null> {
  const fromReq = request.headers.get("user-agent");
  if (fromReq?.trim()) return fromReq.trim();
  const h = await headers();
  const fromNext = h.get("user-agent");
  return fromNext?.trim() || null;
}

/** User-Agent → 한 줄 요약 (모바일/PC · 브라우저 · OS) */
function summarizeAccessEnv(ua: string | null): string | null {
  if (!ua?.trim()) return null;
  const u = ua.toLowerCase();
  const tablet = /ipad|tablet|playbook|silk/i.test(ua) || (/android/i.test(ua) && !/mobile/i.test(ua));
  const mobile = /mobi|iphone|ipod|android|blackberry|opera mini|iemobile|wpdesktop/i.test(ua);
  const device = tablet ? "태블릿" : mobile ? "모바일" : "PC";
  let browser = "기타";
  if (/edg\//i.test(ua) || /edgios/i.test(u)) browser = "Edge";
  else if (/opr\/|opera/i.test(u)) browser = "Opera";
  else if (/crios/i.test(u)) browser = "Chrome";
  else if (/fxios/i.test(u)) browser = "Firefox";
  else if (/chrome/i.test(u) && !/edg/i.test(u)) browser = "Chrome";
  else if (/safari/i.test(u) && !/chrome|crios|android/i.test(u)) browser = "Safari";
  else if (/firefox/i.test(u)) browser = "Firefox";
  else if (/samsungbrowser/i.test(u)) browser = "Samsung Internet";
  let os = "";
  if (/windows/i.test(ua)) os = "Windows";
  else if (/mac os x|macintosh/i.test(ua)) os = "macOS";
  else if (/android/i.test(ua)) os = "Android";
  else if (/iphone|ipad|ipod/i.test(ua)) os = "iOS";
  else if (/linux/i.test(ua)) os = "Linux";
  return os ? `${device} · ${browser} · ${os}` : `${device} · ${browser}`;
}

async function lookupLocationByIp(ip: string): Promise<string | null> {
  if (isPrivateOrLocalIp(ip)) return null;
  try {
    const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
      signal: AbortSignal.timeout(2500),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { error?: boolean; city?: string; region?: string; country_name?: string };
    if (j.error) return null;
    const parts = [j.city, j.region, j.country_name].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  let body: {
    productType: string;
    widthMm: number;
    heightMm: number;
    priceYen: number;
    typeInfo: string;
    referrer?: string | null;
    pageUrl?: string | null;
    /** 브라우저에서 보내는 UA (로컬/프록시에서 서버 헤더가 비는 경우 대비) */
    clientUserAgent?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { productType, widthMm, heightMm, priceYen, typeInfo, referrer, pageUrl, clientUserAgent } = body;
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

  const h = await headers();
  const host = h.get("host");
  const onLocalHost = isLocalHostHeader(host);

  let ipAddress = await getClientIp(request);
  if (!ipAddress && onLocalHost) ipAddress = "local";

  let location = getLocationFromRequest(request);
  if (!location && onLocalHost) location = "로컬";
  if (!location && ipAddress && ipAddress !== "local") {
    location = await lookupLocationByIp(ipAddress);
  }

  const page = pageUrl?.trim() || null;
  const ref = referrer?.trim() || null;
  const sourceRef = ref || page;

  const userAgent =
    (typeof clientUserAgent === "string" && clientUserAgent.trim()) ||
    (await getUserAgent(request));
  const accessEnv = summarizeAccessEnv(userAgent);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const rowFull = {
    product_type: productType,
    width_mm: widthMm,
    height_mm: heightMm,
    price_yen: priceYen,
    type_info: typeInfo,
    referrer: sourceRef,
    ip_address: ipAddress,
    location: location,
    access_env: accessEnv,
  };
  const rowGeoOnly = {
    product_type: productType,
    width_mm: widthMm,
    height_mm: heightMm,
    price_yen: priceYen,
    type_info: typeInfo,
    referrer: sourceRef,
    ip_address: ipAddress,
    location: location,
  };
  const rowBase = {
    product_type: productType,
    width_mm: widthMm,
    height_mm: heightMm,
    price_yen: priceYen,
    type_info: typeInfo,
    referrer: sourceRef,
  };

  const isMissingCol = (msg: string) =>
    msg.includes("ip_address") ||
    msg.includes("location") ||
    msg.includes("access_env") ||
    msg.includes("schema cache");

  let { error } = await supabase.from("usage_history").insert(rowFull);
  if (error && isMissingCol(error.message)) {
    ({ error } = await supabase.from("usage_history").insert(rowGeoOnly));
  }
  if (error && isMissingCol(error.message)) {
    ({ error } = await supabase.from("usage_history").insert(rowBase));
  }
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
