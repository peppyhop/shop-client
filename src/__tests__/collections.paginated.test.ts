import { ShopClient } from "../index";
import type { ShopifyCollection } from "../types";

function makeCollection(id: number, handle: string, title: string): ShopifyCollection {
  return {
    id,
    handle,
    title,
    body_html: "",
    description: "",
    published_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    image: null as any,
    products_count: 0,
  } as any;
}

describe("collections.paginated and .all pagination behavior", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test("collections.paginated throws on invalid page < 1", async () => {
    const shop = new ShopClient("https://example.com/");
    await expect(shop.collections.paginated({ page: 0 })).rejects.toThrow(
      /Invalid pagination parameters: page must be >= 1, limit must be between 1 and 250/
    );
  });

  test("collections.paginated throws on invalid limit < 1", async () => {
    const shop = new ShopClient("https://example.com/");
    await expect(shop.collections.paginated({ limit: 0 })).rejects.toThrow(
      /Invalid pagination parameters: page must be >= 1, limit must be between 1 and 250/
    );
  });

  test("collections.paginated throws on invalid limit > 250", async () => {
    const shop = new ShopClient("https://example.com/");
    await expect(shop.collections.paginated({ limit: 251 })).rejects.toThrow(
      /Invalid pagination parameters: page must be >= 1, limit must be between 1 and 250/
    );
  });
  test("collections.paginated defaults to limit=10", async () => {
    const domain = "https://example.com/";
    const shop = new ShopClient(domain);

    const page1Collections: ShopifyCollection[] = [
      makeCollection(1, "c-1", "Collection 1"),
      makeCollection(2, "c-2", "Collection 2"),
    ];

    const originalFetch = (global as any).fetch;
    (global as any).fetch = jest.fn(async (input: any) => {
      const url = typeof input === "string" ? input : input?.url ?? "";
      if (url.includes("/collections.json") && url.includes("page=1") && url.includes("limit=10")) {
        return { ok: true, json: async () => ({ collections: page1Collections }) } as any;
      }
      return { ok: false, status: 404, statusText: "Not Found" } as any;
    });

    try {
      const result = await shop.collections.paginated();
      expect(result).not.toBeNull();
      expect(result!.length).toBe(2);

      // Ensure the request used limit=10
      const calls = (global.fetch as any).mock.calls.map((args: any[]) => args[0]);
      expect(calls.some((u: string) => typeof u === "string" && u.includes("/collections.json") && u.includes("limit=10"))).toBe(true);
    } finally {
      (global as any).fetch = originalFetch;
    }
  });

  test("collections.all iterates with limit=250", async () => {
    const domain = "https://example.com/";
    const shop = new ShopClient(domain);

    const page1: ShopifyCollection[] = Array.from({ length: 250 }, (_, i) =>
      makeCollection(i + 1, `c-${i + 1}`, `Collection ${i + 1}`)
    );
    const page2: ShopifyCollection[] = [makeCollection(251, "c-251", "Collection 251")];

    const originalFetch = (global as any).fetch;
    (global as any).fetch = jest.fn(async (input: any) => {
      const url = typeof input === "string" ? input : input?.url ?? "";
      if (url.includes("/collections.json") && url.includes("page=1") && url.includes("limit=250")) {
        return { ok: true, json: async () => ({ collections: page1 }) } as any;
      }
      if (url.includes("/collections.json") && url.includes("page=2") && url.includes("limit=250")) {
        return { ok: true, json: async () => ({ collections: page2 }) } as any;
      }
      return { ok: false, status: 404, statusText: "Not Found" } as any;
    });
    try {
      const all = await shop.collections.all();
      expect(all.length).toBe(251);

      const calls = (global.fetch as any).mock.calls.map((args: any[]) => args[0]);
      expect(calls.filter((u: string) => typeof u === "string" && u.includes("/collections.json") && u.includes("limit=250")).length).toBeGreaterThanOrEqual(2);
    } finally {
      (global as any).fetch = originalFetch;
    }
  });

  test("collections.getSeo fetches collection page and returns parsed EnhancedProductSeo", async () => {
    const domain = "https://example.com/";
    const handle = "c-1";
    const seoHtml = `<!doctype html>
      <html>
        <head>
          <link rel="canonical" href="${domain}collections/${handle}">
          <meta name="description" content="Collection SEO description">
          <meta property="og:site_name" content="Example Store">
          <meta property="og:title" content="OG collection title">
          <meta property="og:url" content="${domain}collections/${handle}">
          <meta property="og:type" content="website">
          <meta property="og:description" content="OG collection description">
          <meta name="twitter:card" content="summary">
          <meta name="twitter:title" content="Twitter collection title">
          <meta name="twitter:description" content="Twitter collection description">
          <meta name="shopify-digital-wallet" content="/123456/digital_wallets/dialog">
        </head>
        <body></body>
      </html>`;

    const shop = new ShopClient(domain);
    const originalFetch = (global as any).fetch;
    (global as any).fetch = jest.fn(async (input: any) => {
      const url = typeof input === "string" ? input : input?.url ?? "";
      if (url.includes(`/collections/${handle}`)) {
        return { ok: true, url, text: async () => seoHtml } as any;
      }
      return { ok: false, status: 404, statusText: "Not Found" } as any;
    });
    try {
      const seo = await shop.collections.getSeo(handle);
      expect(seo.title).toBe("OG collection title");
      expect(seo.description).toBe("Collection SEO description");
      expect(seo.canonical).toBe(`${domain}collections/${handle}`);
    } finally {
      (global as any).fetch = originalFetch;
    }
  });
});
