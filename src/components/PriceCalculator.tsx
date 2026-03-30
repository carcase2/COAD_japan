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
  GARAGE_PANEL_TYPES_SELECTABLE,
  type CType,
  type PriceTable,
  type ProductType,
  type GaragePanelType,
} from "@/lib/price";
import { recordUsage } from "@/lib/usageHistory";
import { useCalculatorLocale } from "@/components/CalculatorLocaleProvider";
import packageJson from "../../package.json";

export default function PriceCalculator() {
  const { m, locale, setLocale, formatNum, product, garage } = useCalculatorLocale();
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
  const [historyList, setHistoryList] = useState<Array<{ id: string; created_at: string; product_type: string; width_mm: number; height_mm: number; price_yen: number; type_info: string; referrer: string | null; ip_address: string | null; location: string | null; access_env: string | null }>>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const lastRecordedKeyRef = useRef<string>("");
  const historyPasswordRef = useRef<string>("");
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const widthInputRef = useRef<HTMLInputElement>(null);
  const heightInputRef = useRef<HTMLInputElement>(null);

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
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale === "ja" ? "ja" : "ko";
    }
  }, [locale]);

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
    const typeInfo = productType === "garage_shutter" ? garage(garagePanelType) : cType;
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
        pageUrl: typeof window !== "undefined" ? window.location.href : null,
      }).catch(() => {});
    }, 2000);
    return () => clearTimeout(t);
  }, [width, height, price, productType, cType, garagePanelType, garage, locale]);

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

  const formatPrice = formatNum;
  const formatNumber = formatNum;
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

  useEffect(() => {
    if (!showTable || editModal || secretModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowTable(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showTable, editModal, secretModalOpen]);

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

  /** 모바일 계산기만 한 화면(스크롤 없음); 히스토리 열림 시에는 스크롤 허용 */
  const mobileOneScreen = !historyUnlocked;

  const theme = {
    headerDesc: "text-slate-600",
    shell: "mx-auto w-full max-w-4xl border border-slate-300 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)]",
    section: "border-t border-slate-200 bg-white px-4 py-4 sm:px-6 sm:py-5",
    sectionMobileTight: "border-t border-slate-200 bg-white px-2 py-1.5 sm:px-6 sm:py-5",
    sectionTitle: "text-xs font-bold uppercase tracking-[0.14em] text-slate-500",
    sectionTitleDisplay: "text-base font-semibold tracking-tight text-slate-900 sm:text-lg",
    sectionRule: isGarageShutter ? "border-l-[3px] border-amber-500 pl-3" : "border-l-[3px] border-emerald-600 pl-3",
  };

  /** 선택한 타입(시트 C-1~3 · 차고 우드/다크/프리미엄)과 동일한 톤 */
  const priceAccent = isGarageShutter
    ? garagePanelType === "wood"
      ? {
          wrap: "border border-amber-200/90 bg-amber-50/60 border-l-[4px] border-l-amber-500",
          label: "text-amber-800",
          value: "text-amber-950",
          sub: "text-amber-800/90",
          actionBtn: "bg-amber-600 hover:bg-amber-700",
          tableTrigger: "border-2 border-dashed border-amber-300/75 bg-amber-50/50 hover:bg-amber-50/90",
          tableTriggerIcon: "bg-amber-100 text-amber-900",
          tableTriggerAction: "text-amber-800",
          modalBodyBg: "bg-amber-50/35",
          modalFrame: "border-slate-200 border-l-[4px] border-l-amber-500",
          modalHeadBar: "border-b-2 border-amber-200/90",
          modalClose: "border-amber-400 text-amber-900 hover:bg-amber-50",
        }
      : garagePanelType === "dark"
        ? {
            wrap: "border border-slate-300 bg-slate-100/80 border-l-[4px] border-l-slate-700",
            label: "text-slate-700",
            value: "text-slate-900",
            sub: "text-slate-600",
            actionBtn: "bg-slate-700 hover:bg-slate-800",
            tableTrigger: "border-2 border-dashed border-slate-400/75 bg-slate-100/55 hover:bg-slate-200/75",
            tableTriggerIcon: "bg-slate-600 text-white",
            tableTriggerAction: "text-slate-700",
            modalBodyBg: "bg-slate-100/45",
            modalFrame: "border-slate-200 border-l-[4px] border-l-slate-700",
            modalHeadBar: "border-b-2 border-slate-300",
            modalClose: "border-slate-500 text-slate-800 hover:bg-slate-100",
          }
        : {
            wrap: "border border-amber-300/90 bg-amber-100/50 border-l-[4px] border-l-amber-800",
            label: "text-amber-900",
            value: "text-amber-950",
            sub: "text-amber-800",
            actionBtn: "bg-amber-800 hover:bg-amber-900",
            tableTrigger: "border-2 border-dashed border-amber-500/70 bg-amber-100/45 hover:bg-amber-100/80",
            tableTriggerIcon: "bg-amber-800 text-amber-50",
            tableTriggerAction: "text-amber-950",
            modalBodyBg: "bg-amber-100/30",
            modalFrame: "border-slate-200 border-l-[4px] border-l-amber-800",
            modalHeadBar: "border-b-2 border-amber-300/90",
            modalClose: "border-amber-700 text-amber-950 hover:bg-amber-50",
          }
    : cType === "C-1"
      ? {
          wrap: "border border-slate-300 bg-slate-50/90 border-l-[4px] border-l-slate-800",
          label: "text-slate-700",
          value: "text-slate-900",
          sub: "text-slate-600",
          actionBtn: "bg-slate-800 hover:bg-slate-900",
          tableTrigger: "border-2 border-dashed border-slate-400/75 bg-slate-50/80 hover:bg-slate-100/90",
          tableTriggerIcon: "bg-slate-200 text-slate-800",
          tableTriggerAction: "text-slate-700",
          modalBodyBg: "bg-slate-50/45",
          modalFrame: "border-slate-200 border-l-[4px] border-l-slate-800",
          modalHeadBar: "border-b-2 border-slate-200",
          modalClose: "border-slate-400 text-slate-800 hover:bg-slate-50",
        }
      : cType === "C-2"
        ? {
            wrap: "border border-blue-200/90 bg-blue-50/70 border-l-[4px] border-l-blue-600",
            label: "text-blue-800",
            value: "text-blue-950",
            sub: "text-blue-800/90",
            actionBtn: "bg-blue-600 hover:bg-blue-700",
            tableTrigger: "border-2 border-dashed border-blue-300/80 bg-blue-50/50 hover:bg-blue-50/90",
            tableTriggerIcon: "bg-blue-100 text-blue-900",
            tableTriggerAction: "text-blue-700",
            modalBodyBg: "bg-blue-50/35",
            modalFrame: "border-slate-200 border-l-[4px] border-l-blue-600",
            modalHeadBar: "border-b-2 border-blue-200/90",
            modalClose: "border-blue-400 text-blue-900 hover:bg-blue-50",
          }
        : {
            wrap: "border border-violet-200/90 bg-violet-50/70 border-l-[4px] border-l-violet-600",
            label: "text-violet-800",
            value: "text-violet-950",
            sub: "text-violet-800/90",
            actionBtn: "bg-violet-600 hover:bg-violet-700",
            tableTrigger: "border-2 border-dashed border-violet-300/80 bg-violet-50/50 hover:bg-violet-50/90",
            tableTriggerIcon: "bg-violet-100 text-violet-900",
            tableTriggerAction: "text-violet-800",
            modalBodyBg: "bg-violet-50/35",
            modalFrame: "border-slate-200 border-l-[4px] border-l-violet-600",
            modalHeadBar: "border-b-2 border-violet-200/90",
            modalClose: "border-violet-400 text-violet-900 hover:bg-violet-50",
          };

  /** 단가 모달 표 헤더 — 표에서 선택한 탭(C / 패널) 색 */
  const tableHeadStyle = isGarageShutter
    ? tableGaragePanelType === "base"
      ? { row: "bg-slate-800 text-white", b: "border-slate-700", sticky: "bg-slate-800" }
      : tableGaragePanelType === "wood"
        ? { row: "bg-amber-700 text-white", b: "border-amber-800", sticky: "bg-amber-700" }
        : tableGaragePanelType === "dark"
          ? { row: "bg-slate-700 text-white", b: "border-slate-800", sticky: "bg-slate-700" }
          : { row: "bg-amber-900 text-amber-50", b: "border-amber-950", sticky: "bg-amber-900" }
    : tableCType === "C-1"
      ? { row: "bg-slate-800 text-white", b: "border-slate-700", sticky: "bg-slate-800" }
      : tableCType === "C-2"
        ? { row: "bg-blue-700 text-white", b: "border-blue-800", sticky: "bg-blue-700" }
        : { row: "bg-violet-700 text-white", b: "border-violet-800", sticky: "bg-violet-700" };

  const specTypeLabel = isGarageShutter ? garage(garagePanelType) : cType;
  const specWidthMm = parseFormatted(width);
  const specHeightMm = parseFormatted(height);
  const specSummaryLine = `${specTypeLabel} · ${specWidthMm > 0 ? `${m.widthAbbr} ${formatNumber(specWidthMm)}mm` : `${m.widthAbbr} ${m.dash}`} · ${specHeightMm > 0 ? `${m.heightAbbr} ${formatNumber(specHeightMm)}mm` : `${m.heightAbbr} ${m.dash}`}`;

  const pageRootClass = mobileOneScreen
    ? "flex h-dvh max-h-dvh w-full flex-col overflow-hidden bg-[#eceef2] px-1.5 pt-[env(safe-area-inset-top,0px)] pb-0 sm:block sm:h-auto sm:max-h-none sm:min-h-dvh sm:overflow-visible sm:bg-transparent sm:px-4 sm:py-2 sm:pb-4"
    : "min-h-dvh w-full overflow-x-hidden overflow-y-auto bg-[#eceef2] px-3 py-2 pb-[calc(6.25rem+env(safe-area-inset-bottom,0px))] sm:px-4 sm:pb-4";

  const shellClass = `${theme.shell} space-y-0 ${
    mobileOneScreen
      ? "flex min-h-0 flex-1 flex-col overflow-hidden sm:block sm:min-h-0 sm:flex-none sm:overflow-visible"
      : ""
  }`;

  return (
    <div className={pageRootClass}>
      <div className={shellClass}>
        <div className="shrink-0 border-b border-slate-200 bg-white shadow-[0_1px_0_rgba(15,23,42,0.06)]">
        <header className="relative border-b border-slate-200 bg-slate-50/50 px-3 py-2 sm:px-5 sm:py-3.5">
          <button
            type="button"
            onClick={() => setSecretModalOpen(true)}
            className="absolute right-2 top-2 h-6 w-6 rounded border-0 bg-transparent opacity-[0.08] hover:opacity-20 focus:opacity-20 focus:outline-none sm:right-4 sm:top-3"
            style={{ background: "currentColor" }}
            title=""
            aria-label={m.ariaSecret}
          />
          <div className="flex w-full flex-col gap-2 lg:flex-row lg:items-start lg:gap-3">
            <div className="flex min-w-0 w-full flex-1 items-start gap-2 sm:gap-3">
            <Link
              href="/"
              onClick={(e) => { if (pathname === "/") { e.preventDefault(); goHome(); } }}
              className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center border border-slate-300 bg-white text-slate-600 transition hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900 sm:h-8 sm:w-8"
              title={m.ariaHome}
              aria-label={m.ariaHome}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </Link>
            <div className={`min-w-0 flex-1 border-l-2 pl-2 sm:pl-3 ${isGarageShutter ? "border-amber-500" : "border-emerald-600"}`}>
              <p className="hidden text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500 sm:block">{m.internalTagline}</p>
              <h1 className="leading-tight sm:mt-0.5">
                <Link
                  href="/"
                  onClick={(e) => { if (pathname === "/") { e.preventDefault(); goHome(); } }}
                  className="block text-sm font-semibold tracking-tight text-slate-900 sm:text-lg"
                >
                  {m.pageTitle}
                </Link>
              </h1>
              <p
                className={`mt-1 hidden min-w-0 text-[11px] leading-snug break-words text-pretty sm:block sm:text-xs ${theme.headerDesc}`}
              >
                {m.pageDescription}
              </p>
            </div>
          </div>
            <div
              className="flex shrink-0 justify-end pt-0.5 lg:mt-0.5 lg:self-start lg:pr-10"
              role="group"
              aria-label={m.ariaLangGroup}
            >
              <div className="inline-flex items-center gap-0.5 rounded-xl border border-slate-200/90 bg-gradient-to-b from-slate-50 to-slate-100 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_1px_2px_rgba(15,23,42,0.06)]">
                <button
                  type="button"
                  onClick={() => setLocale("ko")}
                  aria-pressed={locale === "ko"}
                  className={`relative min-h-10 min-w-[3.5rem] rounded-lg px-3 text-xs font-semibold tracking-tight transition-all duration-200 sm:min-h-9 sm:min-w-[3.75rem] sm:px-3.5 sm:text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/35 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100 active:scale-[0.98] ${
                    locale === "ko"
                      ? "bg-white text-slate-900 shadow-[0_1px_3px_rgba(15,23,42,0.12),0_0_0_1px_rgba(15,23,42,0.06)]"
                      : "text-slate-500 hover:bg-white/70 hover:text-slate-800"
                  }`}
                >
                  {m.langKo}
                </button>
                <button
                  type="button"
                  onClick={() => setLocale("ja")}
                  aria-pressed={locale === "ja"}
                  className={`relative min-h-10 min-w-[3.5rem] rounded-lg px-3 text-xs font-semibold tracking-tight transition-all duration-200 sm:min-h-9 sm:min-w-[3.75rem] sm:px-3.5 sm:text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/35 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100 active:scale-[0.98] ${
                    locale === "ja"
                      ? "bg-white text-slate-900 shadow-[0_1px_3px_rgba(15,23,42,0.12),0_0_0_1px_rgba(15,23,42,0.06)]"
                      : "text-slate-500 hover:bg-white/70 hover:text-slate-800"
                  }`}
                >
                  {m.langJa}
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* 모델 선택 */}
        <section className="border-t border-slate-200 bg-white px-3 py-1 sm:px-5 sm:py-2">
          <div className={`mb-1 hidden min-w-0 flex-nowrap items-center gap-x-1 overflow-hidden sm:flex sm:gap-x-1.5 ${theme.sectionRule}`}>
            <span className={`shrink-0 text-[10px] sm:text-[11px] ${theme.sectionTitle}`}>{m.sectionProduct}</span>
            <span className="shrink-0 text-slate-300 select-none" aria-hidden>
              ·
            </span>
            <h2 className="shrink-0 text-xs font-semibold tracking-tight text-slate-800 sm:text-sm">{m.sectionModel}</h2>
          </div>
          <div
            className="flex w-full gap-0.5 rounded-xl border border-slate-200/90 bg-gradient-to-b from-slate-50 to-slate-100 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_1px_2px_rgba(15,23,42,0.05)]"
            role="group"
            aria-label={m.sectionModel}
          >
            {(["sheet_shutter", "garage_shutter"] as ProductType[]).map((pt) => {
              const selected = productType === pt;
              const isSheet = pt === "sheet_shutter";
              return (
                <button
                  key={pt}
                  onClick={() => setProductType(pt)}
                  type="button"
                  aria-pressed={selected}
                  className={`min-h-9 flex-1 rounded-lg px-2 py-1.5 text-center text-[11px] font-semibold leading-tight tracking-tight transition-all duration-200 sm:min-h-9 sm:px-3 sm:py-2 sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-100 active:scale-[0.99] ${
                    isSheet
                      ? selected
                        ? "bg-emerald-600 text-white shadow-[0_1px_2px_rgba(5,150,105,0.35)] focus-visible:ring-emerald-500/40"
                        : "text-slate-600 hover:bg-white/75 hover:text-slate-900 focus-visible:ring-emerald-500/30"
                      : selected
                        ? "bg-amber-500 text-white shadow-[0_1px_2px_rgba(217,119,6,0.35)] focus-visible:ring-amber-500/40"
                        : "text-slate-600 hover:bg-white/75 hover:text-slate-900 focus-visible:ring-amber-500/30"
                  }`}
                >
                  {product(pt)}
                </button>
              );
            })}
          </div>
          {isGarageShutter ? (
            <p className="mt-1 hidden rounded-md bg-amber-50/90 px-2 py-1 text-[10px] leading-snug text-amber-900/95 ring-1 ring-amber-200/50 sm:block sm:text-[11px]">
              {m.hintGarage}
            </p>
          ) : (
            <p className="mt-1 hidden rounded-md bg-emerald-50/90 px-2 py-1 text-[10px] leading-snug text-emerald-900/95 ring-1 ring-emerald-200/50 sm:block sm:text-[11px]">
              {m.hintSheet}
            </p>
          )}
        </section>
        </div>

        {/* 사용 히스토리 (비밀번호 인증 후) */}
        {historyUnlocked && (
          <section className={theme.section}>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <h2 className={theme.sectionTitle}>{m.historyTitle}</h2>
                <p className="mt-1 text-sm font-semibold text-slate-900">{m.historySubtitle}</p>
                <p className="mt-0.5 text-xs text-slate-500">{m.historyLimitNote}</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={fetchHistory}
                  disabled={historyLoading}
                  className="rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {historyLoading ? m.loadingShort : m.refresh}
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryUnlocked(false)}
                  className="border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  {m.close}
                </button>
              </div>
            </div>
            {historyLoading && historyList.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 border border-slate-200 bg-slate-50 py-14">
                <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-600" aria-hidden />
                <p className="text-sm font-medium text-slate-600">{m.historyLoading}</p>
              </div>
            ) : historyList.length === 0 ? (
              <p className="border border-slate-200 bg-slate-50 py-10 text-center text-sm text-slate-500">{m.historyEmpty}</p>
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
                    <div className="mb-6 space-y-6">
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="border border-slate-200 bg-white p-4">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{m.statTotalUses}</p>
                          <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-slate-900">{formatPrice(total)}<span className="ml-1 text-sm font-medium text-slate-400">{m.timesUnit}</span></p>
                        </div>
                        <div className="border border-slate-200 bg-white p-4">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{m.statTotalYen}</p>
                          <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-slate-900">¥{formatPrice(sumYen)}</p>
                        </div>
                        <div className="border border-slate-200 bg-white p-4">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{m.statUniqueIps}</p>
                          <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-slate-900">{uniqueIps}<span className="ml-1 text-sm font-medium text-slate-400">{m.placesUnit}</span></p>
                        </div>
                        <div className="border border-slate-200 bg-white p-4">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{m.statTodayWeek}</p>
                          <p className="mt-2 text-base font-bold tabular-nums leading-snug text-slate-900">{m.statToday} {todayCount}{m.timesUnit}<br /><span className="text-sm font-semibold text-slate-500">{m.statThisWeek} {weekCount}{m.timesUnit}</span></p>
                        </div>
                      </div>
                      <div className="grid gap-5 lg:grid-cols-2">
                        <div className="border border-slate-200 bg-slate-50/50 p-5">
                          <p className="mb-4 text-xs font-bold uppercase tracking-wide text-slate-600">{m.chartByProduct}</p>
                          <div className="space-y-2">
                            <div className="flex items-center gap-3">
                              <span className="w-[4.5rem] shrink-0 text-xs font-medium text-slate-600">{m.labelSheetProduct}</span>
                              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                                <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${sheetPct}%` }} />
                              </div>
                              <span className="w-11 shrink-0 text-right text-xs font-semibold tabular-nums text-slate-700">{sheet}{m.timesUnit}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="w-[4.5rem] shrink-0 text-xs font-medium text-slate-600">{m.labelGarageProduct}</span>
                              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                                <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${garagePct}%` }} />
                              </div>
                              <span className="w-11 shrink-0 text-right text-xs font-semibold tabular-nums text-slate-700">{garage}{m.timesUnit}</span>
                            </div>
                          </div>
                        </div>
                        <div className="border border-slate-200 bg-slate-50/50 p-5">
                          <p className="mb-4 text-xs font-bold uppercase tracking-wide text-slate-600">{m.chartByPeriod}</p>
                          <div className="space-y-2">
                            <div className="flex items-center gap-3">
                              <span className="w-16 shrink-0 text-xs font-medium text-slate-600">{m.statToday}</span>
                              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                                <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${todayPct}%` }} />
                              </div>
                              <span className="w-11 shrink-0 text-right text-xs font-semibold tabular-nums text-slate-700">{todayCount}{m.timesUnit}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="w-16 shrink-0 text-xs font-medium text-slate-600">{m.statThisWeek}</span>
                              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                                <div className="h-full rounded-full bg-indigo-400 transition-all" style={{ width: `${weekOnlyPct}%` }} />
                              </div>
                              <span className="w-11 shrink-0 text-right text-xs font-semibold tabular-nums text-slate-700">{weekCount - todayCount}{m.timesUnit}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="w-16 shrink-0 text-xs font-medium text-slate-600">{m.statOlder}</span>
                              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                                <div className="h-full rounded-full bg-slate-400 transition-all" style={{ width: `${olderPct}%` }} />
                              </div>
                              <span className="w-11 shrink-0 text-right text-xs font-semibold tabular-nums text-slate-700">{olderCount}{m.timesUnit}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
                <div className="overflow-hidden border border-slate-300">
                <div className="max-h-[min(70vh,520px)] overflow-auto">
                <table className="min-w-[920px] w-full border-collapse text-left text-sm">
                  <thead className="sticky top-0 z-10 border-b border-slate-300 bg-slate-100 text-slate-800">
                    <tr>
                      <th className="whitespace-nowrap border-r border-slate-200 px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider">{m.thDateTime}</th>
                      <th className="whitespace-nowrap border-r border-slate-200 px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider">{m.thProduct}</th>
                      <th className="whitespace-nowrap border-r border-slate-200 px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider">{m.thWxH}</th>
                      <th className="whitespace-nowrap border-r border-slate-200 px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider">{m.thType}</th>
                      <th className="whitespace-nowrap border-r border-slate-200 px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider">{m.thPrice}</th>
                      <th className="whitespace-nowrap border-r border-slate-200 px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider">{m.thIp}</th>
                      <th className="whitespace-nowrap border-r border-slate-200 px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider">{m.thLocation}</th>
                      <th className="whitespace-nowrap border-r border-slate-200 px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider">{m.thAccess}</th>
                      <th className="whitespace-nowrap px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider">{m.thReferrer}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {historyList.map((row, idx) => (
                      <tr key={row.id} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/70"}>
                        <td className="whitespace-nowrap px-3 py-2.5 text-xs tabular-nums text-slate-600">
                          {new Date(row.created_at).toLocaleString(locale === "ja" ? "ja-JP" : "ko-KR")}
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${
                              row.product_type === "sheet_shutter"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-amber-100 text-amber-900"
                            }`}
                          >
                            {row.product_type === "sheet_shutter" ? m.badgeSheet : m.badgeGarage}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-center text-xs font-semibold tabular-nums text-slate-800">
                          {row.width_mm}×{row.height_mm}
                        </td>
                        <td className="max-w-[7rem] truncate px-3 py-2.5 text-xs text-slate-700" title={row.type_info}>
                          {row.type_info}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right text-xs font-bold tabular-nums text-slate-900">
                          ¥{formatPrice(row.price_yen)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-slate-600">
                          {row.ip_address || "—"}
                        </td>
                        <td className="max-w-[8rem] truncate px-3 py-2.5 text-xs text-slate-600" title={row.location ?? ""}>
                          {row.location || "—"}
                        </td>
                        <td className="max-w-[11rem] truncate px-3 py-2.5 text-xs text-slate-600" title={row.access_env ?? ""}>
                          {row.access_env || "—"}
                        </td>
                        <td className="max-w-[10rem] truncate px-3 py-2.5 text-xs text-slate-500" title={row.referrer ?? ""}>
                          {row.referrer || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
              </>
            )}
          </section>
        )}

        <div
          className={
            mobileOneScreen
              ? "flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden sm:contents sm:overflow-visible"
              : "contents"
          }
        >
        {/* 계산기 폼 */}
        <section className={mobileOneScreen ? `${theme.sectionMobileTight} min-h-0 sm:min-h-0` : theme.section}>
          <div className={`mb-2 hidden min-w-0 flex-nowrap items-center gap-x-1.5 overflow-hidden sm:mb-3 sm:flex sm:gap-x-2 ${theme.sectionRule}`}>
            <span className={`shrink-0 ${theme.sectionTitle}`}>{m.sectionInput}</span>
            <span className="shrink-0 text-slate-300 select-none" aria-hidden>
              ·
            </span>
            <h2 className="shrink-0 text-sm font-semibold tracking-tight text-slate-900 sm:text-base">{m.sectionSpec}</h2>
            <span className="shrink-0 text-slate-300 select-none" aria-hidden>
              ·
            </span>
            <p className="min-w-0 truncate text-[11px] leading-tight text-slate-500 sm:text-xs" title={m.flowHint}>
              {m.flowHint}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_minmax(0,1fr)] sm:items-end sm:gap-6">
            <div className="flex min-w-0 flex-col gap-0.5 sm:gap-1.5">
              <label htmlFor="calc-width" className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs">
                {m.labelWidth} <span className="font-normal normal-case text-slate-400">(mm)</span>
              </label>
              <input
                id="calc-width"
                ref={widthInputRef}
                type="text"
                name="width_mm"
                autoComplete="off"
                inputMode="numeric"
                value={width ? formatNumber(parseFormatted(width)) : width}
                onChange={(e) => setWidth(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") heightInputRef.current?.focus();
                }}
                placeholder={isGarageShutter ? "예: 3600" : "예: 3000"}
                aria-describedby="calc-hint"
                className={`min-h-10 w-full rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-2 text-base font-medium tabular-nums text-slate-900 shadow-inner transition placeholder:text-slate-400 focus:border-transparent focus:bg-white focus:outline-none focus:ring-2 sm:min-h-12 sm:rounded-xl sm:px-3.5 sm:py-3 sm:max-w-[11rem] ${
                  isSheetShutter ? "focus:ring-emerald-500/35" : "focus:ring-amber-500/35"
                }`}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-0.5 sm:gap-1.5">
              <label htmlFor="calc-height" className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs">
                {m.labelHeight} <span className="font-normal normal-case text-slate-400">(mm)</span>
              </label>
              <input
                id="calc-height"
                ref={heightInputRef}
                type="text"
                name="height_mm"
                autoComplete="off"
                inputMode="numeric"
                value={height ? formatNumber(parseFormatted(height)) : height}
                onChange={(e) => setHeight(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
                placeholder={isGarageShutter ? "예: 2400" : "예: 2500"}
                aria-describedby="calc-hint"
                className={`min-h-10 w-full rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-2 text-base font-medium tabular-nums text-slate-900 shadow-inner transition placeholder:text-slate-400 focus:border-transparent focus:bg-white focus:outline-none focus:ring-2 sm:min-h-12 sm:rounded-xl sm:px-3.5 sm:py-3 sm:max-w-[11rem] ${
                  isSheetShutter ? "focus:ring-emerald-500/35" : "focus:ring-amber-500/35"
                }`}
              />
            </div>
            <div className="col-span-2 min-w-0 sm:col-span-1 sm:pt-0">
              <fieldset className="min-w-0 border-0 p-0">
                <legend className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:mb-2 sm:text-xs">{m.labelType}</legend>
              {isGarageShutter ? (
                <div className="grid grid-cols-3 gap-1 sm:flex sm:flex-wrap sm:gap-2">
                  {GARAGE_PANEL_TYPES_SELECTABLE.map((pt) => (
                    <button
                      key={pt}
                      onClick={() => setGaragePanelType(pt)}
                      type="button"
                      className={`min-h-9 rounded-lg px-1.5 py-1.5 text-[11px] font-bold leading-tight transition-all duration-200 sm:min-h-11 sm:rounded-xl sm:px-4 sm:py-2.5 sm:text-sm ${
                        pt === "wood"
                          ? garagePanelType === pt
                            ? "bg-amber-600 text-white shadow-md shadow-amber-600/20 ring-2 ring-amber-400/50"
                            : "border border-amber-200 bg-amber-50/80 text-amber-800 hover:bg-amber-50"
                          : pt === "dark"
                            ? garagePanelType === pt
                              ? "bg-slate-700 text-white shadow-md shadow-slate-600/25 ring-2 ring-slate-500/40"
                              : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                            : garagePanelType === pt
                              ? "bg-amber-800 text-white shadow-md shadow-amber-900/20 ring-2 ring-amber-500/40"
                              : "border border-amber-200 bg-amber-50/80 text-amber-900 hover:bg-amber-50"
                      }`}
                    >
                      {garage(pt)}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="grid w-full grid-cols-3 gap-1 sm:flex sm:w-auto sm:gap-2">
                  {(["C-1", "C-2", "C-3"] as CType[]).map((ct) => (
                    <button
                      key={ct}
                      onClick={() => setCType(ct)}
                      type="button"
                      className={`min-h-9 w-full rounded-lg px-1 py-2 text-xs font-bold transition-all duration-200 sm:min-h-11 sm:rounded-xl sm:px-4 sm:py-2.5 sm:text-sm sm:w-auto ${
                        ct === "C-1"
                          ? cType === ct
                            ? "bg-slate-800 text-white shadow-md ring-2 ring-slate-600/50"
                            : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                          : ct === "C-2"
                            ? cType === ct
                              ? "bg-blue-600 text-white shadow-md shadow-blue-600/25 ring-2 ring-blue-400/50"
                              : "border border-blue-200 bg-blue-50/80 text-blue-800 hover:bg-blue-50"
                            : cType === ct
                              ? "bg-violet-600 text-white shadow-md shadow-violet-600/25 ring-2 ring-violet-400/50"
                              : "border border-violet-200 bg-violet-50/80 text-violet-800 hover:bg-violet-50"
                      }`}
                    >
                      {ct}
                    </button>
                  ))}
                </div>
              )}
              </fieldset>
            </div>
          </div>
          <p id="calc-hint" className="mt-2 hidden text-xs leading-relaxed text-slate-500 sm:mt-3 sm:block">
            {isGarageShutter ? m.hintGarageInput : m.hintSheetInput}
          </p>
          <div
            className={`mt-4 hidden rounded-2xl border-2 px-6 py-5 sm:mt-6 sm:block sm:px-8 sm:py-6 ${priceAccent.wrap}`}
            role="region"
            aria-live="polite"
            aria-labelledby="calc-price-heading"
          >
            <p id="calc-price-heading" className={`text-xs font-semibold uppercase tracking-wider ${priceAccent.label}`}>
              {m.expectedPrice}
            </p>
            <p id="calc-price-spec" className={`mt-1.5 text-sm font-medium tabular-nums sm:text-base ${priceAccent.sub}`}>
              {specSummaryLine}
            </p>
            <p className={`mt-2 text-3xl font-bold tracking-tight tabular-nums sm:text-4xl ${priceAccent.value}`}>
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent opacity-40" aria-hidden />
                  {m.loading}
                </span>
              ) : price !== null ? (
                `¥${formatPrice(price)}`
              ) : (
                <span className={`text-2xl font-semibold opacity-75 ${priceAccent.value}`}>{m.enterWxH}</span>
              )}
            </p>
            <p className={`mt-1 text-sm font-medium ${priceAccent.sub}`}>{m.currencyNote}</p>
          </div>
          {mobileOneScreen && (
            <div
              className={`mt-3 rounded-2xl border-2 px-4 py-3.5 sm:hidden ${priceAccent.wrap}`}
              role="region"
              aria-live="polite"
              aria-labelledby="calc-price-heading-mobile"
            >
              <div className="flex items-stretch gap-3">
                <div className="min-w-0 flex-1">
                  <p id="calc-price-heading-mobile" className={`text-[10px] font-semibold uppercase tracking-wider ${priceAccent.label}`}>
                    {m.expectedPrice}
                  </p>
                  <p className={`mt-1 text-[11px] font-medium tabular-nums leading-snug ${priceAccent.sub}`}>{specSummaryLine}</p>
                  <p className={`mt-1.5 text-2xl font-bold leading-tight tabular-nums tracking-tight ${priceAccent.value}`}>
                    {loading ? (
                      <span className="inline-flex items-center gap-1.5 text-lg">
                        <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent opacity-40" aria-hidden />
                        {m.loading}
                      </span>
                    ) : price !== null ? (
                      `¥${formatPrice(price)}`
                    ) : (
                      <span className={`text-lg font-semibold opacity-80 ${priceAccent.value}`}>{m.enterWxH}</span>
                    )}
                  </p>
                  <p className={`mt-0.5 text-[10px] font-medium ${priceAccent.sub}`}>{m.currencyNote}</p>
                </div>
                <button
                  type="button"
                  onClick={() => widthInputRef.current?.focus()}
                  className={`flex h-11 shrink-0 self-center items-center justify-center rounded-xl px-3.5 text-xs font-bold text-white shadow-sm active:scale-[0.98] ${priceAccent.actionBtn}`}
                >
                  {m.bottomInput}
                </button>
              </div>
            </div>
          )}
        </section>

        {/* 단가 테이블 (모달로 열기) */}
        <section className={mobileOneScreen ? `${theme.sectionMobileTight} shrink-0` : theme.section}>
          <button
            type="button"
            onClick={() => setShowTable(true)}
            className={`flex min-h-10 w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left transition-all duration-200 sm:min-h-0 sm:gap-3 sm:rounded-2xl sm:px-6 sm:py-5 ${priceAccent.tableTrigger}`}
          >
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sm font-bold sm:h-9 sm:w-9 sm:rounded-lg ${priceAccent.tableTriggerIcon}`}
              aria-hidden
            >
              +
            </span>
            <span className="min-w-0 flex-1 text-left">
              <span className={`hidden text-xs font-bold uppercase tracking-[0.12em] sm:block ${priceAccent.label}`}>{m.manage}</span>
              <span className={`mt-0.5 block text-sm font-semibold sm:text-base ${theme.sectionTitleDisplay} ${priceAccent.value}`}>
                {m.openPriceTable}
              </span>
              <span className={`mt-0.5 hidden text-xs sm:block ${priceAccent.sub}`}>{m.priceTableHint}</span>
            </span>
            <span className={`hidden shrink-0 text-xs font-semibold sm:inline ${priceAccent.tableTriggerAction}`}>{m.open}</span>
          </button>
        </section>
        </div>

        {showTable && (
          <div
            className="fixed inset-0 z-[45] flex items-end justify-center bg-black/45 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0.75rem))] backdrop-blur-sm sm:items-center sm:p-4 sm:pb-4"
            onClick={() => setShowTable(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="price-table-modal-title"
          >
            <div
              className={`flex max-h-[min(92dvh,calc(100dvh-env(safe-area-inset-bottom)-1.5rem))] w-full max-w-6xl flex-col overflow-hidden rounded-t-2xl border bg-white shadow-2xl sm:max-h-[92dvh] sm:rounded-2xl ${priceAccent.modalFrame}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={`flex shrink-0 flex-wrap items-center justify-between gap-3 bg-white px-4 py-3 sm:px-5 ${priceAccent.modalHeadBar}`}>
                <div className="min-w-0">
                  <p className={`text-[10px] font-bold uppercase tracking-wider ${priceAccent.label}`}>{m.manage}</p>
                  <h2 id="price-table-modal-title" className={`truncate text-base font-semibold sm:text-lg ${priceAccent.value}`}>
                    {m.priceTableTitle} · {product(productType)}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTable(false)}
                  className={`shrink-0 rounded-lg border bg-white px-4 py-2 text-sm font-medium ${priceAccent.modalClose}`}
                >
                  {m.modalClose}
                </button>
              </div>
              <div
                className={`min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-4 pb-[max(1rem,calc(0.75rem+env(safe-area-inset-bottom,0px)))] sm:overscroll-contain sm:p-5 sm:pb-5 ${priceAccent.modalBodyBg}`}
              >
            {!isGarageShutter ? (
              <div className="mb-6 grid gap-4 rounded-xl border border-slate-200 bg-slate-50/80 p-4 sm:grid-cols-[auto_1fr_1fr_auto] sm:items-center">
                <span className="text-sm font-medium text-slate-700 sm:col-span-1">
                  {m.cTypeAdditions} <span className="text-slate-500">{m.dbSave}</span>
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
                  <span className="text-sm text-slate-500">{m.yen}</span>
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
                  <span className="text-sm text-slate-500">{m.yen}</span>
                </div>
                <button
                  type="button"
                  onClick={handleSaveAdditions}
                  disabled={savingAdditions}
                  className="rounded-lg bg-slate-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-700 disabled:opacity-50"
                >
                  {savingAdditions ? m.saving : m.save}
                </button>
              </div>
            ) : (
              <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                <p className="mb-4 text-sm font-medium text-slate-700">
                  {m.garagePanelSettings} <span className="text-slate-500">{m.dbSave}</span>
                </p>
                <div className="flex flex-wrap items-end gap-4 sm:gap-6">
                  <div className="flex items-center gap-2">
                    <label className="w-20 shrink-0 text-sm text-slate-600">{m.woodMultiplier}</label>
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
                    <label className="w-20 shrink-0 text-sm text-slate-600">{m.darkAddition}</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatNumber(darkAddition)}
                      onChange={(e) => setDarkAddition(parseFormatted(e.target.value))}
                      className="w-28 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base sm:w-32 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                    <span className="text-sm text-slate-500">{m.yen}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="w-20 shrink-0 text-sm text-slate-600">{m.premiumAddition}</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatNumber(premiumAddition)}
                      onChange={(e) => setPremiumAddition(parseFormatted(e.target.value))}
                      className="w-28 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base sm:w-32 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                    <span className="text-sm text-slate-500">{m.yen}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveGarageSettings}
                    disabled={savingGarageSettings}
                    className="rounded-lg bg-slate-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-700 disabled:opacity-50"
                  >
                    {savingGarageSettings ? m.saving : m.save}
                  </button>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200/80 bg-amber-50/50 p-3 sm:gap-3">
                  <label className="shrink-0 text-sm font-medium text-slate-700">{m.globalAdditionLabel}</label>
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
                    placeholder={m.globalAdditionPlaceholder}
                    className="w-28 max-w-full shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 sm:w-32"
                  />
                  <span className="shrink-0 text-sm text-slate-500">{m.yen}</span>
                  <button
                    type="button"
                    onClick={handleApplyGlobalAddition}
                    disabled={applyingGlobalAddition || globalAddition === 0}
                    className="shrink-0 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-amber-700 disabled:opacity-50"
                  >
                    {applyingGlobalAddition ? m.applying : m.applyAllTable}
                  </button>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-slate-500">{m.globalAdditionHelp}</p>
              </div>
            )}
            <div className="mb-4 flex flex-wrap items-center gap-3 border-b border-slate-200 pb-4">
              {saving && <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">{m.saving}</span>}
              {isGarageShutter ? (
                <div className="flex flex-wrap gap-2">
                  {(["base", "wood", "dark", "premium"] as GaragePanelType[]).map((pt) => (
                    <button
                      key={pt}
                      onClick={() => setTableGaragePanelType(pt)}
                      type="button"
                      className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-all duration-200 sm:text-sm ${
                        pt === "base"
                          ? tableGaragePanelType === pt
                            ? "bg-slate-800 text-white shadow-sm ring-2 ring-slate-600/40"
                            : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                          : tableGaragePanelType === pt
                            ? "bg-amber-600 text-white shadow-sm ring-2 ring-amber-400/50"
                            : "border border-amber-200 bg-amber-50/80 text-amber-900 hover:bg-amber-50"
                      }`}
                    >
                      {garage(pt)}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(["C-1", "C-2", "C-3"] as CType[]).map((ct) => (
                    <button
                      key={ct}
                      onClick={() => setTableCType(ct)}
                      type="button"
                      className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-all duration-200 sm:text-sm ${
                        ct === "C-1"
                          ? tableCType === ct
                            ? "bg-slate-800 text-white shadow-sm ring-2 ring-slate-600/40"
                            : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                          : ct === "C-2"
                            ? tableCType === ct
                              ? "bg-blue-600 text-white shadow-sm ring-2 ring-blue-400/50"
                              : "border border-blue-200 bg-blue-50/80 text-blue-800 hover:bg-blue-50"
                            : tableCType === ct
                              ? "bg-violet-600 text-white shadow-sm ring-2 ring-violet-400/50"
                              : "border border-violet-200 bg-violet-50/80 text-violet-800 hover:bg-violet-50"
                      }`}
                    >
                      {ct}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="mb-3 text-sm leading-relaxed text-slate-500">
              {isGarageShutter ? m.tableHelpGarage : m.tableHelpSheet}
            </p>
            {loading ? (
              <p className="py-8 text-center text-slate-500">{m.tableLoading}</p>
            ) : isGarageShutter ? (
              <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
                <table className="min-w-full border-collapse text-base">
                  <thead>
                    <tr className={tableHeadStyle.row}>
                      <th
                        className={`sticky left-0 z-10 border-b px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide ${tableHeadStyle.b} ${tableHeadStyle.sticky}`}
                      >
                        {m.tableCorner}
                      </th>
                      {GARAGE_WIDTH_RANGES.map((r) => (
                        <th
                          key={r.label}
                          className={`border-b px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide ${tableHeadStyle.b}`}
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
              <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
                <table className="min-w-full border-collapse text-base">
                  <thead>
                    <tr className={tableHeadStyle.row}>
                      <th
                        className={`sticky left-0 z-10 border-b px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide ${tableHeadStyle.b} ${tableHeadStyle.sticky}`}
                      >
                        {m.tableCorner}
                      </th>
                      {WIDTH_RANGES.map((r) => (
                        <th
                          key={r.label}
                          className={`border-b px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide ${tableHeadStyle.b}`}
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
              </div>
            </div>
          </div>
        )}

        <footer
          className={`border-t border-slate-200 bg-[#e8eaee] px-4 py-2.5 text-center text-slate-600 ${
            mobileOneScreen ? "block shrink-0 pb-[max(0.625rem,env(safe-area-inset-bottom,0.5rem))]" : "hidden sm:block"
          }`}
        >
          <p className="text-[11px] sm:text-xs">
            <span className="font-semibold text-slate-700">{m.footerTitle}</span>
            <span className="mx-2 text-slate-400 select-none" aria-hidden>
              ·
            </span>
            <span className="font-medium tracking-widest text-slate-500 uppercase">v{packageJson.version}</span>
          </p>
        </footer>

        {/* 가격 변경 모달 */}
        {editModal && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 pb-[max(1rem,env(safe-area-inset-bottom,1rem))] backdrop-blur-sm sm:items-center sm:pb-4"
            onClick={closeEditModal}
          >
            <div
              className="max-h-[min(85dvh,calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-2rem))] w-full max-w-md overflow-y-auto overscroll-y-contain rounded-t-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:max-h-none sm:rounded-2xl sm:p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="mb-1 text-lg font-semibold text-slate-800">{m.editPriceTitle}</h3>
              <p className="mb-4 text-sm text-slate-500">
                {m.labelWidth} {isGarageShutter ? GARAGE_WIDTH_RANGES[editModal.wIdx]?.label : WIDTH_RANGES[editModal.wIdx]?.label} × {m.labelHeight}{" "}
                {isGarageShutter ? GARAGE_HEIGHT_RANGES[editModal.hIdx]?.label : HEIGHT_RANGES[editModal.hIdx]?.label}
              </p>
              <div className="mb-4">
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">{m.prevPrice}</label>
                <p className="rounded-lg bg-slate-100 px-3 py-2.5 text-base font-medium tabular-nums text-slate-700">
                  ¥{formatNumber(table[editModal.wIdx]?.[editModal.hIdx] ?? 0)} <span className="text-slate-500">{m.yen}</span>
                </p>
              </div>
              <div className="mb-6">
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">{m.newPrice}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={editModalValue ? formatNumber(parseFormatted(editModalValue)) : editModalValue}
                    onChange={(e) => setEditModalValue(e.target.value.replace(/\D/g, ""))}
                    placeholder={m.digitsOnlyPlaceholder}
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-base tabular-nums focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  <span className="text-sm text-slate-500">{m.yen}</span>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  {m.cancel}
                </button>
                <button
                  type="button"
                  onClick={handleModalSave}
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? m.saving : m.save}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 비밀번호 모달 (히스토리 접근) */}
        {secretModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 pb-[max(1rem,env(safe-area-inset-bottom,1rem))] backdrop-blur-sm sm:items-center sm:pb-4"
            onClick={() => setSecretModalOpen(false)}
          >
            <div
              className="max-h-[min(85dvh,calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-2rem))] w-full max-w-sm overflow-y-auto overscroll-y-contain rounded-t-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:max-h-none sm:rounded-2xl sm:p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="mb-2 text-lg font-semibold text-slate-800">{m.passwordTitle}</h3>
              <p className="mb-4 text-sm text-slate-500">{m.passwordDesc}</p>
              <input
                ref={passwordInputRef}
                type="password"
                inputMode="numeric"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && handleSecretSubmit()}
                placeholder={m.passwordPlaceholder}
                maxLength={4}
                className="mb-4 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base font-medium tabular-nums text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/20"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setSecretModalOpen(false); setPasswordInput(""); }}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  {m.cancel}
                </button>
                <button
                  type="button"
                  onClick={handleSecretSubmit}
                  className="rounded-lg bg-slate-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
                >
                  {m.confirm}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {!mobileOneScreen && (
        <div
          className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200/90 bg-white/95 px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom,0.5rem))] shadow-[0_-8px_32px_-8px_rgba(15,23,42,0.1)] backdrop-blur-md sm:hidden"
          role="status"
          aria-live="polite"
          aria-label={`${m.expectedPrice} ${specSummaryLine}`}
        >
          <div className="mx-auto flex w-full max-w-4xl items-center gap-2.5">
            <div className="min-w-0 flex-1">
              <p className={`text-xl font-bold tabular-nums leading-tight tracking-tight ${priceAccent.value}`}>
                {loading ? m.loadingShort : price !== null ? `¥${formatPrice(price)}` : m.enterWxHShort}
              </p>
              <p className={`mt-0.5 truncate text-[10px] font-medium leading-snug tabular-nums max-[380px]:text-[9px] ${priceAccent.sub}`}>
                {specSummaryLine}
              </p>
              <div className="mt-1 flex items-center justify-between gap-2 border-t border-slate-200/70 pt-1">
                <p className={`text-[9px] font-bold uppercase tracking-wider ${priceAccent.label}`}>{m.expectedPrice}</p>
                <span className="shrink-0 text-[9px] font-medium tabular-nums tracking-wider text-slate-400 uppercase">
                  v{packageJson.version}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => widthInputRef.current?.focus()}
              className={`flex h-11 shrink-0 self-center items-center justify-center rounded-lg px-3.5 text-xs font-bold text-white shadow-sm active:scale-[0.98] ${priceAccent.actionBtn}`}
            >
              {m.bottomInput}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
