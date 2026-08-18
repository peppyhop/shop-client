import { ShopClient } from "../index";
import type { ShopifyProduct } from "../types";

function makeProduct(
  id: number,
  handle: string,
  updatedAt: string,
  productType = "Shirt"
): ShopifyProduct {
  return {
    id,
    handle,
    title: `Product ${id}`,
    vendor: "Acme",
    tags: [],
    options: [],
    created_at: "2024-01-01T00:00:00Z",
    updated_at: updatedAt,
    published_at: "2024-01-01T00:00:00Z",
    product_type: productType,
    body_html: "",
    variants: [],
    images: [],
  } as any;
}

describe("products.fingerprints", () => {
  test("returns raw handle/id/updated_at and paginates until a short page", async () => {
    const shop = new ShopClient("https://example.com/");

    // A full page (250) must trigger a second request; the short page ends it.
    const page1 = Array.from({ length: 250 }, (_, i) =>
      makeProduct(i + 1, `p-${i + 1}`, "2024-05-01T00:00:00Z")
    );
    const page2 = [
      makeProduct(251, "p-251", "2024-06-02T12:30:00Z"),
      makeProduct(252, "p-252", "2024-06-03T09:00:00Z"),
    ];

    const originalFetch = (global as any).fetch;
    const seen: string[] = [];
    (global as any).fetch = jest.fn(async (input: any) => {
      const url = typeof input === "string" ? input : (input?.url ?? "");
      seen.push(url);
      if (url.includes("/products.json") && url.includes("page=1")) {
        return { ok: true, json: async () => ({ products: page1 }) } as any;
      }
      if (url.includes("/products.json") && url.includes("page=2")) {
        return { ok: true, json: async () => ({ products: page2 }) } as any;
      }
      return { ok: false, status: 404, statusText: "Not Found" } as any;
    });

    try {
      const result = await shop.products.fingerprints();

      expect(result.length).toBe(252);
      expect(result[0]).toEqual({
        handle: "p-1",
        id: 1,
        updated_at: "2024-05-01T00:00:00Z",
      });
      expect(result[251]).toEqual({
        handle: "p-252",
        id: 252,
        updated_at: "2024-06-03T09:00:00Z",
      });

      // Exactly two pages, both at the max page size.
      expect(seen.length).toBe(2);
      expect(seen.every((u) => u.includes("limit=250"))).toBe(true);
    } finally {
      (global as any).fetch = originalFetch;
    }
  });

  test("includes gift cards, unlike products.all", async () => {
    const shop = new ShopClient("https://example.com/");

    const products = [
      makeProduct(1, "a-shirt", "2024-05-01T00:00:00Z", "Shirt"),
      makeProduct(2, "a-gift-card", "2024-05-02T00:00:00Z", "Gift Card"),
    ];

    const originalFetch = (global as any).fetch;
    (global as any).fetch = jest.fn(async (input: any) => {
      const url = typeof input === "string" ? input : (input?.url ?? "");
      if (url.includes("/products.json")) {
        return { ok: true, json: async () => ({ products }) } as any;
      }
      return { ok: false, status: 404, statusText: "Not Found" } as any;
    });

    try {
      const result = await shop.products.fingerprints();
      expect(result.map((p) => p.handle)).toEqual(["a-shirt", "a-gift-card"]);
    } finally {
      (global as any).fetch = originalFetch;
    }
  });

  test("throws on a non-ok response", async () => {
    const shop = new ShopClient("https://example.com/");

    const originalFetch = (global as any).fetch;
    (global as any).fetch = jest.fn(
      async () => ({ ok: false, status: 500, statusText: "Server Error" }) as any
    );

    try {
      await expect(shop.products.fingerprints()).rejects.toThrow(/HTTP 500/);
    } finally {
      (global as any).fetch = originalFetch;
    }
  });

  test("returns an empty array for a store with no products", async () => {
    const shop = new ShopClient("https://example.com/");

    const originalFetch = (global as any).fetch;
    (global as any).fetch = jest.fn(
      async () => ({ ok: true, json: async () => ({ products: [] }) }) as any
    );

    try {
      expect(await shop.products.fingerprints()).toEqual([]);
    } finally {
      (global as any).fetch = originalFetch;
    }
  });
});
