import { ShopClient } from "../index";
import type { ShopifyProduct } from "../types";

jest.mock("../utils/detect-country", () => ({
  detectShopCountry: jest.fn(async () => ({
    country: "US",
    currencyCode: "USD",
    confidence: 1,
    signals: ["Shopify.currency.active"],
  })),
}));

describe("products.recommendations", () => {
  const baseUrl = "https://examplestore.com/";

  function makeProduct(id: number, handle: string, title: string): ShopifyProduct {
    return {
      id,
      handle,
      title,
      body_html: "<p>Body</p>",
      published_at: "2024-01-01T00:00:00Z",
      product_type: "Type",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
      vendor: "Vendor",
      tags: ["Tag"],
      images: [
        {
          id: id * 10,
          product_id: id,
          position: 1,
          src: "https://cdn.example.com/img.jpg",
          width: 0,
          height: 0,
          variant_ids: [],
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        } as any,
      ],
      options: [{ name: "Size", position: 1, values: ["S", "M"] }],
      variants: [
        {
          id: id * 100,
          title: "S",
          option1: "S",
          option2: null as any,
          option3: null as any,
          sku: "",
          requires_shipping: true,
          taxable: true,
          featured_image: null as any,
          available: true,
          price: 1000,
          compare_at_price: 0,
          position: 1,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
          grams: 0,
        } as any,
      ],
    } as any;
  }

  beforeEach(() => {
    const mockFetch = jest.fn(async (input: any) => {
      const url = typeof input === "string" ? input : input?.url ?? "";
      if (url === baseUrl) {
        return { ok: true, text: async () => "<html></html>" } as any;
      }
      if (url.startsWith(`${baseUrl}en/recommendations/products.json`)) {
        return {
          ok: true,
          json: async () => [makeProduct(1, "prod-1", "Product 1"), makeProduct(2, "prod-2", "Product 2")],
        } as any;
      }
      return { ok: false, status: 404, statusText: "Not Found" } as any;
    });
    (global as any).fetch = mockFetch;
  });

  test("returns normalized Product[] and applies store currency", async () => {
    const shop = new ShopClient(baseUrl);
    await shop.getInfo();
    const results = await shop.products.recommendations(1234567890, { limit: 2, intent: "related", locale: "en" });
    expect(results).toBeDefined();
    if (!results) return;
    expect(results.length).toBe(2);
    for (const p of results) {
      expect(p.handle).toMatch(/^prod-/);
      expect(p.currency).toBe("USD");
      expect(p.localizedPricing).toBeDefined();
      if (!p.localizedPricing) continue;
      expect(p.localizedPricing.currency).toBe("USD");
    }
  });
});

