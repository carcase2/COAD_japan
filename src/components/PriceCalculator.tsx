"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  getPriceTable,
  savePriceCell,
  getCTypeAdditions,
  saveCTypeAdditions,
  getGaragePanelSettings,
  saveGaragePanelSettings,
  applyGarageGlobalAdditionToTable,
  calculatePrice,
  calculateGaragePrice,
  getGarageDisplayPrice,
  WIDTH_RANGES,
  HEIGHT_RANGES,
  GARAGE_WIDTH_RANGES,
  GARAGE_HEIGHT_RANGES,
  GARAGE_PANEL_TYPES,
  GARAGE_PANEL_TYPES_SELECTABLE,
  PRODUCT_TYPES,
  type CType,
  type PriceTable,
  type ProductType,
  type GaragePanelType,
} from "@/lib/price";
import { recordUsage } from "@/lib/usageHistory";

export default function PriceCalculator() {
  const pathname = usePathname();
  const [productType, setProductType] = useState<ProductType>("sheet_shutter");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [cType, setCType] = useState<CType>("C-1");
  const [price, setPrice] = useState<number | null>(null);
  const [table, setTable] = useState<PriceTable>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [tableCType, setTableCType] = useState<CType>("C-1");
  const [c2Addition, setC2Addition] = useState(180000);
  const [c3Addition, setC3Addition] = useState(450000);
  const [savingAdditions, setSavingAdditions] = useState(false);
  const [editModal, setEditModal] = useState<{ wIdx: number; hIdx: number } | null>(null);
  const [editModalValue, setEditModalValue] = useState("");
  // 차고셔터: 4종 패널 타입 및 설정
  const [garagePanelType, setGaragePanelType] = useState<GaragePanelType>("wood");
  const [tableGaragePanelType, setTableGaragePanelType] = useState<GaragePanelType>("base");
  const [woodMultiplier, setWoodMultiplier] = useState(1.25);
  const [woodMultiplierInput, setWoodMultiplierInput] = useState("1.25"); // 소수점 입력용 문자열
  const [darkAddition, setDarkAddition] = useState(187000);
  const [premiumAddition, setPremiumAddition] = useState(440000);
  const [globalAddition, setGlobalAddition] = useState(0);
  const [globalAdditionInput, setGlobalAdditionInput] = useState("0"); // 마이너스 입력 허용용
  const [savingGarageSettings, setSavingGarageSettings] = useState(false);
  const [applyingGlobalAddition, setApplyingGlobalAddition] = useState(false);
  // 비밀 버튼 → 히스토리
  const [secretModalOpen, setSecretModalOpen] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [historyUnlocked, setHistoryUnlocked] = useState(false);
  const [historyList, setHistoryList] = useState<Array<{ id: string; created_at: string; product_type: string; width_mm: number; height_mm: number; price_yen: number; type_info: string; referrer: string | null; ip_address: string | null; location: string | null }>>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const lastRecordedKeyRef = useRef<string>("");
  const historyPasswordRef = useRef<string>("");
  const passwordInputRef = useRef<HTMLInputElement>(null);

  const additions = { c2: c2Addition, c3: c3Addition };
  const garageSettings = { woodMultiplier, darkAddition, premiumAddition };

  const loadTable = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getPriceTable(productType);
      setTable(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [productType]);

  useEffect(() => {
    loadTable();
  }, [loadTable]);

  useEffect(() => {
    getCTypeAdditions().then((a) => {
      setC2Addition(a.c2);
      setC3Addition(a.c3);
    });
    getGaragePanelSettings().then((s) => {
      setWoodMultiplier(s.woodMultiplier);
      setWoodMultiplierInput(String(s.woodMultiplier));
      setDarkAddition(s.darkAddition);
      setPremiumAddition(s.premiumAddition);
      setGlobalAddition(s.globalAddition);
      setGlobalAdditionInput(String(s.globalAddition));
    });
  }, []);

  useEffect(() => {
    const w = parseInt(width, 10);
    const h = parseInt(height, 10);
    if (isNaN(w) || isNaN(h) || table.length === 0) {
      setPrice(null);
      return;
    }
    if (productType === "garage_shutter") {
      const p = calculateGaragePrice(w, h, garagePanelType, table, garageSettings);
      setPrice(p);
    } else {
      const p = calculatePrice(w, h, cType, table, additions);
      setPrice(p);
    }
  }, [width, height, cType, garagePanelType, productType, table, additions, garageSettings]);

  // 사용 히스토리 기록 (가격 계산 시 디바운스 2초, 동일 계산 중복 제외)
  useEffect(() => {
    const w = parseInt(width, 10);
    const h = parseInt(height, 10);
    if (isNaN(w) || isNaN(h) || price === null) return;
    const typeInfo = productType === "garage_shutter" ? (GARAGE_PANEL_TYPES[garagePanelType] ?? garagePanelType) : cType;
    const key = `${productType}-${w}-${h}-${typeInfo}-${price}`;
    if (lastRecordedKeyRef.current === key) return;
    const t = setTimeout(() => {
      lastRecordedKeyRef.current = key;
      recordUsage({
        productType,
        widthMm: w,
        heightMm: h,
        priceYen: price,
        typeInfo,
        referrer: typeof document !== "undefined" ? document.referrer || null : null,
      }).catch(() => {});
    }, 2000);
    return () => clearTimeout(t);
  }, [width, height, price, productType, cType, garagePanelType]);

  const openEditModal = (wIdx: number, hIdx: number) => {
    setEditModal({ wIdx, hIdx });
    setEditModalValue(String(table[wIdx]?.[hIdx] ?? 0));
  };

  const closeEditModal = () => {
    setEditModal(null);
    setEditModalValue("");
  };

  const handleModalSave = async () => {
    if (!editModal) return;
    const num = parseFormatted(editModalValue);
    const { wIdx, hIdx } = editModal;
    const newTable = table.map((row, i) =>
      i === wIdx ? row.map((v, j) => (j === hIdx ? num : v)) : row
    );
    setTable(newTable);
    setSaving(true);
    try {
      await savePriceCell(productType, wIdx, hIdx, num);
      closeEditModal();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const getDisplayPrice = (wIdx: number, hIdx: number, ct: CType): number => {
    const c1 = table[wIdx]?.[hIdx] ?? 0;
    const add = ct === "C-1" ? 0 : ct === "C-2" ? c2Addition : c3Addition;
    return c1 + add;
  };

  const handleSaveAdditions = async () => {
    setSavingAdditions(true);
    try {
      await saveCTypeAdditions(c2Addition, c3Addition);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingAdditions(false);
    }
  };

  const handleSaveGarageSettings = async () => {
    setSavingGarageSettings(true);
    try {
      await saveGaragePanelSettings(woodMultiplier, darkAddition, premiumAddition, globalAddition);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingGarageSettings(false);
    }
  };

  const handleApplyGlobalAddition = async () => {
    if (globalAddition === 0) return;
    setApplyingGlobalAddition(true);
    try {
      await applyGarageGlobalAdditionToTable(globalAddition, woodMultiplier);
      setGlobalAddition(0);
      setGlobalAdditionInput("0");
      await loadTable();
    } catch (err) {
      console.error(err);
    } finally {
      setApplyingGlobalAddition(false);
    }
  };

  const formatNumber = (n: number) => n.toLocaleString("ko-KR");
  const formatPrice = formatNumber;
  const parseFormatted = (s: string) => parseInt(s.replace(/\D/g, ""), 10) || 0;

  const fetchHistory = useCallback(async () => {
    const p = historyPasswordRef.current;
    if (!p) return;
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/usage-history?p=${encodeURIComponent(p)}`);
      if (!res.ok) throw new Error("Unauthorized");
      const data = await res.json();
      setHistoryList(Array.isArray(data) ? data : []);
    } catch {
      setHistoryList([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (secretModalOpen) {
      const t = setTimeout(() => passwordInputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [secretModalOpen]);

  const goHome = useCallback(() => {
    setHistoryUnlocked(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleSecretSubmit = () => {
    if (passwordInput !== "3805") {
      setPasswordInput("");
      return;
    }
    historyPasswordRef.current = passwordInput;
    setHistoryUnlocked(true);
    setSecretModalOpen(false);
    setPasswordInput("");
    fetchHistory();
  };

  const isGarageShutter = productType === "garage_shutter";
  const isSheetShutter = productType === "sheet_shutter";

  const theme = {
    page: isSheetShutter
      ? "min-h-screen bg-gradient-to-b from-emerald-50 via-emerald-50/95 to-emerald-100/80 py-6 px-4 sm:py-8 sm:px-6"
      : "min-h-screen bg-gradient-to-b from-amber-50 via-amber-50/95 to-amber-100/80 py-6 px-4 sm:py-8 sm:px-6",
    headerTitle: isSheetShutter ? "text-emerald-900" : "text-amber-900",
    headerDesc: isSheetShutter ? "text-emerald-700/80" : "text-amber-700/80",
    section: isSheetShutter
      ? "rounded-xl border-2 border-emerald-200/80 bg-white/90 shadow-sm shadow-emerald-100/50 p-5 sm:p-6"
      : "rounded-xl border-2 border-amber-200/80 bg-white/90 shadow-sm shadow-amber-100/50 p-5 sm:p-6",
    sectionTitle: isSheetShutter ? "text-emerald-800" : "text-amber-800",
  };

  // 타입 선택에 따른 예상 가격 박스 색상 (시트: C-1/C-2/C-3, 차고: 우드/다크/프리미엄)
  const priceBoxTheme = isGarageShutter
    ? garagePanelType === "wood"
      ? { border: "border-amber-300/80", bg: "bg-gradient-to-br from-amber-50 to-amber-100/60", label: "text-amber-700", value: "text-amber-800", sub: "text-amber-600/80" }
      : garagePanelType === "dark"
        ? { border: "border-slate-300/80", bg: "bg-gradient-to-br from-slate-50 to-slate-100/60", label: "text-slate-700", value: "text-slate-800", sub: "text-slate-600/80" }
        : { border: "border-amber-400/80", bg: "bg-gradient-to-br from-amber-100/80 to-amber-200/50", label: "text-amber-800", value: "text-amber-900", sub: "text-amber-700/80" }
    : cType === "C-1"
      ? { border: "border-slate-300/80", bg: "bg-gradient-to-br from-slate-50 to-slate-100/60", label: "text-slate-700", value: "text-slate-800", sub: "text-slate-600/80" }
      : cType === "C-2"
        ? { border: "border-blue-300/80", bg: "bg-gradient-to-br from-blue-50 to-blue-100/60", label: "text-blue-700", value: "text-blue-800", sub: "text-blue-600/80" }
        : { border: "border-violet-300/80", bg: "bg-gradient-to-br from-violet-50 to-violet-100/60", label: "text-violet-700", value: "text-violet-800", sub: "text-violet-600/80" };

  return (
    <div className={theme.page}>
      <div className="mx-auto max-w-4xl space-y-6 sm:space-y-8">
        <header className="relative pb-2">
          <button
            type="button"
            onClick={() => setSecretModalOpen(true)}
            className="absolute right-0 top-0 h-8 w-8 rounded-full border-0 bg-transparent opacity-[0.07] hover:opacity-20 focus:opacity-20 focus:outline-none focus:ring-0"
            style={{ background: "currentColor" }}
            title=""
            aria-label="비밀"
          />
          <div className="flex items-start gap-2">
            <Link
              href="/"
              onClick={(e) => { if (pathname === "/") { e.preventDefault(); goHome(); } }}
              className="shrink-0 rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-200/50 hover:text-slate-700"
              title="홈"
              aria-label="홈"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </Link>
            <div>
              <h1>
                <Link
                  href="/"
                  onClick={(e) => { if (pathname === "/") { e.preventDefault(); goHome(); } }}
                  className={`block text-2xl font-bold tracking-tight sm:text-3xl ${theme.headerTitle} hover:underline`}
                >
                  COAD 견적 전 가격 계산
                </Link>
              </h1>
              <p className={`mt-1 text-sm ${theme.headerDesc}`}>일본에서 견적서 작성 전, 폭·높이와 타입으로 미리 예상 가격을 확인할 수 있습니다.</p>
            </div>
          </div>
        </header>

        {/* 사용 히스토리 (비밀번호 인증 후) */}
        {historyUnlocked && (
          <section className="rounded-xl border-2 border-slate-300 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-slate-800 sm:text-lg">사용 히스토리</h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={fetchHistory}
                  disabled={historyLoading}
                  className="rounded-lg bg-slate-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                >
                  {historyLoading ? "로딩…" : "새로고침"}
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryUnlocked(false)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  닫기
                </button>
              </div>
            </div>
            {historyList.length === 0 && !historyLoading ? (
              <p className="py-4 text-center text-sm text-slate-500">기록이 없습니다.</p>
            ) : (
              <>
                {/* 통계 + 그래프 */}
                {(() => {
                  const total = historyList.length;
                  const sheet = historyList.filter((r) => r.product_type === "sheet_shutter").length;
                  const garage = historyList.filter((r) => r.product_type === "garage_shutter").length;
                  const sumYen = historyList.reduce((a, r) => a + r.price_yen, 0);
                  const now = new Date();
                  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                  const weekStart = new Date(todayStart);
                  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
                  const todayCount = historyList.filter((r) => new Date(r.created_at) >= todayStart).length;
                  const weekCount = historyList.filter((r) => new Date(r.created_at) >= weekStart).length;
                  const olderCount = total - weekCount;
                  const uniqueIps = new Set(historyList.map((r) => r.ip_address).filter(Boolean)).size;
                  const sheetPct = total ? (sheet / total) * 100 : 0;
                  const garagePct = total ? (garage / total) * 100 : 0;
                  const todayPct = total ? (todayCount / total) * 100 : 0;
                  const weekOnlyPct = total ? ((weekCount - todayCount) / total) * 100 : 0;
                  const olderPct = total ? (olderCount / total) * 100 : 0;
                  return (
                    <div className="mb-5 space-y-5">
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">총 사용 횟수</p>
                          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-800">{formatPrice(total)}<span className="ml-0.5 text-base font-normal text-slate-500">회</span></p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">총 견적 합계</p>
                          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-800">¥{formatPrice(sumYen)}</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">접속지 수</p>
                          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-800">{uniqueIps}<span className="ml-0.5 text-base font-normal text-slate-500">곳</span></p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">오늘 / 이번 주</p>
                          <p className="mt-1 text-lg font-bold tabular-nums text-slate-800">오늘 {todayCount}회 · 주 {weekCount}회</p>
                        </div>
                      </div>
                      <div className="grid gap-5 lg:grid-cols-2">
                        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                          <p className="mb-3 text-sm font-semibold text-slate-700">제품별 사용 비율</p>
                          <div className="space-y-2">
                            <div className="flex items-center gap-3">
                              <span className="w-20 shrink-0 text-xs text-slate-600">시트셔터</span>
                              <div className="h-6 flex-1 overflow-hidden rounded-full bg-slate-100">
                                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${sheetPct}%` }} />
                              </div>
                              <span className="w-10 shrink-0 text-right text-xs font-medium tabular-nums text-slate-600">{sheet}회</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="w-20 shrink-0 text-xs text-slate-600">차고셔터</span>
                              <div className="h-6 flex-1 overflow-hidden rounded-full bg-slate-100">
                                <div className="h-full rounded-full bg-amber-500" style={{ width: `${garagePct}%` }} />
                              </div>
                              <span className="w-10 shrink-0 text-right text-xs font-medium tabular-nums text-slate-600">{garage}회</span>
                            </div>
                          </div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                          <p className="mb-3 text-sm font-semibold text-slate-700">기간별 사용 비율</p>
                          <div className="space-y-2">
                            <div className="flex items-center gap-3">
                              <span className="w-16 shrink-0 text-xs text-slate-600">오늘</span>
                              <div className="h-6 flex-1 overflow-hidden rounded-full bg-slate-100">
                                <div className="h-full rounded-full bg-blue-500" style={{ width: `${todayPct}%` }} />
                              </div>
                              <span className="w-10 shrink-0 text-right text-xs font-medium tabular-nums text-slate-600">{todayCount}회</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="w-16 shrink-0 text-xs text-slate-600">이번 주</span>
                              <div className="h-6 flex-1 overflow-hidden rounded-full bg-slate-100">
                                <div className="h-full rounded-full bg-indigo-400" style={{ width: `${weekOnlyPct}%` }} />
                              </div>
                              <span className="w-10 shrink-0 text-right text-xs font-medium tabular-nums text-slate-600">{weekCount - todayCount}회</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="w-16 shrink-0 text-xs text-slate-600">그 이전</span>
                              <div className="h-6 flex-1 overflow-hidden rounded-full bg-slate-100">
                                <div className="h-full rounded-full bg-slate-400" style={{ width: `${olderPct}%` }} />
                              </div>
                              <span className="w-10 shrink-0 text-right text-xs font-medium tabular-nums text-slate-600">{olderCount}회</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">일시</th>
                      <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">제품</th>
                      <th className="border-b border-slate-200 px-3 py-2 text-center font-semibold text-slate-700">폭×높이</th>
                      <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">타입</th>
                      <th className="border-b border-slate-200 px-3 py-2 text-right font-semibold text-slate-700">가격(엔)</th>
                      <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">IP</th>
                      <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">위치</th>
                      <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">출처</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyList.map((row) => (
                      <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                          {new Date(row.created_at).toLocaleString("ko-KR")}
                        </td>
                        <td className="px-3 py-2 text-slate-800">
                          {row.product_type === "sheet_shutter" ? "시트셔터" : "차고셔터"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-center text-slate-700">
                          {row.width_mm}×{row.height_mm}
                        </td>
                        <td className="px-3 py-2 text-slate-700">{row.type_info}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right font-medium tabular-nums text-slate-800">
                          ¥{formatPrice(row.price_yen)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 font-mono text-sm text-slate-600">
                          {row.ip_address || "—"}
                        </td>
                        <td className="max-w-[10rem] truncate px-3 py-2 text-slate-600" title={row.location ?? ""}>
                          {row.location || "—"}
                        </td>
                        <td className="max-w-[12rem] truncate px-3 py-2 text-slate-500" title={row.referrer ?? ""}>
                          {row.referrer || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </>
            )}
          </section>
        )}

        {/* 모델 선택 */}
        <section className={theme.section}>
          <h2 className={`mb-4 text-base font-semibold sm:text-lg ${theme.sectionTitle}`}>모델 선택</h2>
          <div className="flex gap-4">
            {(Object.keys(PRODUCT_TYPES) as ProductType[]).map((pt) => (
              <button
                key={pt}
                onClick={() => setProductType(pt)}
                className={`flex-1 rounded-xl px-6 py-4 text-lg font-bold shadow-md transition-all duration-200 ${
                  pt === "sheet_shutter"
                    ? productType === pt
                      ? "bg-emerald-600 text-white ring-2 ring-emerald-400 ring-offset-2"
                      : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-2 border-emerald-200"
                    : productType === pt
                      ? "bg-amber-500 text-white ring-2 ring-amber-400 ring-offset-2"
                      : "bg-amber-50 text-amber-700 hover:bg-amber-100 border-2 border-amber-200"
                }`}
              >
                {PRODUCT_TYPES[pt]}
              </button>
            ))}
          </div>
          {isGarageShutter && (
            <p className="mt-3 text-sm text-amber-700/90">
              차고셔터: 폭 2400~6000mm, 높이 2100~2700mm · 우드판넬·다크계열·프리미엄판넬
            </p>
          )}
        </section>

        {/* 계산기 폼 */}
        <section className={theme.section}>
          <h2 className={`mb-4 text-base font-semibold sm:text-lg ${theme.sectionTitle}`}>사양 입력</h2>
          <div className="flex flex-wrap items-end gap-6 sm:gap-8">
            <div className="flex flex-col gap-1">
              <label className={isSheetShutter ? "text-sm font-medium text-emerald-800" : "text-sm font-medium text-amber-800"}>
                폭 <span className={isSheetShutter ? "font-normal text-emerald-600" : "font-normal text-amber-600"}>(mm)</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={width ? formatNumber(parseFormatted(width)) : width}
                onChange={(e) => setWidth(e.target.value.replace(/\D/g, ""))}
                placeholder={isGarageShutter ? "2400~6000" : "800~10000+"}
                className={`w-36 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 transition-colors placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                  isSheetShutter ? "focus:border-emerald-500 focus:ring-emerald-500/20" : "focus:border-amber-500 focus:ring-amber-500/20"
                }`}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className={isSheetShutter ? "text-sm font-medium text-emerald-800" : "text-sm font-medium text-amber-800"}>
                높이 <span className={isSheetShutter ? "font-normal text-emerald-600" : "font-normal text-amber-600"}>(mm)</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={height ? formatNumber(parseFormatted(height)) : height}
                onChange={(e) => setHeight(e.target.value.replace(/\D/g, ""))}
                placeholder={isGarageShutter ? "2100~2700" : "1000~6000+"}
                className={`w-36 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 transition-colors placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                  isSheetShutter ? "focus:border-emerald-500 focus:ring-emerald-500/20" : "focus:border-amber-500 focus:ring-amber-500/20"
                }`}
              />
            </div>
            <div>
              <label className={`mb-2 block text-sm font-medium ${theme.sectionTitle}`}>타입</label>
              {isGarageShutter ? (
                <div className="flex flex-wrap gap-2">
                  {GARAGE_PANEL_TYPES_SELECTABLE.map((pt) => (
                    <button
                      key={pt}
                      onClick={() => setGaragePanelType(pt)}
                      type="button"
                      className={`rounded-lg px-4 py-2 text-sm font-bold transition-all duration-200 ${
                        pt === "wood"
                          ? garagePanelType === pt
                            ? "bg-amber-600 text-white ring-2 ring-amber-400 ring-offset-2"
                            : "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200"
                          : pt === "dark"
                            ? garagePanelType === pt
                              ? "bg-slate-600 text-white ring-2 ring-slate-400 ring-offset-2"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-300"
                            : garagePanelType === pt
                              ? "bg-amber-700 text-white ring-2 ring-amber-400 ring-offset-2"
                              : "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200"
                      }`}
                    >
                      {GARAGE_PANEL_TYPES[pt]}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex gap-2">
                  {(["C-1", "C-2", "C-3"] as CType[]).map((ct) => (
                    <button
                      key={ct}
                      onClick={() => setCType(ct)}
                      type="button"
                      className={`rounded-lg px-4 py-2 text-sm font-bold transition-all duration-200 ${
                        ct === "C-1"
                          ? cType === ct
                            ? "bg-slate-700 text-white ring-2 ring-slate-400 ring-offset-2"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-300"
                          : ct === "C-2"
                            ? cType === ct
                              ? "bg-blue-600 text-white ring-2 ring-blue-400 ring-offset-2"
                              : "bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
                            : cType === ct
                              ? "bg-violet-600 text-white ring-2 ring-violet-400 ring-offset-2"
                              : "bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200"
                      }`}
                    >
                      {ct}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className={`mt-5 rounded-xl border-2 px-5 py-4 sm:px-6 sm:py-5 ${priceBoxTheme.border} ${priceBoxTheme.bg}`}>
            <p className={`text-sm font-medium ${priceBoxTheme.label}`}>예상 가격</p>
            <p className={`mt-1 text-2xl font-bold tabular-nums sm:text-3xl ${priceBoxTheme.value}`}>
              {loading ? "로딩 중…" : price !== null ? `¥${formatPrice(price)}` : "—"}
            </p>
            <p className={`mt-0.5 text-sm ${priceBoxTheme.sub}`}>엔 (일본엔)</p>
          </div>
        </section>

        {/* 단가 테이블 보기 */}
        <section
          className={`rounded-xl border-2 transition-all duration-200 ${
            showTable
              ? isSheetShutter
                ? "border-emerald-300 bg-white shadow-sm shadow-emerald-100/40"
                : "border-amber-300 bg-white shadow-sm shadow-amber-100/40"
              : isSheetShutter
                ? "border-emerald-200 border-dashed bg-emerald-50/60"
                : "border-amber-200 border-dashed bg-amber-50/60"
          }`}
        >
          <button
            type="button"
            onClick={() => setShowTable(!showTable)}
            className={`flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors sm:px-6 ${
              isSheetShutter ? "hover:bg-emerald-100/50" : "hover:bg-amber-100/50"
            }`}
          >
            <span className={isSheetShutter ? "text-emerald-500" : "text-amber-500"} aria-hidden>
              {showTable ? "▾" : "▸"}
            </span>
            <span className={`flex-1 text-left font-semibold ${theme.sectionTitle}`}>
              {showTable ? "단가 테이블 숨기기" : "단가 테이블 보기"}
            </span>
            {!showTable && (
              <span className={isSheetShutter ? "text-sm font-normal text-emerald-600/80" : "text-sm font-normal text-amber-600/80"}>
                단가 수정 시 여기서 진행
              </span>
            )}
          </button>

          {/* 단가 테이블 (보기 클릭 시 표시) */}
          {showTable && (
          <section
            className={`overflow-x-auto border-t px-4 py-5 sm:p-6 ${
              isSheetShutter ? "border-emerald-200/80 bg-emerald-50/30" : "border-amber-200/80 bg-amber-50/30"
            }`}
          >
            {/* 시트셔터: C-2, C-3 추가 금액 | 차고셔터: 패널 설정 (DB 저장) */}
            {!isGarageShutter ? (
              <div className="mb-6 grid gap-4 rounded-xl border border-slate-200 bg-slate-50/80 p-4 sm:grid-cols-[auto_1fr_1fr_auto] sm:items-center">
                <span className="text-sm font-medium text-slate-700 sm:col-span-1">
                  C 타입 추가 금액 <span className="text-slate-500">(DB 저장)</span>
                </span>
                <div className="flex items-center gap-2">
                  <label className="w-10 text-sm text-slate-600">C-2</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatNumber(c2Addition)}
                    onChange={(e) => setC2Addition(parseFormatted(e.target.value))}
                    className="w-28 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 sm:w-32"
                  />
                  <span className="text-sm text-slate-500">엔</span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="w-10 text-sm text-slate-600">C-3</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatNumber(c3Addition)}
                    onChange={(e) => setC3Addition(parseFormatted(e.target.value))}
                    className="w-28 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 sm:w-32"
                  />
                  <span className="text-sm text-slate-500">엔</span>
                </div>
                <button
                  type="button"
                  onClick={handleSaveAdditions}
                  disabled={savingAdditions}
                  className="rounded-lg bg-slate-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-700 disabled:opacity-50"
                >
                  {savingAdditions ? "저장 중…" : "저장"}
                </button>
              </div>
            ) : (
              <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                <p className="mb-4 text-sm font-medium text-slate-700">
                  차고 패널 설정 <span className="text-slate-500">(DB 저장)</span>
                </p>
                {/* 1행: 우드 배율, 다크 추가, 프리미엄 추가, 저장 */}
                <div className="flex flex-wrap items-end gap-4 sm:gap-6">
                  <div className="flex items-center gap-2">
                    <label className="w-20 shrink-0 text-sm text-slate-600">우드 배율</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={woodMultiplierInput}
                      onChange={(e) => {
                        let v = e.target.value.replace(/[^\d.]/g, "");
                        const firstDot = v.indexOf(".");
                        if (firstDot >= 0) v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, "");
                        setWoodMultiplierInput(v);
                        const n = parseFloat(v);
                        setWoodMultiplier(Number.isFinite(n) && n > 0 ? n : 1.25);
                      }}
                      placeholder="1.25"
                      className="w-20 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="w-20 shrink-0 text-sm text-slate-600">다크 추가</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatNumber(darkAddition)}
                      onChange={(e) => setDarkAddition(parseFormatted(e.target.value))}
                      className="w-28 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base sm:w-32 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                    <span className="text-sm text-slate-500">엔</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="w-20 shrink-0 text-sm text-slate-600">프리미엄 추가</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatNumber(premiumAddition)}
                      onChange={(e) => setPremiumAddition(parseFormatted(e.target.value))}
                      className="w-28 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base sm:w-32 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                    <span className="text-sm text-slate-500">엔</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveGarageSettings}
                    disabled={savingGarageSettings}
                    className="rounded-lg bg-slate-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-700 disabled:opacity-50"
                  >
                    {savingGarageSettings ? "저장 중…" : "저장"}
                  </button>
                </div>
                {/* 2행: 전체 추가 금액 (우드판넬에 더해지는 금액, 적용 시 기본에는 ÷우드배율 반영) */}
                <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200/80 bg-amber-50/50 p-3 sm:gap-3">
                  <label className="shrink-0 text-sm font-medium text-slate-700">전체 추가 금액</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={globalAdditionInput}
                    onChange={(e) => {
                      let v = e.target.value.replace(/[^\d-]/g, "");
                      if (v.includes("-") && !v.startsWith("-")) v = v.replace(/-/g, "");
                      setGlobalAdditionInput(v);
                      setGlobalAddition(v === "" || v === "-" ? 0 : parseInt(v, 10));
                    }}
                    placeholder="0 또는 -50000"
                    className="w-28 max-w-full shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 sm:w-32"
                  />
                  <span className="shrink-0 text-sm text-slate-500">엔</span>
                  <button
                    type="button"
                    onClick={handleApplyGlobalAddition}
                    disabled={applyingGlobalAddition || globalAddition === 0}
                    className="shrink-0 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-amber-700 disabled:opacity-50"
                  >
                    {applyingGlobalAddition ? "적용 중…" : "전체 테이블에 적용"}
                  </button>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-slate-500">
                  전체 추가 금액은 <strong>우드판넬</strong>에 더해지는 금액입니다. 기본 단가는 (금액÷우드 배율)만큼 올라갑니다. 예: 125 입력 시 우드판넬 +125, 기본 +100(125÷1.25). 적용 후 0으로 초기화됩니다.
                </p>
              </div>
            )}
            <div className="mb-4 flex items-center gap-4">
              <h2 className={`text-lg font-semibold ${theme.sectionTitle}`}>
                단가 테이블 ({PRODUCT_TYPES[productType]})
              </h2>
              {saving && <span className="text-sm font-medium text-slate-600">저장 중…</span>}
              {isGarageShutter ? (
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(GARAGE_PANEL_TYPES) as GaragePanelType[]).map((pt) => (
                    <button
                      key={pt}
                      onClick={() => setTableGaragePanelType(pt)}
                      className={`rounded-lg px-4 py-2 text-sm font-bold transition-all duration-200 ${
                        pt === "base"
                          ? tableGaragePanelType === pt
                            ? "bg-slate-700 text-white ring-2 ring-slate-400 ring-offset-2"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-300"
                          : tableGaragePanelType === pt
                            ? "bg-amber-600 text-white ring-2 ring-amber-400 ring-offset-2"
                            : "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200"
                      }`}
                    >
                      {GARAGE_PANEL_TYPES[pt]}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex gap-2">
                  {(["C-1", "C-2", "C-3"] as CType[]).map((ct) => (
                    <button
                      key={ct}
                      onClick={() => setTableCType(ct)}
                      className={`rounded-lg px-4 py-2 text-sm font-bold transition-all duration-200 ${
                        ct === "C-1"
                          ? tableCType === ct
                            ? "bg-slate-700 text-white ring-2 ring-slate-400 ring-offset-2"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-300"
                          : ct === "C-2"
                            ? tableCType === ct
                              ? "bg-blue-600 text-white ring-2 ring-blue-400 ring-offset-2"
                              : "bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
                            : tableCType === ct
                              ? "bg-violet-600 text-white ring-2 ring-violet-400 ring-offset-2"
                              : "bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200"
                      }`}
                    >
                      {ct}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="mb-3 text-sm text-slate-600">
              {isGarageShutter
                ? "기본만 클릭하여 수정. 우드/다크/프리미엄은 자동 계산됩니다."
                : "가격을 클릭하면 변경 모달이 열립니다. C-1 기준 단가를 수정하면 C-2, C-3는 자동 계산됩니다."}
            </p>
            {loading ? (
              <p className="py-8 text-center text-slate-500">로딩 중…</p>
            ) : isGarageShutter ? (
              <div className="overflow-x-auto rounded-lg border border-slate-300 shadow-inner">
                <table className="min-w-full border-collapse text-base">
                  <thead>
                    <tr className="bg-slate-200/90">
                      <th className="sticky left-0 z-10 border-b border-r border-slate-300 bg-slate-200/95 px-3 py-2.5 text-left text-sm font-semibold text-slate-800">
                        높이 ∖ 폭
                      </th>
                      {GARAGE_WIDTH_RANGES.map((r) => (
                        <th
                          key={r.label}
                          className="border-b border-slate-300 px-3 py-2.5 text-center text-sm font-semibold text-slate-800"
                        >
                          {r.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {GARAGE_HEIGHT_RANGES.map((hr, hIdx) => (
                      <tr key={hr.label} className="hover:bg-slate-50/50">
                        <td className="sticky left-0 z-10 border-b border-r border-slate-300 bg-white px-3 py-2 font-medium text-slate-800">
                          {hr.label}
                        </td>
                        {GARAGE_WIDTH_RANGES.map((wr, wIdx) => (
                          <td key={wr.label} className="border-b border-slate-200 p-0">
                            {tableGaragePanelType === "base" ? (
                              <button
                                type="button"
                                onClick={() => openEditModal(wIdx, hIdx)}
                                className="min-w-[5.5rem] w-full cursor-pointer border-0 px-3 py-2 text-center text-base font-medium tabular-nums text-slate-900 transition hover:bg-blue-100/80 focus:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-inset"
                              >
                                ¥{formatPrice(getGarageDisplayPrice(table[wIdx]?.[hIdx] ?? 0, "base", garageSettings))}
                              </button>
                            ) : (
                              <span className="block min-w-[5.5rem] px-3 py-2 text-center text-base font-medium tabular-nums text-slate-700">
                                ¥{formatPrice(getGarageDisplayPrice(table[wIdx]?.[hIdx] ?? 0, tableGaragePanelType, garageSettings))}
                              </span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-300 shadow-inner">
                <table className="min-w-full border-collapse text-base">
                  <thead>
                    <tr className="bg-slate-200/90">
                      <th className="sticky left-0 z-10 border-b border-r border-slate-300 bg-slate-200/95 px-3 py-2.5 text-left text-sm font-semibold text-slate-800">
                        높이 ∖ 폭
                      </th>
                      {WIDTH_RANGES.map((r) => (
                        <th
                          key={r.label}
                          className="border-b border-slate-300 px-3 py-2.5 text-center text-sm font-semibold text-slate-800"
                        >
                          {r.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {HEIGHT_RANGES.map((hr, hIdx) => (
                      <tr key={hr.label} className="hover:bg-slate-50/50">
                        <td className="sticky left-0 z-10 border-b border-r border-slate-300 bg-white px-3 py-2 font-medium text-slate-800">
                          {hr.label}
                        </td>
                        {WIDTH_RANGES.map((wr, wIdx) => (
                          <td key={wr.label} className="border-b border-slate-200 p-0">
                            <button
                              type="button"
                              onClick={() => openEditModal(wIdx, hIdx)}
                              className="min-w-[5.5rem] w-full cursor-pointer border-0 px-3 py-2 text-center text-base font-medium tabular-nums text-slate-900 transition hover:bg-blue-100/80 focus:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-inset"
                            >
                              ¥{formatPrice(getDisplayPrice(wIdx, hIdx, tableCType))}
                            </button>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          )}
        </section>

        {/* 가격 변경 모달 */}
        {editModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
            onClick={closeEditModal}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="mb-1 text-lg font-semibold text-slate-800">가격 변경</h3>
              <p className="mb-4 text-sm text-slate-500">
                폭 {isGarageShutter ? GARAGE_WIDTH_RANGES[editModal.wIdx]?.label : WIDTH_RANGES[editModal.wIdx]?.label} × 높이 {isGarageShutter ? GARAGE_HEIGHT_RANGES[editModal.hIdx]?.label : HEIGHT_RANGES[editModal.hIdx]?.label}
              </p>
              <div className="mb-4">
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">기존 가격</label>
                <p className="rounded-lg bg-slate-100 px-3 py-2.5 text-base font-medium tabular-nums text-slate-700">
                  ¥{formatNumber(table[editModal.wIdx]?.[editModal.hIdx] ?? 0)} <span className="text-slate-500">엔</span>
                </p>
              </div>
              <div className="mb-6">
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">변경 가격</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={editModalValue ? formatNumber(parseFormatted(editModalValue)) : editModalValue}
                    onChange={(e) => setEditModalValue(e.target.value.replace(/\D/g, ""))}
                    placeholder="숫자만 입력"
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-base tabular-nums focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  <span className="text-sm text-slate-500">엔</span>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleModalSave}
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? "저장 중…" : "저장"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 비밀번호 모달 (히스토리 접근) */}
        {secretModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
            onClick={() => setSecretModalOpen(false)}
          >
            <div
              className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="mb-2 text-lg font-semibold text-slate-800">비밀번호</h3>
              <p className="mb-4 text-sm text-slate-500">히스토리 조회용 비밀번호를 입력하세요.</p>
              <input
                ref={passwordInputRef}
                type="password"
                inputMode="numeric"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && handleSecretSubmit()}
                placeholder="숫자 4자리"
                maxLength={4}
                className="mb-4 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base font-medium tabular-nums text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/20"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setSecretModalOpen(false); setPasswordInput(""); }}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleSecretSubmit}
                  className="rounded-lg bg-slate-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
