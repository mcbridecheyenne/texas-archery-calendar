// Buying a "Featured" spot for a shoot: a one-time Apple purchase through RevenueCat.
// The purchase alone doesn't feature anything; src/features/featured/api.ts then asks the
// claim-feature edge function, which checks the purchase and creates the feature.
import { PURCHASES } from "../../config";

let Purchases: any = null;
try {
  Purchases = require("react-native-purchases").default;
} catch {
  Purchases = null;
}

export interface FeatureProduct {
  id: string;
  price: string; // from the store, e.g. "$4.99"
  product: unknown;
}

/** The feature products the store returned, by id. Empty until they exist in App Store Connect. */
export async function loadFeatureProducts(): Promise<Record<string, FeatureProduct>> {
  if (!Purchases) return {};
  try {
    const products: any[] = await Purchases.getProducts(PURCHASES.featureProductIds, Purchases.PRODUCT_CATEGORY?.NON_SUBSCRIPTION);
    const out: Record<string, FeatureProduct> = {};
    for (const p of products ?? []) out[p.identifier] = { id: p.identifier, price: p.priceString ?? "", product: p };
    return out;
  } catch {
    return {};
  }
}

export type FeatureBuyResult =
  | { status: "bought"; transactionId: string; appUserId: string }
  | { status: "cancelled" }
  | { status: "failed" };

export async function buyFeature(product: FeatureProduct): Promise<FeatureBuyResult> {
  try {
    const result = await Purchases.purchaseStoreProduct(product.product);
    const transactionId: string | undefined = result?.transaction?.transactionIdentifier;
    const appUserId: string | undefined = result?.customerInfo?.originalAppUserId ?? (await Purchases.getAppUserID());
    if (!transactionId || !appUserId) return { status: "failed" };
    return { status: "bought", transactionId, appUserId };
  } catch (e: any) {
    return e?.userCancelled ? { status: "cancelled" } : { status: "failed" };
  }
}
