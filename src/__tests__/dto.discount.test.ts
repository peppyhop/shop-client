import { mapProductDto } from "../dto/products.mapped";
import type { ShopifySingleProduct } from "../types";

describe("Product DTO Discount Mapping", () => {
  const mockCtx = {
    storeDomain: "https://test.myshopify.com",
    storeSlug: "test-store",
    currency: "USD",
    normalizeImageUrl: (url: string | null | undefined) => url || "",
    formatPrice: (amount: number) => `$${(amount / 100).toFixed(2)}`,
  };

  test("should calculate discount correctly when compare_at_price is present", () => {
    const product: ShopifySingleProduct = {
      id: 1,
      title: "Test Product",
      handle: "test-product",
      price: 8000, // $80.00
      compare_at_price: 10000, // $100.00
      price_min: 8000,
      price_max: 8000,
      compare_at_price_min: 10000,
      compare_at_price_max: 10000,
      price_varies: false,
      compare_at_price_varies: false,
      available: true,
      description: "Description",
      created_at: "2023-01-01T00:00:00Z",
      updated_at: "2023-01-01T00:00:00Z",
      published_at: "2023-01-01T00:00:00Z",
      vendor: "Vendor",
      type: "Type",
      tags: [],
      variants: [],
      images: [],
      featured_image: null,
      options: [],
      media: [],
      requires_selling_plan: false,
      selling_plan_groups: [],
    };

    const mapped = mapProductDto(product, mockCtx);
    expect(mapped.discount).toBe(20); // (100 - 80) / 100 = 20%
  });

  test("should set discount to 0 when compare_at_price is null", () => {
    const product: ShopifySingleProduct = {
      id: 2,
      title: "No Discount Product",
      handle: "no-discount",
      price: 10000,
      compare_at_price: null,
      price_min: 10000,
      price_max: 10000,
      compare_at_price_min: 0,
      compare_at_price_max: 0,
      price_varies: false,
      compare_at_price_varies: false,
      available: true,
      description: "Description",
      created_at: "2023-01-01T00:00:00Z",
      updated_at: "2023-01-01T00:00:00Z",
      published_at: "2023-01-01T00:00:00Z",
      vendor: "Vendor",
      type: "Type",
      tags: [],
      variants: [],
      images: [],
      featured_image: null,
      options: [],
      media: [],
      requires_selling_plan: false,
      selling_plan_groups: [],
    };

    const mapped = mapProductDto(product, mockCtx);
    expect(mapped.discount).toBe(0);
  });
});
