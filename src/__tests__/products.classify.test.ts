import { ShopClient } from "../index";
import type { ShopifySingleProduct } from "../types";

describe("products.classify", () => {
  const domain = "examplestore.com";
  const handle = "linen-relaxed-fit-pants";

  const ajaxProduct: ShopifySingleProduct = {
    id: 1,
    title: "Linen Relaxed Fit Pants",
    handle,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-02T00:00:00Z",
    vendor: "Example",
    tags: ["linen", "relaxed"],
    options: [],
    description: "<p>100% linen pants with relaxed fit.</p>",
    published_at: "2024-01-01T00:00:00Z",
    type: "default",
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
    images: ["https://cdn.shopify.com/s/files/1/0000/0001/products/hero_1024x1024.jpg"],
    featured_image: "https://cdn.shopify.com/s/files/1/0000/0001/products/featured_large.jpg",
    url: `https://${domain}/products/${handle}`,
    media: [],
    requires_selling_plan: false,
    selling_plan_groups: [],
  } as any;

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  test("classifies product using enriched JSON -> summary -> classification", async () => {
    const mergeJson = JSON.stringify({
      title: "Linen Relaxed Fit Pants",
      description: "Breathable linen pants ideal for summer.",
      materials: ["linen"],
      care: ["machine-wash cold"],
      fit: "relaxed",
      images: null,
      returnPolicy: "30-day returns",
    });
    const classificationJson = JSON.stringify({
      audience: "generic",
      vertical: "clothing",
      category: "bottoms",
      subCategory: "pants",
    });

    (global as any).fetch = jest.fn(async (input: any, init?: any) => {
      const url = typeof input === "string" ? input : input?.url ?? "";
      // Shopify AJAX
      if (url.includes(`/products/${handle}.js`)) {
        return { ok: true, json: async () => ajaxProduct } as any;
      }
      // Product page HTML
      if (url.includes(`/products/${handle}`) && !url.endsWith(".js")) {
        return { ok: true, text: async () => "<html><section id=\"shopify-section-template--main__main\">Main</section></html>" } as any;
      }
      // OpenRouter chat completions
      if (url.includes("openrouter.ai") && init?.method === "POST") {
        const body = JSON.parse(init!.body);
        const content: string =
          body?.messages?.find((m: any) => m?.role === "user")?.content ?? "";
        // Return merge structured JSON when prompt hints at materials schema
        if (typeof content === "string" && content.includes("\"materials\"")) {
          return { ok: true, json: async () => ({ choices: [{ message: { content: mergeJson } }] }) } as any;
        }
        // Otherwise classification JSON
        return { ok: true, json: async () => ({ choices: [{ message: { content: classificationJson } }] }) } as any;
      }
      return { ok: false, status: 404, statusText: "Not Found" } as any;
    });

    const shop = new ShopClient(`https://${domain}`);
    const result = await shop.products.classify(handle, { apiKey: "test-key", model: "stub-model" });
    expect(result).toEqual({ audience: "generic", vertical: "clothing", category: "bottoms", subCategory: "pants" });
  });

  test("offline mode returns deterministic mock classification", async () => {
    (global as any).fetch = jest.fn(async (input: any) => {
      const url = typeof input === "string" ? input : input?.url ?? "";
      if (url.includes(`/products/${handle}.js`)) {
        return { ok: true, json: async () => ajaxProduct } as any;
      }
      if (url.includes(`/products/${handle}`) && !url.endsWith(".js")) {
        return { ok: true, text: async () => "<html>page</html>" } as any;
      }
      return { ok: false, status: 404 } as any;
    });

    const shop = new ShopClient(`https://${domain}`, {
      openRouter: { offline: true },
    });
    const res = await shop.products.classify(handle, { apiKey: "any" });
    expect(res).toEqual({ audience: "generic", vertical: "clothing", category: null, subCategory: null });
  });

  test("falls back to alternative model on 5xx provider error", async () => {
    const mergeJson = JSON.stringify({ title: null, description: null, materials: [], care: [], fit: null, images: null, returnPolicy: null });
    const classificationJson = JSON.stringify({ audience: "generic", vertical: "clothing", category: null, subCategory: null });

    (global as any).fetch = jest.fn(async (input: any, init?: any) => {
      const url = typeof input === "string" ? input : input?.url ?? "";
      if (url.includes(`/products/${handle}.js`)) {
        return { ok: true, json: async () => ajaxProduct } as any;
      }
      if (url.includes(`/products/${handle}`) && !url.endsWith(".js")) {
        return { ok: true, text: async () => "<html>page</html>" } as any;
      }
      if (url.includes("openrouter.ai") && init?.method === "POST") {
        const body = JSON.parse(init!.body);
        const m = body?.model;
        const content: string =
          body?.messages?.find((mm: any) => mm?.role === "user")?.content ?? "";
        // Simulate 502 on primary model to trigger fallback
        if (m === "modelA") {
          return { ok: false, status: 502, text: async () => JSON.stringify({ error: { message: "Internal server error" } }) } as any;
        }
        // For fallback or default models, return valid JSON
        if (typeof content === "string" && content.includes("\"materials\"")) {
          return { ok: true, json: async () => ({ choices: [{ message: { content: mergeJson } }] }) } as any;
        }
        return { ok: true, json: async () => ({ choices: [{ message: { content: classificationJson } }] }) } as any;
      }
      return { ok: false, status: 404 } as any;
    });

    const shop = new ShopClient(`https://${domain}`, {
      openRouter: { fallbackModels: ["modelB"], model: "modelDefault" },
    });
    const res = await shop.products.classify(handle, { apiKey: "key", model: "modelA" });
    expect(res).toEqual({ audience: "generic", vertical: "clothing", category: null, subCategory: null });
  });
});
