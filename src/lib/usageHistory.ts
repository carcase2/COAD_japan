export type ProductType = "sheet_shutter" | "garage_shutter";

/** 서버 API로 기록 (IP·위치는 서버에서 자동 수집) */
export async function recordUsage(params: {
  productType: ProductType;
  widthMm: number;
  heightMm: number;
  priceYen: number;
  typeInfo: string;
  referrer?: string | null;
  pageUrl?: string | null;
}): Promise<void> {
  try {
    const res = await fetch("/api/record-usage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productType: params.productType,
        widthMm: params.widthMm,
        heightMm: params.heightMm,
        priceYen: params.priceYen,
        typeInfo: params.typeInfo,
        referrer: params.referrer ?? null,
        pageUrl: params.pageUrl ?? (typeof window !== "undefined" ? window.location.href : null),
        clientUserAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      }),
    });
    if (!res.ok) console.error("[usage_history] record error:", await res.text());
  } catch (e) {
    console.error("[usage_history] record error:", e);
  }
}
