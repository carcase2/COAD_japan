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

// 높이 범위: 1000~1499, 1500~1999 ... 6000 이상 (시트셔터)
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

// 차고셔터 전용: 폭 ~2400, ~2700, ~3000, ~3500, ~4000, ~5000, ~6000
export const GARAGE_WIDTH_RANGES = [
  { min: 0, max: 2400, label: "~2400" },
  { min: 2401, max: 2700, label: "~2700" },
  { min: 2701, max: 3000, label: "~3000" },
  { min: 3001, max: 3500, label: "~3500" },
  { min: 3501, max: 4000, label: "~4000" },
  { min: 4001, max: 5000, label: "~5000" },
  { min: 5001, max: 6000, label: "~6000" },
];

// 차고셔터 전용: 높이 ~2100, ~2400, ~2700
export const GARAGE_HEIGHT_RANGES = [
  { min: 0, max: 2100, label: "~2100" },
  { min: 2101, max: 2400, label: "~2400" },
  { min: 2401, max: 2700, label: "~2700" },
];

// 차고셔터 4종: 기본, 우드판넬(기본×배율), 다크계열(우드+엔), 프리미엄판넬(우드+엔)
export const GARAGE_PANEL_TYPES = {
  base: "기본",
  wood: "우드판넬",
  dark: "다크계열",
  premium: "프리미엄판넬",
} as const;

export type GaragePanelType = keyof typeof GARAGE_PANEL_TYPES;

// 사양 입력용: 기본 제외 (우드/다크/프리미엄만 선택)
export const GARAGE_PANEL_TYPES_SELECTABLE: GaragePanelType[] = ["wood", "dark", "premium"];

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

// 단가 테이블: widthIndex x heightIndex -> 기준 단가 (시트: C-1, 차고: 기본)
export type PriceTable = number[][];

function getDefaultSheetPriceTable(): PriceTable {
  const table: PriceTable = [];
  for (let w = 0; w < WIDTH_RANGES.length; w++) {
    const row: number[] = [];
    for (let h = 0; h < HEIGHT_RANGES.length; h++) {
      row.push(500000 + (w + h) * 50000);
    }
    table.push(row);
  }
  return table;
}

function getDefaultGaragePriceTable(): PriceTable {
  const table: PriceTable = [];
  for (let w = 0; w < GARAGE_WIDTH_RANGES.length; w++) {
    const row: number[] = [];
    for (let h = 0; h < GARAGE_HEIGHT_RANGES.length; h++) {
      row.push(500000 + (w + h) * 50000);
    }
    table.push(row);
  }
  return table;
}

