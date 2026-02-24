import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const PASSWORD = process.env.USAGE_HISTORY_PASSWORD ?? "3805";

export async function GET(request: Request) {
  const p = new URL(request.url).searchParams.get("p");
  if (p !== PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  type Row = { id: string; created_at: string; product_type: string; width_mm: number; height_mm: number; price_yen: number; type_info: string; referrer: string | null; ip_address: string | null; location: string | null };
  const fullSelect = "id, created_at, product_type, width_mm, height_mm, price_yen, type_info, referrer, ip_address, location";
  const result = await supabase
    .from("usage_history")
    .select(fullSelect)
    .order("created_at", { ascending: false })
    .limit(500);

  let data: Row[];
  if (result.error && (result.error.message.includes("ip_address") || result.error.message.includes("location") || result.error.message.includes("schema cache"))) {
    const fallback = await supabase
      .from("usage_history")
      .select("id, created_at, product_type, width_mm, height_mm, price_yen, type_info, referrer")
      .order("created_at", { ascending: false })
      .limit(500);
    if (fallback.error) {
      return NextResponse.json({ error: fallback.error.message }, { status: 500 });
    }
    data = (fallback.data ?? []).map((row) => ({ ...row, ip_address: null, location: null }));
  } else if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  } else {
    data = (result.data ?? []) as Row[];
  }
  return NextResponse.json(data);
}
