// Ad-free subscription state, shared by the ads in the shoot list and the "Remove ads" sheet.
// Uses RevenueCat, which runs Apple and Google subscriptions from one setup.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Platform } from "react-native";
import { PURCHASES } from "../../config";

// The native module isn't in Expo Go, so load it defensively; without it the app
// simply runs as the free version.
let Purchases: any = null;
try {
  Purchases = require("react-native-purchases").default;
} catch {
  Purchases = null;
}

const apiKey = Platform.select({ ios: PURCHASES.iosApiKey, android: PURCHASES.androidApiKey, default: "" });

export interface Plan {
  id: string; // RevenueCat package identifier
  period: "month" | "year";
  price: string; // from the store, e.g. "$0.99"
  pkg: unknown;
}

export interface Tip {
  id: string; // store product id
  price: string; // e.g. "$1.99"
  product: unknown;
}

export interface PremiumState {
  available: boolean; // subscriptions are set up and the store is reachable
  isPremium: boolean; // ad-free
  ready: boolean; // finished checking the store, so it's safe to decide whether to show ads
  plans: Plan[]; // monthly first, then yearly
  purchase: (plan: Plan) => Promise<"purchased" | "cancelled" | "failed">;
  restore: () => Promise<boolean>;
  tips: Tip[]; // smallest first; empty until the tip products exist in the stores
  sendTip: (tip: Tip) => Promise<"thanks" | "cancelled" | "failed">;
  sheetOpen: boolean; // the "Go ad-free" screen
  openSheet: () => void;
  closeSheet: () => void;
}

const PremiumContext = createContext<PremiumState>({
  available: false,
  isPremium: false,
  ready: true,
  plans: [],
  purchase: async () => "failed",
  restore: async () => false,
  tips: [],
  sendTip: async () => "failed",
  sheetOpen: false,
  openSheet: () => {},
  closeSheet: () => {},
});

export function usePremium(): PremiumState {
  return useContext(PremiumContext);
}

let configured = false;

function toPlan(pkg: any, period: Plan["period"]): Plan {
  return { id: pkg.identifier, period, price: pkg.product?.priceString ?? "", pkg };
}

export function PremiumProvider({ children }: { children: ReactNode }) {
  const enabled = !!Purchases && !!apiKey;
  const [isPremium, setIsPremium] = useState(false);
  const [ready, setReady] = useState(!enabled);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [tips, setTips] = useState<Tip[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const openSheet = useCallback(() => setSheetOpen(true), []);
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  const apply = useCallback((info: any) => {
    setIsPremium(!!info?.entitlements?.active?.[PURCHASES.entitlement]);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    try {
      if (!configured) {
        Purchases.setLogLevel?.(Purchases.LOG_LEVEL?.WARN);
        Purchases.configure({ apiKey });
        configured = true;
      }
    } catch {
      setReady(true);
      return;
    }
    Purchases.addCustomerInfoUpdateListener(apply);
    (async () => {
      try {
        apply(await Purchases.getCustomerInfo());
      } catch {}
      if (!cancelled) setReady(true);
      try {
        // In RevenueCat, the current offering holds a Monthly and an Annual package.
        const current = (await Purchases.getOfferings())?.current;
        const found: Plan[] = [];
        if (current?.monthly) found.push(toPlan(current.monthly, "month"));
        if (current?.annual) found.push(toPlan(current.annual, "year"));
        if (!cancelled) setPlans(found);
      } catch {}
      try {
        // One-time tips are consumable products, fetched directly (no offering needed).
        const products: any[] = await Purchases.getProducts(PURCHASES.tipProductIds, Purchases.PRODUCT_CATEGORY?.NON_SUBSCRIPTION);
        const list = (products ?? [])
          .map((p) => ({ id: p.identifier, price: p.priceString ?? "", amount: p.price ?? 0, product: p }))
          .sort((a, b) => a.amount - b.amount)
          .map(({ amount, ...t }) => t as Tip);
        if (!cancelled) setTips(list);
      } catch {}
    })();
    return () => {
      cancelled = true;
      Purchases.removeCustomerInfoUpdateListener?.(apply);
    };
  }, [enabled, apply]);

  const purchase = useCallback(async (plan: Plan) => {
    try {
      const { customerInfo } = await Purchases.purchasePackage(plan.pkg);
      apply(customerInfo);
      return "purchased" as const;
    } catch (e: any) {
      return e?.userCancelled ? ("cancelled" as const) : ("failed" as const);
    }
  }, [apply]);

  const restore = useCallback(async () => {
    try {
      const info = await Purchases.restorePurchases();
      apply(info);
      return !!info?.entitlements?.active?.[PURCHASES.entitlement];
    } catch {
      return false;
    }
  }, [apply]);

  const sendTip = useCallback(async (tip: Tip) => {
    try {
      await Purchases.purchaseStoreProduct(tip.product);
      return "thanks" as const;
    } catch (e: any) {
      return e?.userCancelled ? ("cancelled" as const) : ("failed" as const);
    }
  }, []);

  const value = useMemo<PremiumState>(
    () => ({
      available: enabled && plans.length > 0,
      isPremium,
      ready,
      plans,
      purchase,
      restore,
      tips,
      sendTip,
      sheetOpen,
      openSheet,
      closeSheet,
    }),
    [enabled, plans, isPremium, ready, purchase, restore, tips, sendTip, sheetOpen, openSheet, closeSheet]
  );

  return <PremiumContext.Provider value={value}>{children}</PremiumContext.Provider>;
}
