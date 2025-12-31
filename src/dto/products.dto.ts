import type {
  MinimalProduct,
  Product,
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
): Product[] | MinimalProduct[] | null {
  return mapProductsDto(products, ctx, { minimal: true });
}

export function productDto(
  product: ShopifySingleProduct,
  ctx: Ctx
): Product | MinimalProduct {
  return mapProductDto(product, ctx, { minimal: true });
}
