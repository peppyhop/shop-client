import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { ShopClient } from "../index";
import type { ShopifyProduct, ShopifySingleProduct } from "../types";

describe("products.findEnhanced", () => {
  const baseUrl = "https://examplestore.com/";
  const handle = "test-product";
  const endpoint = "https://shopify-product-enrichment-worker.ninjacode.workers.dev";

  const singleProduct: ShopifySingleProduct = {
    id: 1,
    title: "Test Product",
    handle,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-02T00:00:00Z",
    vendor: "Vendor",
    tags: [],
    options: [],
    description: "Description",
    published_at: "2024-01-01T00:00:00Z",
    type: "Type",
    price: 100,
    price_min: 100,
    price_max: 100,
    available: true,
    price_varies: false,
    compare_at_price: null,
    compare_at_price_min: 0,
    compare_at_price_max: 0,
    compare_at_price_varies: false,
    variants: [],
    images: [],
    featured_image: null,
    url: undefined,
    media: [],
    requires_selling_plan: false,
    selling_plan_groups: [],
  } as any;

  const shopify: ShopifyProduct = {
    id: 1,
    title: "Test Product",
    handle,
    body_html: "<p>Body</p>",
    published_at: "2024-01-01T00:00:00Z",
    product_type: "Type",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-02T00:00:00Z",
    vendor: "Vendor",
    tags: ["Tag"],
    images: [],
    options: [],
    variants: [],
  } as any;

  const enhancedResponse = {
    shopify,
    enrichment: {
      canonical: {
        title: "Canonical Title",
        summary: "Summary",
        highlights: ["h1"],
        materials: null,
        fit_and_size: null,
        care: null,
        what_makes_it_special: null,
        missing_info: [],
        images: [{ textContext: "ctx", url: "https://example.com/img.jpg", alt: "alt" }],
      },
      markdown: "# Markdown",
    },
    cache: "miss",
  };

  beforeEach(() => {
    const mockFetch = jest.fn(async (input: any, init?: any) => {
      const url = typeof input === "string" ? input : input?.url ?? "";

      if (url === `${baseUrl}products/${handle}`) {
        return {
          ok: true,
          url,
          text: async () => "<html></html>",
        } as any;
      }

      if (url === `${baseUrl}products/${handle}.js`) {
        return {
          ok: true,
          json: async () => singleProduct,
        } as any;
      }

      if (url === endpoint) {
        const headers = init?.headers ?? {};
        const apiKey =
          typeof headers.get === "function"
            ? headers.get("x-api-key")
            : headers["x-api-key"] ?? headers["X-API-KEY"];

        if (apiKey !== "test-key") {
          return { ok: false, status: 401, statusText: "Unauthorized" } as any;
        }

        return {
          ok: true,
          json: async () => enhancedResponse,
        } as any;
      }

      return { ok: false, status: 404, statusText: "Not Found" } as any;
    });

    (global as any).fetch = mockFetch;
  });

  test("throws when apiKey missing", async () => {
    const shop = new ShopClient(baseUrl);
    // @ts-expect-error Testing runtime validation
    await expect(shop.products.findEnhanced(handle)).rejects.toThrow(/apiKey/i);
    // @ts-expect-error Testing runtime validation
    await expect(shop.products.findEnhanced(handle, {})).rejects.toThrow(/apiKey/i);
  });

  test("posts expected payload and returns response", async () => {
    const shop = new ShopClient(baseUrl);
    const result = await shop.products.findEnhanced(handle, { apiKey: "test-key" });
    expect(result).toEqual(enhancedResponse);

    const fetchMock = global.fetch as unknown as jest.Mock;
    const call = (fetchMock.mock.calls as any[]).find((c) => c[0] === endpoint);
    expect(call).toBeDefined();

    const init = call?.[1] ?? {};
    expect(init.method).toBe("POST");

    const body = JSON.parse(init.body);
    expect(body).toEqual({
      storeDomain: "examplestore.com",
      handle,
      updatedAt: "2024-01-02T00:00:00Z",
    });
  });

  test("uses custom endpoint when provided", async () => {
    const customEndpoint = "https://custom-worker.dev/api";
    const shop = new ShopClient(baseUrl);
    
    // Setup fetch mock to handle custom endpoint
    const fetchMock = global.fetch as unknown as jest.Mock;
    fetchMock.mockImplementationOnce(async (input: any, init?: any) => {
      const url = typeof input === "string" ? input : input?.url ?? "";
      if (url === customEndpoint) {
        return {
          ok: true,
          json: async () => enhancedResponse,
        } as any;
      }
      // Delegate to default mock logic for other URLs
      // Note: We need to reimplement basic mock logic since mockImplementationOnce replaces it for this call
      if (url === `${baseUrl}products/${handle}.js`) {
        return { ok: true, json: async () => singleProduct } as any;
      }
      if (url === `${baseUrl}products/${handle}`) {
        return { ok: true, url, text: async () => "<html></html>" } as any;
      }
      return { ok: false, status: 404 } as any;
    });

    // We need to re-mock specifically for this test because the default mock logic 
    // is set in beforeEach but we want to intercept the custom endpoint call.
    // However, simplest way is to rely on beforeEach and just update the logic there? 
    // But beforeEach is already set.
    // Let's just modify the test to update the mock behavior temporarily or checking arguments.
    
    // Resetting mock implementation to handle the custom endpoint check more cleanly
    fetchMock.mockImplementation(async (input: any, init?: any) => {
      const url = typeof input === "string" ? input : input?.url ?? "";
      
      if (url === customEndpoint) {
         return { ok: true, json: async () => enhancedResponse } as any;
      }
      // Standard checks from beforeEach
      if (url === `${baseUrl}products/${handle}`) return { ok: true, url, text: async () => "<html></html>" } as any;
      if (url === `${baseUrl}products/${handle}.js`) return { ok: true, json: async () => singleProduct } as any;
      if (url === endpoint) return { ok: true, json: async () => enhancedResponse } as any;
      
      return { ok: false, status: 404 } as any;
    });

    const result = await shop.products.findEnhanced(handle, { 
      apiKey: "test-key", 
      endpoint: customEndpoint 
    });
    
    expect(result).toEqual(enhancedResponse);
    const call = (fetchMock.mock.calls as any[]).find((c) => c[0] === customEndpoint);
    expect(call).toBeDefined();
  });
});