export async function getPriceTable(productType: ProductType): Promise<PriceTable> {
  const isGarage = productType === "garage_shutter";
  const numW = isGarage ? GARAGE_WIDTH_RANGES.length : WIDTH_RANGES.length;
  const numH = isGarage ? GARAGE_HEIGHT_RANGES.length : HEIGHT_RANGES.length;

  const { data, error } = await supabase
    .from("unit_prices")
    .select("width_index, height_index, c1_price")
    .eq("product_type", productType);

  if (error) {
    console.error("Supabase getPriceTable error:", error);
    return isGarage ? getDefaultGaragePriceTable() : getDefaultSheetPriceTable();
  }

  if (!data || data.length === 0) {
    return isGarage ? getDefaultGaragePriceTable() : getDefaultSheetPriceTable();
  }

  const table: PriceTable = [];
  const defaultTable = isGarage ? getDefaultGaragePriceTable() : getDefaultSheetPriceTable();
  for (let w = 0; w < numW; w++) {
    const row: number[] = [];
    for (let h = 0; h < numH; h++) {
      const found = data.find((r) => r.width_index === w && r.height_index === h);
      row.push(found?.c1_price ?? defaultTable[w]?.[h] ?? 500000 + (w + h) * 50000);
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

// 차고셔터 패널 설정 (DB): 우드 배율, 다크/프리미엄 추가엔, 전체 추가엔
const DEFAULT_GARAGE_WOOD_MULT = 1.25;
const DEFAULT_GARAGE_DARK_ADD = 187000;
const DEFAULT_GARAGE_PREMIUM_ADD = 440000;
const DEFAULT_GARAGE_GLOBAL_ADD = 0;

export async function getGaragePanelSettings(): Promise<{
  woodMultiplier: number;
  darkAddition: number;
  premiumAddition: number;
  globalAddition: number;
}> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("garage_wood_multiplier, garage_dark_addition, garage_premium_addition, garage_global_addition")
    .eq("id", 1)
    .single();

  if (error || !data) {
    return {
      woodMultiplier: DEFAULT_GARAGE_WOOD_MULT,
      darkAddition: DEFAULT_GARAGE_DARK_ADD,
      premiumAddition: DEFAULT_GARAGE_PREMIUM_ADD,
      globalAddition: DEFAULT_GARAGE_GLOBAL_ADD,
    };
  }
  return {
    woodMultiplier: Number(data.garage_wood_multiplier ?? DEFAULT_GARAGE_WOOD_MULT),
    darkAddition: Number(data.garage_dark_addition ?? DEFAULT_GARAGE_DARK_ADD),
    premiumAddition: Number(data.garage_premium_addition ?? DEFAULT_GARAGE_PREMIUM_ADD),
    globalAddition: Number(data.garage_global_addition ?? DEFAULT_GARAGE_GLOBAL_ADD),
  };
}

export async function saveGaragePanelSettings(
  woodMultiplier: number,
  darkAddition: number,
  premiumAddition: number,
  globalAddition: number
): Promise<void> {
  const { error } = await supabase
    .from("app_settings")
    .update({
      garage_wood_multiplier: woodMultiplier,
      garage_dark_addition: darkAddition,
      garage_premium_addition: premiumAddition,
      garage_global_addition: globalAddition,
    })
    .eq("id", 1);

  if (error) {
    console.error("Supabase saveGaragePanelSettings error:", {
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

export function getGarageWidthIndex(width: number): number {
  for (let i = 0; i < GARAGE_WIDTH_RANGES.length; i++) {
    if (width >= GARAGE_WIDTH_RANGES[i].min && width <= GARAGE_WIDTH_RANGES[i].max) return i;
  }
  return -1;
}

export function getGarageHeightIndex(height: number): number {
  for (let i = 0; i < GARAGE_HEIGHT_RANGES.length; i++) {
    if (height >= GARAGE_HEIGHT_RANGES[i].min && height <= GARAGE_HEIGHT_RANGES[i].max) return i;
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

// 차고셔터: 기본 단가 + 패널 타입별 계산 (전체 추가 금액은 '전체 테이블에 적용' 시에만 단가에 반영됨)
export function calculateGaragePrice(
  width: number,
  height: number,
  panelType: GaragePanelType,
  table: PriceTable,
  settings: { woodMultiplier: number; darkAddition: number; premiumAddition: number }
): number | null {
  const wIdx = getGarageWidthIndex(width);
  const hIdx = getGarageHeightIndex(height);
  if (wIdx < 0 || hIdx < 0) return null;
  const base = table[wIdx]?.[hIdx] ?? 0;
  const wood = Math.round(base * settings.woodMultiplier);
  if (panelType === "base") return base;
  if (panelType === "wood") return wood;
  if (panelType === "dark") return wood + settings.darkAddition;
  return wood + settings.premiumAddition;
}

// 차고셔터 테이블 셀 표시용: 기본 단가와 패널 설정으로 패널별 금액
export function getGarageDisplayPrice(
  basePrice: number,
  panelType: GaragePanelType,
  settings: { woodMultiplier: number; darkAddition: number; premiumAddition: number }
): number {
  const wood = Math.round(basePrice * settings.woodMultiplier);
  if (panelType === "base") return basePrice;
  if (panelType === "wood") return wood;
  if (panelType === "dark") return wood + settings.darkAddition;
  return wood + settings.premiumAddition;
}

// 차고셔터: 전체 추가 금액은 우드판넬에 더해지는 금액. 기본 단가에는 (금액÷우드 배율)을 더해 DB에 반영.
export async function applyGarageGlobalAdditionToTable(
  amount: number,
  woodMultiplier: number
): Promise<void> {
  if (amount === 0) return;
  const additionToBase = Math.round(amount / woodMultiplier);
  if (additionToBase === 0) return;

  const { data: rows, error: fetchError } = await supabase
    .from("unit_prices")
    .select("width_index, height_index, c1_price")
    .eq("product_type", "garage_shutter");

  if (fetchError) {
    console.error("applyGarageGlobalAdditionToTable fetch error:", fetchError);
    throw fetchError;
  }
  if (!rows?.length) return;

  for (const row of rows) {
    const newPrice = (row.c1_price ?? 0) + additionToBase;
    const { error: upsertError } = await supabase.from("unit_prices").upsert(
      {
        product_type: "garage_shutter",
        width_index: row.width_index,
        height_index: row.height_index,
        c1_price: newPrice,
      },
      { onConflict: "product_type,width_index,height_index" }
    );
    if (upsertError) {
      console.error("applyGarageGlobalAdditionToTable upsert error:", upsertError);
      throw upsertError;
    }
  }

  await supabase.from("app_settings").update({ garage_global_addition: 0 }).eq("id", 1);
}
