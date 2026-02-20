"use client";

import { useState, useEffect, useCallback } from "react";
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

export default function PriceCalculator() {
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
      await applyGarageGlobalAdditionToTable(globalAddition);
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

  const isGarageShutter = productType === "garage_shutter";

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="mx-auto max-w-4xl space-y-8">
        <h1 className="text-2xl font-bold text-slate-900">가격 계산기</h1>

        {/* 모델 선택 */}
        <section className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-800">모델 선택</h2>
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
            <p className="mt-2 text-sm text-amber-600">
              차고셔터: 폭 2400~6000mm, 높이 2100~2700mm. 우드판넬·다크계열·프리미엄판넬.
            </p>
          )}
        </section>

        {/* 계산기 폼 */}
        <section className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-800">사양 입력</h2>
          <div className="flex flex-wrap gap-6">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">폭 (mm)</label>
              <input
                type="text"
                inputMode="numeric"
                value={width ? formatNumber(parseFormatted(width)) : width}
                onChange={(e) => setWidth(e.target.value.replace(/\D/g, ""))}
                placeholder={isGarageShutter ? "2400~6000" : "800~10000+"}
                className="w-36 rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">높이 (mm)</label>
              <input
                type="text"
                inputMode="numeric"
                value={height ? formatNumber(parseFormatted(height)) : height}
                onChange={(e) => setHeight(e.target.value.replace(/\D/g, ""))}
                placeholder={isGarageShutter ? "2100~2700" : "1000~6000+"}
                className="w-36 rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">타입</label>
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
          <div className="mt-4 flex items-center gap-2">
            <span className="text-base font-medium text-slate-700">예상 가격:</span>
            <span className="text-xl font-bold text-blue-700">
              {loading ? "로딩 중..." : price !== null ? `¥${formatPrice(price)} (엔)` : "-"}
            </span>
          </div>
        </section>

        {/* 단가 테이블 보기 (자주 변경하지 않으므로 접혀 있음) */}
        <section
          className={`rounded-xl border-2 transition-colors ${
            showTable ? "border-slate-300 bg-white" : "border-dashed border-slate-300 bg-slate-50"
          }`}
        >
          <button
            onClick={() => setShowTable(!showTable)}
            className="flex w-full items-center justify-between px-6 py-4 text-left transition hover:bg-slate-100/50"
          >
            <div className="flex items-center gap-3">
              <span className="text-lg text-slate-500" aria-hidden>
                {showTable ? "▼" : "▶"}
              </span>
              <div>
                <span className="text-lg font-semibold text-slate-800">
                  {showTable ? "단가 테이블 숨기기" : "단가 테이블 보기"}
                </span>
                {!showTable && (
                  <p className="mt-0.5 text-sm text-slate-500">
                    단가 수정이 필요할 때만 클릭하여 들어가세요
                  </p>
                )}
              </div>
            </div>
          </button>

          {/* 단가 테이블 (보기 클릭 시 표시) */}
          {showTable && (
          <section className="overflow-x-auto rounded-xl bg-white p-6 shadow-sm">
            {/* 시트셔터: C-2, C-3 추가 금액 | 차고셔터: 패널 설정 (DB 저장) */}
            {!isGarageShutter ? (
              <div className="mb-6 flex flex-wrap items-end gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <span className="text-sm font-medium text-slate-700">
                  C 타입 추가 금액 <span className="text-slate-500">(DB 저장)</span>
                </span>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-slate-600">C-2</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatNumber(c2Addition)}
                    onChange={(e) => setC2Addition(parseFormatted(e.target.value))}
                    className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-600">엔 (¥)</span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-slate-600">C-3</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatNumber(c3Addition)}
                    onChange={(e) => setC3Addition(parseFormatted(e.target.value))}
                    className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-600">엔 (¥)</span>
                </div>
                <button
                  onClick={handleSaveAdditions}
                  disabled={savingAdditions}
                  className="rounded-lg bg-slate-600 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                >
                  {savingAdditions ? "저장 중..." : "저장"}
                </button>
              </div>
            ) : (
              <div className="mb-6 flex flex-wrap items-end gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <span className="text-sm font-medium text-slate-700">
                  차고 패널 설정 <span className="text-slate-500">(DB 저장)</span>
                </span>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-slate-600">우드 배율</label>
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
                    className="w-20 rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-slate-600">다크 추가</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatNumber(darkAddition)}
                    onChange={(e) => setDarkAddition(parseFormatted(e.target.value))}
                    className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-600">엔</span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-slate-600">프리미엄 추가</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatNumber(premiumAddition)}
                    onChange={(e) => setPremiumAddition(parseFormatted(e.target.value))}
                    className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-600">엔</span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-slate-600">전체 추가 금액</label>
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
                    className="w-36 rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-600">엔</span>
                  <button
                    type="button"
                    onClick={handleApplyGlobalAddition}
                    disabled={applyingGlobalAddition || globalAddition === 0}
                    className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                  >
                    {applyingGlobalAddition ? "적용 중..." : "전체 테이블에 적용"}
                  </button>
                </div>
                <p className="w-full text-xs text-slate-500">일시 적용: 금액 입력 후 「전체 테이블에 적용」을 누르면 차고 기본 단가 전체에 더해지고, 전체 추가 금액은 0으로 초기화됩니다.</p>
                <button
                  onClick={handleSaveGarageSettings}
                  disabled={savingGarageSettings}
                  className="rounded-lg bg-slate-600 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                >
                  {savingGarageSettings ? "저장 중..." : "저장"}
                </button>
              </div>
            )}
            <div className="mb-4 flex items-center gap-4">
              <h2 className="text-lg font-semibold text-slate-800">
                단가 테이블 ({PRODUCT_TYPES[productType]})
              </h2>
              {saving && <span className="text-sm font-medium text-slate-600">저장 중...</span>}
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
            <p className="mb-3 text-sm font-medium text-slate-600">
              {isGarageShutter
                ? "기본만 클릭하여 수정. 우드/다크/프리미엄은 자동 계산됩니다."
                : "가격을 클릭하면 변경 모달이 열립니다. C-1 기준 단가를 수정하면 C-2, C-3는 자동 계산됩니다."}
            </p>
            {loading ? (
              <p className="py-8 text-center text-slate-500">로딩 중...</p>
            ) : isGarageShutter ? (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse border border-slate-400 text-base">
                  <thead>
                    <tr className="bg-slate-200">
                      <th className="border border-slate-400 px-3 py-2 text-left font-semibold text-slate-900">
                        높이 \\ 폭
                      </th>
                      {GARAGE_WIDTH_RANGES.map((r) => (
                        <th
                          key={r.label}
                          className="border border-slate-400 px-3 py-2 text-center font-semibold text-slate-900"
                        >
                          {r.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {GARAGE_HEIGHT_RANGES.map((hr, hIdx) => (
                      <tr key={hr.label}>
                        <td className="border border-slate-400 px-3 py-2 font-semibold text-slate-800">
                          {hr.label}
                        </td>
                        {GARAGE_WIDTH_RANGES.map((wr, wIdx) => (
                          <td key={wr.label} className="border border-slate-400 p-0">
                            {tableGaragePanelType === "base" ? (
                              <button
                                type="button"
                                onClick={() => openEditModal(wIdx, hIdx)}
                                className="min-w-[6rem] w-full cursor-pointer border-0 px-3 py-2 text-center text-base font-medium text-slate-900 transition hover:bg-blue-50 focus:bg-blue-100 focus:outline-none"
                              >
                                ¥{formatPrice(getGarageDisplayPrice(table[wIdx]?.[hIdx] ?? 0, "base", garageSettings))}
                              </button>
                            ) : (
                              <span className="block min-w-[6rem] px-3 py-2 text-center text-base font-medium text-slate-700">
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
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse border border-slate-400 text-base">
                  <thead>
                    <tr className="bg-slate-200">
                      <th className="border border-slate-400 px-3 py-2 text-left font-semibold text-slate-900">
                        높이 \\ 폭
                      </th>
                      {WIDTH_RANGES.map((r) => (
                        <th
                          key={r.label}
                          className="border border-slate-400 px-3 py-2 text-center font-semibold text-slate-900"
                        >
                          {r.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {HEIGHT_RANGES.map((hr, hIdx) => (
                      <tr key={hr.label}>
                        <td className="border border-slate-400 px-3 py-2 font-semibold text-slate-800">
                          {hr.label}
                        </td>
                        {WIDTH_RANGES.map((wr, wIdx) => (
                          <td key={wr.label} className="border border-slate-400 p-0">
                            <button
                              type="button"
                              onClick={() => openEditModal(wIdx, hIdx)}
                              className="min-w-[7rem] w-full cursor-pointer border-0 px-3 py-2 text-center text-base font-medium text-slate-900 transition hover:bg-blue-50 focus:bg-blue-100 focus:outline-none"
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={closeEditModal}
          >
            <div
              className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="mb-4 text-lg font-semibold text-slate-800">가격 변경</h3>
              <p className="mb-2 text-sm text-slate-600">
                폭 {isGarageShutter ? GARAGE_WIDTH_RANGES[editModal.wIdx]?.label : WIDTH_RANGES[editModal.wIdx]?.label} × 높이 {isGarageShutter ? GARAGE_HEIGHT_RANGES[editModal.hIdx]?.label : HEIGHT_RANGES[editModal.hIdx]?.label}
              </p>
              <div className="mb-4">
                <label className="mb-1 block text-sm text-slate-600">기존 가격</label>
                <p className="rounded-lg bg-slate-100 px-3 py-2 text-base font-medium text-slate-700">
                  ¥{formatNumber(table[editModal.wIdx]?.[editModal.hIdx] ?? 0)} (엔)
                </p>
              </div>
              <div className="mb-6">
                <label className="mb-1 block text-sm text-slate-600">변경 가격</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={editModalValue ? formatNumber(parseFormatted(editModalValue)) : editModalValue}
                  onChange={(e) => setEditModalValue(e.target.value.replace(/\D/g, ""))}
                  placeholder="변경할 가격 입력"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-slate-600">엔 (¥)</span>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleModalSave}
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? "저장 중..." : "저장"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
