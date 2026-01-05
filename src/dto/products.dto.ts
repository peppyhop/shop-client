import type {
  ProductResult,
  ShopifyProduct,
  ShopifySingleProduct,
} from "../types";
import { mapProductDto, mapProductsDto } from "./products.mapped";

type Ctx = {
  storeDomain: string;
  storeSlug: string;
  currency: string;
  normalizeImageUrl: (url: string | null | undefined) => string;
  formatPrice: (amountInCents: number) => string;
};

export function productsDto(
  products: ShopifyProduct[] | null,
  ctx: Ctx
): ProductResult[] | null {
  return mapProductsDto(products, ctx, { columns: { mode: "minimal" } });
}

export function productDto(
  product: ShopifySingleProduct,
  ctx: Ctx
): ProductResult {
  return mapProductDto(product, ctx, { columns: { mode: "minimal" } });
}
