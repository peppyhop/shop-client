import { ShopClient } from "../index";

jest.mock("../utils/detect-country", () => ({
  detectShopCountry: jest.fn(async () => ({
    country: "US",
    currencyCode: "USD",
  })),
}));

describe("Handle redirect resolution", () => {
  const baseUrl = "https://examplestore.com/";

  beforeEach(() => {
    const mockFetch = jest.fn(async (input: any) => {
      const url = typeof input === "string" ? input : input?.url ?? "";

      // getInfo root HTML
      if (url === baseUrl) {
        return {
          ok: true,
          text: async () =>
            '<html><meta name="shopify-digital-wallet" content="/123456/digital_wallets/dialog"></html>',
        } as any;
      }

      // Product HTML redirect: old-handle -> new-handle
      if (url === `${baseUrl}products/old-handle`) {
        return { ok: true, url: `${baseUrl}products/new-handle`, text: async () => "" } as any;
      }

      // Fetch single product JSON at new handle
      if (url === `${baseUrl}products/new-handle.js`) {
        return {
          ok: true,
          json: async () => ({
            id: 100,
            handle: "new-handle",
            title: "Redirected Product",
            available: true,
            price: 1000,
            price_min: 1000,
            price_max: 1000,
            price_varies: false,
            compare_at_price: 0,
            compare_at_price_min: 0,
            compare_at_price_max: 0,
            compare_at_price_varies: false,
            options: [{ name: "Size", position: 1, values: ["One"] }],
            description: "desc",
            type: "Type",
            tags: ["t"],
            vendor: "Vendor",
            featured_image: "https://cdn.example.com/p.jpg",
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
            variants: [
              {
                id: 101,
                title: "Default",
                option1: "One",
                option2: null,
                option3: null,
                sku: "",
                requires_shipping: true,
                taxable: true,
                featured_image: null,
                available: true,
                price: 1000,
                grams: 0,
                compare_at_price: 0,
                position: 1,
                product_id: 100,
                created_at: "2024-01-01T00:00:00Z",
                updated_at: "2024-01-01T00:00:00Z",
              },
            ],
            images: ["https://cdn.example.com/p.jpg"],
            published_at: "2024-01-01T00:00:00Z",
            url: `${baseUrl}products/new-handle`,
          }),
        } as any;
      }

      // Collection HTML redirect: old-col -> new-col
      if (url === `${baseUrl}collections/old-col`) {
        return { ok: true, url: `${baseUrl}collections/new-col`, text: async () => "" } as any;
      }

      // Collection products JSON for new-col
      if (url.startsWith(`${baseUrl}collections/new-col/products.json`)) {
        return {
          ok: true,
          json: async () => ({
            products: [
              {
                id: 2,
                handle: "p1",
                title: "P1",
                body_html: "<p>Body</p>",
                vendor: "Vendor",
                product_type: "Type",
                created_at: "2024-01-01T00:00:00Z",
                updated_at: "2024-01-01T00:00:00Z",
                published_at: "2024-01-01T00:00:00Z",
                tags: [],
                images: [],
                options: [{ name: "Size", position: 1, values: ["S"] }],
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
                    price: "9.99",
                    grams: 0,
                    compare_at_price: "0.00",
                    position: 1,
                    product_id: 2,
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

  test("products.find resolves HTML redirect and uses final handle", async () => {
    const shop = new ShopClient(baseUrl);
    await shop.getInfo();

    const product = await shop.products.find("old-handle", {
      columns: { mode: "full", images: "full", options: "full" },
    });
    expect(product).not.toBeNull();
    if (!product) return;
    expect((product as any).handle).toBe("new-handle");

    // Ensure underlying JSON was fetched at new-handle
    const fetchMock = global.fetch as unknown as jest.Mock;
    const calls = (fetchMock.mock.calls as unknown as Array<any>).map((c) =>
      typeof c[0] === "string" ? c[0] : c[0]?.url
    );
    expect(calls).toContain(`${baseUrl}products/new-handle.js`);
  });

  test("collections.products.paginated resolves HTML redirect and fetches with final handle", async () => {
    const shop = new ShopClient(baseUrl);
    await shop.getInfo();

    const result = await shop.collections.products.paginated("old-col", { page: 1, limit: 1 });
    expect(result).toBeDefined();
    expect(result?.length).toBe(1);

    const fetchMock = global.fetch as unknown as jest.Mock;
    const calls = (fetchMock.mock.calls as unknown as Array<any>).map((c) =>
      typeof c[0] === "string" ? c[0] : c[0]?.url
    );
    const expectedPrefix = `${baseUrl}collections/new-col/products.json?page=1&limit=1`;
    const matched = calls.find((u) => typeof u === "string" && u.startsWith(expectedPrefix));
    expect(matched).toBeDefined();
  });
});
