import { ShopClient } from "../index";

jest.mock("../utils/detect-country", () => ({
  detectShopCountry: jest.fn(async () => ({
    country: "US",
    currencyCode: "USD",
    confidence: 1,
    signals: ["Shopify.currency.active"],
  })),
}));

describe("products.predictiveSearch hides unavailable and fetches via find", () => {
  const baseUrl = "https://examplestore.com/";

  beforeEach(() => {
    const mockFetch = jest.fn(async (input: any) => {
      const url = typeof input === "string" ? input : input?.url ?? "";
      // getInfo HTML
      if (url === baseUrl) {
        return {
          ok: true,
          text: async () =>
            '<html><meta name="shopify-digital-wallet" content="/123456/digital_wallets/dialog"></html>',
        } as any;
      }
      // Predictive search response (locale-aware)
      if (url.startsWith(`${baseUrl}en/search/suggest.json`)) {
        return {
          ok: true,
          json: async () => ({
            resources: {
              results: {
                products: [
                  {
                    id: 1,
                    handle: "available-prod",
                    title: "Available",
                    body: "desc",
                    created_at: "2024-01-01T00:00:00Z",
                    updated_at: "2024-01-01T00:00:00Z",
                    vendor: "Vendor",
                    tags: [],
                    options: [],
                    variants: [],
                    images: [],
                    featured_image: null,
                    url: `${baseUrl}products/available-prod`,
                    type: "Type",
                    published_at: "2024-01-01T00:00:00Z",
                    available: true,
                    price: 1000,
                    price_min: 1000,
                    price_max: 1000,
                    price_varies: false,
                    compare_at_price: 0,
                    compare_at_price_min: 0,
                    compare_at_price_max: 0,
                    compare_at_price_varies: false,
                  },
                  {
                    id: 2,
                    handle: "unavailable-prod",
                    title: "Unavailable",
                    body: "desc",
                    created_at: "2024-01-01T00:00:00Z",
                    updated_at: "2024-01-01T00:00:00Z",
                    vendor: "Vendor",
                    tags: [],
                    options: [],
                    variants: [],
                    images: [],
                    featured_image: null,
                    url: `${baseUrl}products/unavailable-prod`,
                    type: "Type",
                    published_at: "2024-01-01T00:00:00Z",
                    available: false,
                    price: 1000,
                    price_min: 1000,
                    price_max: 1000,
                    price_varies: false,
                    compare_at_price: 0,
                    compare_at_price_min: 0,
                    compare_at_price_max: 0,
                    compare_at_price_varies: false,
                  },
                ],
              },
            },
          }),
        } as any;
      }
      // Single product JSON fetch via find() for available handle
      if (url === `${baseUrl}products/available-prod.js`) {
        return {
          ok: true,
          json: async () => ({
            id: 1,
            handle: "available-prod",
            title: "Available",
            description: "desc",
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
            vendor: "Vendor",
            tags: [],
            options: [],
            published_at: "2024-01-01T00:00:00Z",
            type: "Type",
            available: true,
            price: 1000,
            price_min: 1000,
            price_max: 1000,
            price_varies: false,
            compare_at_price: 0,
            compare_at_price_min: 0,
            compare_at_price_max: 0,
            compare_at_price_varies: false,
            variants: [],
            images: [],
            featured_image: null,
            url: `${baseUrl}products/available-prod`,
            media: [],
            requires_selling_plan: false,
            selling_plan_groups: [],
          }),
        } as any;
      }
      // Redirect resolution during find()
      if (url === `${baseUrl}products/available-prod`) {
        return {
          ok: true,
          url: `${baseUrl}products/available-prod`,
          text: async () => "<html></html>",
        } as any;
      }
      return { ok: false, status: 404, statusText: "Not Found" } as any;
    });
    (global as any).fetch = mockFetch;
  });

  test("hides unavailable items and returns full products via find()", async () => {
    const shop = new ShopClient(baseUrl);
    await shop.getInfo();
    const results = await shop.products.predictiveSearch("dress", { limit: 10, locale: "en" });
    expect(results).toBeDefined();
    expect(results.length).toBe(1);
    expect(results[0].handle).toBe("available-prod");
    expect(results[0].currency).toBe("USD");
  });
});
