"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { CalcLocale } from "@/lib/i18n/calculator";
import { calculatorMessages, formatCalcNumber, garagePanelLabel, productLabel } from "@/lib/i18n/calculator";
import type { GaragePanelType, ProductType } from "@/lib/price";

const STORAGE_KEY = "coad-calculator-locale";

type Ctx = {
  locale: CalcLocale;
  setLocale: (l: CalcLocale) => void;
  m: (typeof calculatorMessages)["ko"];
  formatNum: (n: number) => string;
  product: (pt: ProductType) => string;
  garage: (gt: GaragePanelType) => string;
};

const CalculatorLocaleContext = createContext<Ctx | null>(null);

export function CalculatorLocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<CalcLocale>("ko");

  useEffect(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      if (s === "ja" || s === "ko") setLocaleState(s);
    } catch {
      /* ignore */
    }
  }, []);

  const setLocale = useCallback((l: CalcLocale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<Ctx>(() => {
    const m = calculatorMessages[locale];
    return {
      locale,
      setLocale,
      m,
      formatNum: (n: number) => formatCalcNumber(n, locale),
      product: (pt: ProductType) => productLabel(locale, pt),
      garage: (gt: GaragePanelType) => garagePanelLabel(locale, gt),
    };
  }, [locale, setLocale]);

  return <CalculatorLocaleContext.Provider value={value}>{children}</CalculatorLocaleContext.Provider>;
}

export function useCalculatorLocale(): Ctx {
  const ctx = useContext(CalculatorLocaleContext);
  if (!ctx) throw new Error("useCalculatorLocale must be used within CalculatorLocaleProvider");
  return ctx;
}
