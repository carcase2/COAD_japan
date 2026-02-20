import { supabase } from "./supabase";

// 폭 범위: 800~999, 1000~1499, 1500~1999 ... 9500~9999, 10000 이상
export const WIDTH_RANGES = [
  { min: 800, max: 999, label: "800~999" },
  { min: 1000, max: 1499, label: "1000~1499" },
  { min: 1500, max: 1999, label: "1500~1999" },
  { min: 2000, max: 2499, label: "2000~2499" },
  { min: 2500, max: 2999, label: "2500~2999" },
  { min: 3000, max: 3499, label: "3000~3499" },
  { min: 3500, max: 3999, label: "3500~3999" },
  { min: 4000, max: 4499, label: "4000~4499" },
  { min: 4500, max: 4999, label: "4500~4999" },
  { min: 5000, max: 5499, label: "5000~5499" },
  { min: 5500, max: 5999, label: "5500~5999" },
  { min: 6000, max: 6499, label: "6000~6499" },
  { min: 6500, max: 6999, label: "6500~6999" },
  { min: 7000, max: 7499, label: "7000~7499" },
  { min: 7500, max: 7999, label: "7500~7999" },
  { min: 8000, max: 8499, label: "8000~8499" },
  { min: 8500, max: 8999, label: "8500~8999" },
  { min: 9000, max: 9499, label: "9000~9499" },
  { min: 9500, max: 9999, label: "9500~9999" },
  { min: 10000, max: Infinity, label: "10000 이상" },
];

// 높이 범위: 1000~1499, 1500~1999 ... 6000 이상
export const HEIGHT_RANGES = [
  { min: 1000, max: 1499, label: "1000~1499" },
  { min: 1500, max: 1999, label: "1500~1999" },
  { min: 2000, max: 2499, label: "2000~2499" },
  { min: 2500, max: 2999, label: "2500~2999" },
  { min: 3000, max: 3499, label: "3000~3499" },
  { min: 3500, max: 3999, label: "3500~3999" },
  { min: 4000, max: 4499, label: "4000~4499" },
  { min: 4500, max: 4999, label: "4500~4999" },
  { min: 5000, max: 5499, label: "5000~5499" },
  { min: 5500, max: 5999, label: "5500~5999" },
  { min: 6000, max: Infinity, label: "6000 이상" },
];

// C-2, C-3 추가 금액 (기본값, DB에서 불러옴)
export const DEFAULT_C_ADDITIONS = {
  "C-1": 0,
  "C-2": 180000,
  "C-3": 450000,
} as const;

export type CType = "C-1" | "C-2" | "C-3";

// 제품 타입: 시트셔터, 차고셔터
export const PRODUCT_TYPES = {
  sheet_shutter: "시트셔터",
  garage_shutter: "차고셔터",
} as const;

export type ProductType = keyof typeof PRODUCT_TYPES;

// 단가 테이블: widthIndex x heightIndex -> C-1 기준 단가
export type PriceTable = number[][];

// 기본 단가 테이블 (예시)
function getDefaultPriceTable(): PriceTable {
  const table: PriceTable = [];
  for (let w = 0; w < WIDTH_RANGES.length; w++) {
    const row: number[] = [];
    for (let h = 0; h < HEIGHT_RANGES.length; h++) {
      const basePrice = 500000 + (w + h) * 50000;
      row.push(basePrice);
    }
    table.push(row);
  }
  return table;
}

export async function getPriceTable(productType: ProductType): Promise<PriceTable> {
  const { data, error } = await supabase
    .from("unit_prices")
    .select("width_index, height_index, c1_price")
    .eq("product_type", productType);

  if (error) {
    console.error("Supabase getPriceTable error:", error);
    return getDefaultPriceTable();
  }

  if (!data || data.length === 0) {
    return getDefaultPriceTable();
  }

  const table: PriceTable = [];
  for (let w = 0; w < WIDTH_RANGES.length; w++) {
    const row: number[] = [];
    for (let h = 0; h < HEIGHT_RANGES.length; h++) {
      const found = data.find((r) => r.width_index === w && r.height_index === h);
      row.push(found?.c1_price ?? 500000 + (w + h) * 50000);
    }
    table.push(row);
  }
  return table;
}

export async function getCTypeAdditions(): Promise<{ c2: number; c3: number }> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("c2_addition, c3_addition")
    .eq("id", 1)
    .single();

  if (error || !data) {
    return { c2: DEFAULT_C_ADDITIONS["C-2"], c3: DEFAULT_C_ADDITIONS["C-3"] };
  }
  return { c2: data.c2_addition ?? 180000, c3: data.c3_addition ?? 450000 };
}

export async function saveCTypeAdditions(c2: number, c3: number): Promise<void> {
  const { error } = await supabase
    .from("app_settings")
    .upsert(
      { id: 1, c2_addition: c2, c3_addition: c3 },
      { onConflict: "id" }
    );

  if (error) {
    console.error("Supabase saveCTypeAdditions error:", {
      message: error.message,
      code: error.code,
      details: error.details,
    });
    throw error;
  }
}

export async function savePriceCell(
  productType: ProductType,
  widthIndex: number,
  heightIndex: number,
  c1Price: number
): Promise<void> {
  const { error } = await supabase.from("unit_prices").upsert(
    {
      product_type: productType,
      width_index: widthIndex,
      height_index: heightIndex,
      c1_price: c1Price,
    },
    {
      onConflict: "product_type,width_index,height_index",
    }
  );

  if (error) {
    console.error("Supabase savePriceCell error:", error);
    throw error;
  }
}

export function getWidthIndex(width: number): number {
  for (let i = 0; i < WIDTH_RANGES.length; i++) {
    if (width >= WIDTH_RANGES[i].min && width <= WIDTH_RANGES[i].max) return i;
  }
  return -1;
}

export function getHeightIndex(height: number): number {
  for (let i = 0; i < HEIGHT_RANGES.length; i++) {
    if (height >= HEIGHT_RANGES[i].min && height <= HEIGHT_RANGES[i].max) return i;
  }
  return -1;
}

export function calculatePrice(
  width: number,
  height: number,
  cType: CType,
  table: PriceTable,
  additions: { c2: number; c3: number }
): number | null {
  const wIdx = getWidthIndex(width);
  const hIdx = getHeightIndex(height);
  if (wIdx < 0 || hIdx < 0) return null;
  const c1Price = table[wIdx]?.[hIdx] ?? 0;
  const add = cType === "C-1" ? 0 : cType === "C-2" ? additions.c2 : additions.c3;
  return c1Price + add;
}
