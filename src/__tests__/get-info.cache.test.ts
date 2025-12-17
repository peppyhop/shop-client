import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { ShopClient } from "../index";

function makeHtml(name: string): string {
  return `<!doctype html>
    <html>
      <head>
        <meta name="og:site_name" content="${name}">
        <meta name="description" content="A great store">
        <meta property="og:image" content="https://cdn.example.com/logo.png">
        <meta name="shopify-digital-wallet" content="/123456/digital_wallets/dialog">
      </head>
      <body>
        <h1>${name}</h1>
      </body>
    </html>`;
}

describe("getInfo() caching and concurrency", () => {
  let originalFetch: typeof fetch;
  let fetchCount: number;
  let delayMs: number;
  let failureMode: "ok" | "httpError" | "networkError";

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    fetchCount = 0;
    delayMs = 0;
    failureMode = "ok";

    // Assign via safe cast to avoid type mismatch with Bun's fetch (which has extra properties)
    (globalThis as any).fetch = async (_input: RequestInfo | URL) => {
      fetchCount += 1;
      if (delayMs > 0) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
      if (failureMode === "httpError") {
        return new Response("error", { status: 500, statusText: "Internal Server Error" });
      }
      if (failureMode === "networkError") {
        throw new Error("Network error");
      }
      const html = makeHtml(`Example ${fetchCount}`);
      return new Response(html, { status: 200 });
    };
  });

  afterEach(() => {
    (globalThis as any).fetch = originalFetch;
  });

  test("returns cached info when fresh and does not refetch", async () => {
    const shop = new ShopClient("https://example.com");

    const info1 = await shop.getInfo();
    const info2 = await shop.getInfo();

    expect(fetchCount).toBe(1);
    expect(info2).toBe(info1); // same cached instance
    expect(info1.name).toBe("Example 1");
  });

  test("refetches after TTL expiry", async () => {
    const shop = new ShopClient("https://example.com", { cacheTTL: 10 }); // 10ms TTL for test

    const info1 = await shop.getInfo();
    await new Promise((r) => setTimeout(r, 20));
    const info2 = await shop.getInfo();

    expect(fetchCount).toBe(2);
    expect(info1.name).toBe("Example 1");
    expect(info2.name).toBe("Example 2");
    expect(info2).not.toBe(info1);
  });

  test("dedupes concurrent in-flight calls", async () => {
    const shop = new ShopClient("https://example.com");
    delayMs = 50; // make the first fetch slow to create in-flight window

    const [a, b, c] = await Promise.all([
      shop.getInfo(),
      shop.getInfo(),
      shop.getInfo(),
    ]);

    expect(fetchCount).toBe(1);
    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(a.name).toBe("Example 1");

    // Subsequent call should hit cache (still fresh)
    const d = await shop.getInfo();
    expect(fetchCount).toBe(1);
    expect(d).toBe(a);
  });

  test("surfaces enriched error context on non-ok response", async () => {
    const shop = new ShopClient("https://example.com");
    failureMode = "httpError";

    try {
      await shop.getInfo();
      throw new Error("Expected getInfo() to throw");
    } catch (err) {
      const message = (err as Error).message;
      expect(message).toContain("Error fetching store info");
      expect(message).toContain("URL: https://example.com/");
      // Message comes from enhanced error wrapping a thrown Error without statusCode
      expect(message).toContain("HTTP error! status: 500");
    }
  });

  test("manual invalidation forces refetch within TTL", async () => {
    const originalFetch = globalThis.fetch;
    let callCount = 0;
    const html = `<!doctype html>
      <html>
        <head>
          <title>Example Shop</title>
          <meta name="og:site_name" content="Example Shop" />
          <meta name="shopify-digital-wallet" content="/123456/digital_wallets/dialog">
        </head>
        <body></body>
      </html>`;
    (globalThis as any).fetch = async (_url: string | URL) => {
      callCount += 1;
      return new Response(html, { status: 200, headers: { "content-type": "text/html" } });
    };

    try {
      const shop = new ShopClient("https://exampleshop.com", { cacheTTL: 60_000 });
      const info1 = await shop.getInfo();
      expect(info1.name).toBe("Example Shop");
      expect(callCount).toBe(1);

      const info2 = await shop.getInfo();
      expect(info2.name).toBe("Example Shop");
      expect(callCount).toBe(1); // cached within TTL

      shop.clearInfoCache();

      const info3 = await shop.getInfo();
      expect(info3.name).toBe("Example Shop");
      expect(callCount).toBe(2); // refetched due to manual invalidation
    } finally {
      (globalThis as any).fetch = originalFetch;
    }
  });

  test("force option refetches within TTL without manual invalidation", async () => {
    const originalFetch = globalThis.fetch;
    let callCount = 0;
    const htmlA = makeHtml("Forced A");
    const htmlB = makeHtml("Forced B");
    (globalThis as any).fetch = async (_url: string | URL) => {
      callCount += 1;
      const html = callCount === 1 ? htmlA : htmlB;
      return new Response(html, { status: 200, headers: { "content-type": "text/html" } });
    };

    try {
      const shop = new ShopClient("https://force.example.com", { cacheTTL: 60_000 });
      const info1 = await shop.getInfo();
      expect(info1.name).toBe("Forced A");
      expect(callCount).toBe(1);

      // Within TTL, normal call hits cache
      const info2 = await shop.getInfo();
      expect(info2.name).toBe("Forced A");
      expect(callCount).toBe(1);

      // Force a refetch without clearing cache manually
      const info3 = await shop.getInfo({ force: true });
      expect(info3.name).toBe("Forced B");
      expect(callCount).toBe(2);
    } finally {
      (globalThis as any).fetch = originalFetch;
    }
  });

  test("dedupes concurrent normal and forced calls when cache is stale", async () => {
    const originalFetch = globalThis.fetch;
    let callCount = 0;
    (globalThis as any).fetch = async (_url: string | URL) => {
      callCount += 1;
      const html = makeHtml(`Concurrent ${callCount}`);
      return new Response(html, { status: 200, headers: { "content-type": "text/html" } });
    };

    try {
      const shop = new ShopClient("https://concurrent.example.com", { cacheTTL: 10 });
      const first = await shop.getInfo();
      expect(first.name).toBe("Concurrent 1");
      expect(callCount).toBe(1);

      // Expire TTL to make cache stale
      await new Promise((r) => setTimeout(r, 20));
      // Create an in-flight window to assert deduping
      delayMs = 50;

      const [normal, forced] = await Promise.all([
        shop.getInfo(),
        shop.getInfo({ force: true }),
      ]);

      // Only one additional fetch should occur for the concurrent calls
      expect(callCount).toBe(2);
      expect(normal).toBe(forced);
      expect(normal.name).toBe("Concurrent 2");
    } finally {
      (globalThis as any).fetch = originalFetch;
      delayMs = 0;
    }
  });
});
