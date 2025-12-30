import type { ShopInfo } from "../store";
import type { OpenRouterConfig, StoreTypeBreakdown } from "../types";
import { determineStoreType as determineStoreTypeViaLLM } from "./enrich";

type Args = {
  getInfo: () => Promise<ShopInfo>;
  baseUrl: string;
  findProduct: (handle: string) => Promise<unknown>;
  apiKey?: string;
  model?: string;
  openRouter?: OpenRouterConfig;
  maxShowcaseProducts?: number;
  maxShowcaseCollections?: number;
};

/**
 * Lightweight wrapper for determining store type by delegating to utils/enrich.
 * It first fetches StoreInfo via getInfo, then passes showcase samples
 * directly to the enrichment function.
 */
export async function determineStoreTypeForStore(
  args: Args
): Promise<StoreTypeBreakdown> {
  const info = await args.getInfo();

  const maxProducts = Math.max(0, Math.min(50, args.maxShowcaseProducts ?? 10));
  const maxCollections = Math.max(
    0,
    Math.min(50, args.maxShowcaseCollections ?? 10)
  );

  const take = <T>(arr: T[], n: number): T[] => arr.slice(0, Math.max(0, n));

  const productsSample = Array.isArray(info.showcase.products)
    ? take(info.showcase.products, maxProducts)
    : [];
  const collectionsSample = Array.isArray(info.showcase.collections)
    ? take(info.showcase.collections, maxCollections)
    : [];

  const breakdown = await determineStoreTypeViaLLM(
    {
      title: info.title || info.name,
      description: info.description ?? null,
      showcase: {
        products: productsSample,
        collections: collectionsSample,
      },
    },
    { apiKey: args.apiKey, model: args.model, openRouter: args.openRouter }
  );

  return breakdown as StoreTypeBreakdown;
}
