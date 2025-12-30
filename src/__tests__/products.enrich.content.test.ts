import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { ShopClient } from "../index";

describe("Products Enrich Content", () => {
  const domain = "test-shop.myshopify.com";
  const handle = "test-product";
  const providedContent = "<html><body><div id='shopify-section-template--main'><h1>Provided Content</h1></div></body></html>";
  const ajaxResponse = {
    id: 123,
    title: "Test Product",
    handle: handle,
    description: "Original Description",
    vendor: "Test Vendor",
    variants: [],
    images: [],
    options: [],
  };

  // Mock fetch
  const mockFetch = jest.fn() as unknown as jest.MockedFunction<typeof fetch>;
  (global as any).fetch = mockFetch;

  beforeEach(() => {
    mockFetch.mockReset();
    // Default mock implementation
    mockFetch.mockImplementation((async (input: any) => {
      const url = typeof input === "string" ? input : input?.url ?? "";
      
      // AJAX product request
      if (url.includes(`/products/${handle}.js`)) {
        return {
          ok: true,
          json: async () => ajaxResponse,
        } as any;
      }

      // Product page request (should not be called if content provided)
      if (url.endsWith(`/products/${handle}`)) {
        return {
          ok: true,
          text: async () => "<html>Original Page Content</html>",
        } as any;
      }
      
      // OpenRouter mock
      if (url.includes("openrouter.ai")) {
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: JSON.stringify({ 
              title: "Mocked Title",
              description: "Mocked LLM Response",
              category: "Mocked Category",
              vertical: "clothing",
              audience: "generic",
              occasion: "casual",
              brand: "MockBrand",
              color: "blue",
              material: "cotton",
              pattern: "solid",
              season: "summer",
              style: "basic",
              type: "shirt",
              price_range: "medium",
              tags: ["mock"],
              sentiment: "positive"
            }) } }],
          }),
        } as any;
      }

      return { ok: false, status: 404 } as any;
    }) as any);
  });

  test("enriched() uses provided content and skips page fetch", async () => {
    const shop = new ShopClient(`https://${domain}`, {
      openRouter: { apiKey: "test-key", offline: false },
    });

    const result = await shop.products.enriched(handle, {
      content: providedContent,
      inputType: "html",
    });

    expect(result).toBeDefined();
    // Verify AJAX was called
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining(`/products/${handle}.js`),
      expect.anything()
    );
    // Verify OpenRouter was called with provided content
    const openRouterCall = mockFetch.mock.calls.find(call => 
      call[0].toString().includes("openrouter.ai")
    );
    expect(openRouterCall).toBeDefined();
    const body = JSON.parse(openRouterCall![1]?.body as string);
    const messages = body.messages;
    const userMessage = messages.find((m: any) => m.role === "user").content;
    expect(userMessage).toContain("Provided Content");
    expect(userMessage).not.toContain("Original Page Content");
    // Verify fetch call count (1 for AJAX + maybe 0 for LLM if offline)
    // If offline=true, it mocks response without fetch.
  });

  test("classify() uses provided content and skips page fetch", async () => {
    const shop = new ShopClient(`https://${domain}`, {
      openRouter: { apiKey: "test-key", offline: false },
    });

    const result = await shop.products.classify(handle, {
      content: providedContent,
    });

    expect(result).toBeDefined();
    // Verify AJAX was called
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining(`/products/${handle}.js`),
      expect.anything()
    );
    
    // Verify OpenRouter was called with provided content
    // Note: classify calls enriched() internally first (to get content), then classifyProduct()
    // enriched() calls OpenRouter (1st call)
    // classifyProduct() calls OpenRouter (2nd call)
    
    const openRouterCalls = mockFetch.mock.calls.filter(call => 
      call[0].toString().includes("openrouter.ai")
    );
    expect(openRouterCalls.length).toBeGreaterThanOrEqual(1);
    
    // Check the first call (enrichment)
    const body1 = JSON.parse(openRouterCalls[0][1]?.body as string);
    const userMessage1 = body1.messages.find((m: any) => m.role === "user").content;
    expect(userMessage1).toContain("Provided Content");
    expect(userMessage1).not.toContain("Original Page Content");
  });

  test("enrichedPrompts() uses provided content", async () => {
    const shop = new ShopClient(`https://${domain}`);

    const result = await shop.products.enrichedPrompts(handle, {
      content: providedContent,
      inputType: "html",
    });

    expect(result).toBeDefined();
    expect(result.user).toContain("Provided Content");
    expect(result.user).not.toContain("Original Page Content");
  });

  test("classifyPrompts() uses provided content", async () => {
    const shop = new ShopClient(`https://${domain}`);

    const result = await shop.products.classifyPrompts(handle, {
      content: providedContent,
      inputType: "html",
    });

    expect(result).toBeDefined();
    expect(result.user).toContain("Provided Content");
    expect(result.user).not.toContain("Original Page Content");
  });
});
