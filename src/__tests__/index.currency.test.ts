import { ShopClient } from "../index";

jest.mock("../utils/detect-country", () => ({
  detectShopCountry: jest.fn(async () => ({
    country: "US",
    currencyCode: "USD",
  })),
}));

describe("Currency propagation and formatting", () => {
  const baseUrl = "https://examplestore.com/";

  beforeEach(() => {
    const mockFetch = jest.fn(async (input: any) => {
      const url = typeof input === "string" ? input : input?.url ?? "";

      // getInfo root HTML
      if (url === baseUrl) {
        return {
          ok: true,
          text: async () => "<html><head></head><body></body></html>",
        } as any;
      }

      // HTML redirect resolution for product handle
      if (url === `${baseUrl}products/old-handle`) {
        return {
          ok: true,
          url: `${baseUrl}products/new-handle`,
          text: async () => "",
        } as any;
      }

      // Single product JSON for new handle
      if (url === `${baseUrl}products/new-handle.js`) {
        return {
          ok: true,
          json: async () => ({
            id: 1,
            handle: "new-handle",
            title: "Test Product",
            available: true,
            price: 12345,
            price_min: 12345,
            price_max: 12345,
            price_varies: false,
            compare_at_price: 0,
            compare_at_price_min: 0,
            compare_at_price_max: 0,
            compare_at_price_varies: false,
            options: [{ name: "Size", position: 1, values: ["S"] }],
            description: "desc",
            type: "Shirt",
            tags: ["tag1"],
            vendor: "Vendor",
            featured_image: "https://cdn.example.com/img.jpg",
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
            variants: [
              {
                id: 11,
                title: "Default",
                option1: "S",
                option2: null,
                option3: null,
                sku: "SKU",
                requires_shipping: true,
                taxable: true,
                featured_image: null,
                available: true,
                price: 12345,
                grams: 100,
                compare_at_price: 0,
                position: 1,
                product_id: 1,
                created_at: "2024-01-01T00:00:00Z",
                updated_at: "2024-01-01T00:00:00Z",
              },
            ],
            images: ["https://cdn.example.com/img.jpg"],
            published_at: "2024-01-01T00:00:00Z",
            url: `${baseUrl}products/new-handle`,
          }),
        } as any;
      }

      // HTML redirect resolution for collection handle
      if (url === `${baseUrl}collections/old-collection`) {
        return {
          ok: true,
          url: `${baseUrl}collections/new-collection`,
          text: async () => "",
        } as any;
      }

      // Collection products JSON for redirected handle
      if (url.startsWith(`${baseUrl}collections/new-collection/products.json`)) {
        return {
          ok: true,
          json: async () => ({
            products: [
              {
                id: 2,
                handle: "prod-1",
                title: "Product 1",
                body_html: "<p>Body</p>",
                vendor: "Vendor",
                product_type: "Type",
                created_at: "2024-01-01T00:00:00Z",
                updated_at: "2024-01-01T00:00:00Z",
                published_at: "2024-01-01T00:00:00Z",
                tags: ["A"],
                images: [
                  {
                    id: 21,
                    product_id: 2,
                    position: 1,
                    src: "https://cdn.example.com/prod1.jpg",
                    width: 0,
                    height: 0,
                    variant_ids: [],
                    created_at: "2024-01-01T00:00:00Z",
                    updated_at: "2024-01-01T00:00:00Z",
                  },
                ],
                options: [{ name: "Size", position: 1, values: ["S", "M"] }],
                variants: [
                  {
                    id: 201,
                    title: "S",
                    option1: "S",
                    option2: null,
                    option3: null,
                    sku: "",
                    requires_shipping: true,
                    taxable: true,
                    featured_image: null,
                    available: true,
                    price: "10.00",
                    grams: 0,
                    compare_at_price: "0.00",
                    position: 1,
                    product_id: 2,
                    created_at: "2024-01-01T00:00:00Z",
                    updated_at: "2024-01-01T00:00:00Z",
                  },
                  {
                    id: 202,
                    title: "M",
                    option1: "M",
                    option2: null,
                    option3: null,
                    sku: "",
                    requires_shipping: true,
                    taxable: true,
                    featured_image: null,
                    available: true,
                    price: "12.00",
                    grams: 0,
                    compare_at_price: "0.00",
                    position: 2,
                    product_id: 2,
                    created_at: "2024-01-01T00:00:00Z",
                    updated_at: "2024-01-01T00:00:00Z",
                  },
                ],
              },
              {
                id: 3,
                handle: "prod-2",
                title: "Product 2",
                body_html: "<p>Body</p>",
                vendor: "Vendor",
                product_type: "Type",
                created_at: "2024-01-01T00:00:00Z",
                updated_at: "2024-01-01T00:00:00Z",
                published_at: "2024-01-01T00:00:00Z",
                tags: ["B"],
                images: [
                  {
                    id: 31,
                    product_id: 3,
                    position: 1,
                    src: "https://cdn.example.com/prod2.jpg",
                    width: 0,
                    height: 0,
                    variant_ids: [],
                    created_at: "2024-01-01T00:00:00Z",
                    updated_at: "2024-01-01T00:00:00Z",
                  },
                ],
                options: [{ name: "Size", position: 1, values: ["L"] }],
                variants: [
                  {
                    id: 301,
                    title: "L",
                    option1: "L",
                    option2: null,
                    option3: null,
                    sku: "",
                    requires_shipping: true,
                    taxable: true,
                    featured_image: null,
                    available: true,
                    price: "20.00",
                    grams: 0,
                    compare_at_price: "0.00",
                    position: 1,
                    product_id: 3,
                    created_at: "2024-01-01T00:00:00Z",
                    updated_at: "2024-01-01T00:00:00Z",
                  },
                ],
              },
            ],
          }),
        } as any;
      }

      // Store-wide products JSON
      if (url.startsWith(`${baseUrl}products.json`)) {
        return {
          ok: true,
          json: async () => ({
            products: [
              {
                id: 4,
                handle: "store-prod-1",
                title: "Store Product 1",
                body_html: "<p>Body</p>",
                vendor: "Vendor",
                product_type: "Type",
                created_at: "2024-01-01T00:00:00Z",
                updated_at: "2024-01-01T00:00:00Z",
                published_at: "2024-01-01T00:00:00Z",
                tags: ["C"],
                images: [],
                options: [{ name: "Size", position: 1, values: ["S"] }],
                variants: [
                  {
                    id: 401,
                    title: "S",
                    option1: "S",
                    option2: null,
                    option3: null,
                    sku: "",
                    requires_shipping: true,
                    taxable: true,
                    featured_image: null,
                    available: true,
                    price: "15.00",
                    grams: 0,
                    compare_at_price: "0.00",
                    position: 1,
                    product_id: 4,
                    created_at: "2024-01-01T00:00:00Z",
                    updated_at: "2024-01-01T00:00:00Z",
                  },
                ],
              },
              {
                id: 5,
                handle: "store-prod-2",
                title: "Store Product 2",
                body_html: "<p>Body</p>",
                vendor: "Vendor",
                product_type: "Type",
                created_at: "2024-01-01T00:00:00Z",
                updated_at: "2024-01-01T00:00:00Z",
                published_at: "2024-01-01T00:00:00Z",
                tags: ["D"],
                images: [],
                options: [{ name: "Size", position: 1, values: ["M"] }],
                variants: [
                  {
                    id: 501,
                    title: "M",
                    option1: "M",
                    option2: null,
                    option3: null,
                    sku: "",
                    requires_shipping: true,
                    taxable: true,
                    featured_image: null,
                    available: true,
                    price: "25.00",
                    grams: 0,
                    compare_at_price: "0.00",
                    position: 1,
                    product_id: 5,
                    created_at: "2024-01-01T00:00:00Z",
                    updated_at: "2024-01-01T00:00:00Z",
                  },
                ],
              },
            ],
          }),
        } as any;
      }

      return { ok: false, status: 404, statusText: "Not Found" } as any;
    }) as unknown as typeof fetch;
    global.fetch = mockFetch;
  });

  afterEach(() => {
    (global.fetch as unknown as jest.Mock | undefined)?.mockReset();
  });

  test("products.find uses store currency and formats localized pricing", async () => {
    const shop = new ShopClient(baseUrl);
    await shop.getInfo();

    const product = await shop.products.find("old-handle");
    expect(product).not.toBeNull();
    if (!product) return;

    expect(product.currency).toBe("USD");
    expect(product.localizedPricing).toBeDefined();
    if (!product.localizedPricing) return;
    expect(product.localizedPricing.currency).toBe("USD");

    const expectedFormatted = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
    }).format(12345 / 100);
    expect(product.localizedPricing.priceFormatted).toBe(expectedFormatted);
  });

  test("collections.products.paginated uses store currency and formats localized pricing", async () => {
    const shop = new ShopClient(baseUrl);
    await shop.getInfo();

    const products = await shop.collections.products.paginated("old-collection", {
      page: 1,
      limit: 2,
    });

    expect(products).toBeDefined();
    if (!products) return;

    expect(products.length).toBe(2);
    for (const p of products) {
      expect(p.currency).toBe("USD");
      expect(p.localizedPricing).toBeDefined();
      if (!p.localizedPricing) continue;
      expect(p.localizedPricing.currency).toBe("USD");
    }

    const expectedMin = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
    }).format(10.0);
    expect(products[0].localizedPricing).toBeDefined();
    if (products[0].localizedPricing) {
      expect(products[0].localizedPricing.priceMinFormatted).toBe(expectedMin);
    }
  });

  test("products.find respects currency override and formats accordingly", async () => {
    const shop = new ShopClient(baseUrl);
    await shop.getInfo();

    const product = await shop.products.find("old-handle", { currency: "EUR" });
    expect(product).not.toBeNull();
    if (!product) return;

    expect(product.currency).toBe("EUR");
    expect(product.localizedPricing).toBeDefined();
    if (!product.localizedPricing) return;
    expect(product.localizedPricing.currency).toBe("EUR");

    const expectedFormatted = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "EUR",
    }).format(12345 / 100);
    expect(product.localizedPricing.priceFormatted).toBe(expectedFormatted);
  });

  test("collections.products.paginated respects currency override", async () => {
    const shop = new ShopClient(baseUrl);
    await shop.getInfo();

    const products = await shop.collections.products.paginated("old-collection", {
      page: 1,
      limit: 2,
      currency: "JPY",
    });

    expect(products).toBeDefined();
    if (!products) return;

    expect(products.length).toBe(2);
    for (const p of products) {
      expect(p.currency).toBe("JPY");
      expect(p.localizedPricing).toBeDefined();
      if (!p.localizedPricing) continue;
      expect(p.localizedPricing.currency).toBe("JPY");
    }

    const expectedMin = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "JPY",
    }).format(10.0);
    expect(products[0].localizedPricing).toBeDefined();
    if (products[0].localizedPricing) {
      expect(products[0].localizedPricing.priceMinFormatted).toBe(expectedMin);
    }
  });

  test("products.paginated respects currency override", async () => {
    const shop = new ShopClient(baseUrl);
    await shop.getInfo();

    const products = await shop.products.paginated({ page: 1, limit: 2, currency: "GBP" });
    expect(products).toBeDefined();
    if (!products) return;
    expect(products.length).toBe(2);
    for (const p of products) {
      expect(p.currency).toBe("GBP");
      expect(p.localizedPricing).toBeDefined();
      if (!p.localizedPricing) continue;
      expect(p.localizedPricing.currency).toBe("GBP");
    }
  });
});
