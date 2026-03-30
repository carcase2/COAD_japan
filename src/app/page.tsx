import { CalculatorLocaleProvider } from "@/components/CalculatorLocaleProvider";
import PriceCalculator from "@/components/PriceCalculator";

export default function Home() {
  return (
    <main className="w-full">
      <CalculatorLocaleProvider>
        <PriceCalculator />
      </CalculatorLocaleProvider>
    </main>
  );
}
