import { ShopClient } from "../index";

describe("orders (Admin API)", () => {
  const baseUrl = "https://examplestore.com/";
  const apiKey = "test-token";

  const jsonResponse = (data: unknown, status = 200): Response => {
    return new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  };

  const getHeader = (headers: unknown, name: string): string | null => {
    const lower = name.toLowerCase();
    if (headers && typeof headers === "object") {
      if (headers instanceof Headers) {
        return headers.get(name) ?? headers.get(lower);
      }
      if (Array.isArray(headers)) {
        for (const entry of headers) {
          if (!Array.isArray(entry) || entry.length < 2) continue;
          const [k, v] = entry;
          if (typeof k === "string" && k.toLowerCase() === lower) {
            return typeof v === "string" ? v : null;
          }
        }
      }
      const rec = headers as Record<string, unknown>;
      const v = rec[name] ?? rec[lower];
      return typeof v === "string" ? v : null;
    }
    return null;
  };

  beforeEach(() => {
    (global as any).fetch = jest.fn(async (input: any, init?: any) => {
      const url = typeof input === "string" ? input : input?.url ?? "";
      const method = (init?.method ?? "GET").toUpperCase();
      const token =
        getHeader(init?.headers, "X-Shopify-Access-Token") ??
        getHeader(init?.headers, "x-shopify-access-token");

      if (!token) {
        return new Response("Unauthorized", { status: 401 });
      }

      if (url === `${baseUrl}admin/api/2026-01/orders.json` && method === "POST") {
        const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
        if (!body?.order) {
          return new Response("Unprocessable Entity", { status: 422 });
        }
        return jsonResponse({ order: { id: 123, name: "#1001" } });
      }

      if (
        url === `${baseUrl}admin/api/2026-01/orders/123/cancel.json` &&
        method === "POST"
      ) {
        return jsonResponse({
          order: { id: 123, cancelled_at: "2026-01-01T00:00:00Z" },
        });
      }

      if (url.startsWith(`${baseUrl}admin/api/2026-01/orders/123.json`) && method === "GET") {
        return jsonResponse({
          order: {
            id: 123,
            name: "#1001",
            financial_status: "paid",
            fulfillment_status: null,
            cancelled_at: null,
            order_status_url: "https://examplestore.com/orders/123/status",
            fulfillments: [
              {
                id: 1,
                status: "success",
                tracking_company: "UPS",
                tracking_numbers: ["1Z"],
                tracking_urls: ["https://track.example/1Z"],
              },
            ],
          },
        });
      }

      return new Response("Not Found", { status: 404 });
    });
  });

  afterEach(() => {
    (global.fetch as unknown as jest.Mock | undefined)?.mockReset();
  });

  test("orders.create sends token and returns created order", async () => {
    const shop = new ShopClient(baseUrl);
    const order = await shop.orders.create(
      { line_items: [{ variant_id: 1, quantity: 1 }], email: "a@b.com" },
      { apiKey }
    );
    expect(order).toBeDefined();
    expect((order as any).id).toBe(123);
  });

  test("orders.cancel cancels order", async () => {
    const shop = new ShopClient(baseUrl);
    const order = await shop.orders.cancel(123, { apiKey, reason: "customer" });
    expect(order).toBeDefined();
    expect((order as any).cancelled_at).toBe("2026-01-01T00:00:00Z");
  });

  test("orders.track returns fulfillment tracking", async () => {
    const shop = new ShopClient(baseUrl);
    const tracking = await shop.orders.track(123, { apiKey });
    expect(tracking).not.toBeNull();
    if (!tracking) return;
    expect(tracking.id).toBe(123);
    expect(tracking.orderStatusUrl).toBe("https://examplestore.com/orders/123/status");
    expect(tracking.fulfillments.length).toBe(1);
    expect(tracking.fulfillments[0]?.trackingNumbers[0]).toBe("1Z");
  });
});
