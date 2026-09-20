import { BuyButtons } from "./BuyButtons";
import { SwapWidget } from "./SwapWidget";

function SwapPlaceholder() {
  return (
    <div className="swap-slot">
      <p className="swap-slot-copy">
        Two routes to ULTCAT on Cronos. Take either one.
      </p>
      <BuyButtons />
    </div>
  );
}

export function SwapSlot() {
  const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID;

  if (!projectId) {
    return <SwapPlaceholder />;
  }

  return <SwapWidget />;
}
