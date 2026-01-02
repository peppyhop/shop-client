import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { ShopClient } from "../index";
import type { ShopifyProduct, ShopifySingleProduct } from "../types";

describe("products.findEnhanced", () => {
  const baseUrl = "https://examplestore.com/";
  const handle = "test-product";
  const endpoint = "https://shopify-product-enrichment-worker.ninjacode.workers.dev";
  const customEndpoint = "https://custom-worker.dev/api";
  const updatedAt = "2024-01-02T00:00:00Z";

  const singleProduct: ShopifySingleProduct = {
    id: 1,
    title: "Test Product",
    handle,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-02T00:00:00Z",
    vendor: "Vendor",
    tags: [],
    options: [{ name: "Size", position: 1, values: ["S", "M"] }],
    description: "<p>Description</p>",
    published_at: "2024-01-01T00:00:00Z",
    type: "Type",
    price: 100,
    price_min: 100,
    price_max: 100,
    available: true,
    price_varies: false,
    compare_at_price: 200,
    compare_at_price_min: 200,
    compare_at_price_max: 200,
    compare_at_price_varies: false,
    variants: [
      {
        id: 101,
        title: "Default Title",
        handle: "default-title",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-02T00:00:00Z",
        option1: "S",
        option2: null,
        option3: null,
        sku: null,
        requires_shipping: true,
        taxable: true,
        position: 1,
        product_id: 1,
        featured_image: null,
        featured_media: null,
        available: true,
        price: "1.00",
        compare_at_price: "2.00",
        inventory_quantity: 0,
        inventory_management: null,
      },
    ],
    images: ["https://example.com/img.jpg"],
    featured_image: "https://example.com/img.jpg",
    url: undefined,
    media: [],
    requires_selling_plan: false,
    selling_plan_groups: [],
  } as any;

  const shopifyProduct: ShopifyProduct = {
    id: 1,
    title: "Test Product",
    handle,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-02T00:00:00Z",
    vendor: "Vendor",
    tags: [],
    options: [{ name: "Size", position: 1, values: ["S", "M"] }],
    body_html: "<p>Description</p>",
    published_at: "2024-01-01T00:00:00Z",
    product_type: "Type",
    variants: [
      {
        id: 101,
        title: "Default Title",
        handle: "default-title",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-02T00:00:00Z",
        option1: "S",
        option2: null,
        option3: null,
        sku: null,
        requires_shipping: true,
        taxable: true,
        position: 1,
        product_id: 1,
        featured_image: null,
        available: true,
        price: "1.00",
        compare_at_price: "2.00",
      },
    ],
    images: [
      {
        id: 201,
        title: "img",
        handle: "img",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-02T00:00:00Z",
        src: "https://example.com/img.jpg",
        position: 1,
        product_id: 1,
        variant_ids: [],
        width: 100,
        height: 100,
      },
    ],
  } as any;

  const workerEnhancedResponse = {
    shopify: shopifyProduct,
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

      if (url === endpoint || url === customEndpoint) {
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
          json: async () => workerEnhancedResponse,
        } as any;
      }

      return { ok: false, status: 404, statusText: "Not Found" } as any;
    });

    (global as any).fetch = mockFetch;
  });

  function expectCoreProductFieldsMatch(
    a: any,
    b: any
  ) {
    expect(a).toBeDefined();
    expect(b).toBeDefined();

    expect(a.handle).toBe(b.handle);
    expect(a.platformId).toBe(b.platformId);
    expect(a.title).toBe(b.title);
    expect(a.slug).toBe(b.slug);
    expect(a.url).toBe(b.url);
    expect(a.available).toBe(b.available);
    expect(a.price).toBe(b.price);
    expect(a.priceMin).toBe(b.priceMin);
    expect(a.priceMax).toBe(b.priceMax);
    expect(a.compareAtPrice).toBe(b.compareAtPrice);
    expect(a.compareAtPriceMin).toBe(b.compareAtPriceMin);
    expect(a.compareAtPriceMax).toBe(b.compareAtPriceMax);
    expect(a.discount).toBe(b.discount);
    expect(a.vendor).toBe(b.vendor);
    expect(a.productType).toBe(b.productType);
    expect(a.storeDomain).toBe(b.storeDomain);
    expect(a.storeSlug).toBe(b.storeSlug);
  }

  test("throws when apiKey missing", async () => {
    const shop = new ShopClient(baseUrl);
    // @ts-expect-error Testing runtime validation
    await expect(shop.products.findEnhanced(handle)).rejects.toThrow(/apiKey/i);
    // @ts-expect-error Testing runtime validation
    await expect(shop.products.findEnhanced(handle, {})).rejects.toThrow(/apiKey/i);
  });

  test("allows missing updatedAt", async () => {
    const shop = new ShopClient(baseUrl);
    await expect(
      shop.products.findEnhanced(handle, { apiKey: "test-key" })
    ).resolves.toBeDefined();
    await expect(
      shop.products.minimal.findEnhanced(handle, { apiKey: "test-key" })
    ).resolves.toBeDefined();
  });

  test("posts expected payload and returns response", async () => {
    const shop = new ShopClient(baseUrl);
    const result = await shop.products.findEnhanced(handle, {
      apiKey: "test-key",
      updatedAt,
    });
    const expectedProduct = (shop.productsDto([shopifyProduct], {
      minimal: false,
    }) as any)?.[0];
    expect(result).toEqual({
      product: expectedProduct,
      enrichment: workerEnhancedResponse.enrichment,
      cache: workerEnhancedResponse.cache,
    });

    const fetchMock = global.fetch as unknown as jest.Mock;
    const call = (fetchMock.mock.calls as any[]).find((c) => c[0] === endpoint);
    expect(call).toBeDefined();

    const init = call?.[1] ?? {};
    expect(init.method).toBe("POST");

    const body = JSON.parse(init.body);
    expect(body).toEqual({
      storeDomain: "examplestore.com",
      handle,
      updatedAt,
    });
  });

  test("omits updatedAt from payload when missing", async () => {
    const shop = new ShopClient(baseUrl);
    await shop.products.findEnhanced(handle, { apiKey: "test-key" });

    const fetchMock = global.fetch as unknown as jest.Mock;
    const call = (fetchMock.mock.calls as any[]).find((c) => c[0] === endpoint);
    expect(call).toBeDefined();

    const init = call?.[1] ?? {};
    const body = JSON.parse(init.body);
    expect(body).toEqual({
      storeDomain: "examplestore.com",
      handle,
    });
  });

  test("uses custom endpoint when provided", async () => {
    const shop = new ShopClient(baseUrl);

    const result = await shop.products.findEnhanced(handle, {
      apiKey: "test-key",
      updatedAt,
      endpoint: customEndpoint,
    });
    
    const expectedProduct = (shop.productsDto([shopifyProduct], {
      minimal: false,
    }) as any)?.[0];
    expect(result).toEqual({
      product: expectedProduct,
      enrichment: workerEnhancedResponse.enrichment,
      cache: workerEnhancedResponse.cache,
    });
    const fetchMock = global.fetch as unknown as jest.Mock;
    const call = (fetchMock.mock.calls as any[]).find((c) => c[0] === customEndpoint);
    expect(call).toBeDefined();
  });

  test("minimal.findEnhanced applies minimal DTO transforms", async () => {
    const shop = new ShopClient(baseUrl);
    const result = await shop.products.minimal.findEnhanced(handle, {
      apiKey: "test-key",
      updatedAt,
    });
    const expectedProduct = (shop.productsDto([shopifyProduct], {
      minimal: true,
    }) as any)?.[0];
    expect(result).toEqual({
      product: expectedProduct,
      enrichment: workerEnhancedResponse.enrichment,
      cache: workerEnhancedResponse.cache,
    });
  });

  test("findEnhanced.product matches find() response for core fields", async () => {
    const shop = new ShopClient(baseUrl);
    const [base, enhanced] = await Promise.all([
      shop.products.find(handle),
      shop.products.findEnhanced(handle, { apiKey: "test-key", updatedAt }),
    ]);

    expect(base).not.toBeNull();
    expect(enhanced).not.toBeNull();
    if (!base || !enhanced) return;

    expectCoreProductFieldsMatch(enhanced.product, base);
  });

  test("minimal.findEnhanced.product matches minimal.find() response", async () => {
    const shop = new ShopClient(baseUrl);
    const [base, enhanced] = await Promise.all([
      shop.products.minimal.find(handle),
      shop.products.minimal.findEnhanced(handle, { apiKey: "test-key", updatedAt }),
    ]);

    expect(base).not.toBeNull();
    expect(enhanced).not.toBeNull();
    if (!base || !enhanced) return;

    expect(enhanced.product).toEqual(base);
  });
});
