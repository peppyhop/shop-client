import { ShopClient } from "../index";

jest.mock("../utils/detect-country", () => ({
  detectShopCountry: jest.fn(async () => ({
    country: "US",
    currencyCode: "USD",
    confidence: 1,
    signals: ["Shopify.currency.active"],
  })),
}));

describe("getInfo returns currency along with country", () => {
  const baseUrl = "https://examplestore.com/";

  beforeEach(() => {
    const mockFetch = jest.fn(async (input: any) => {
      const url = typeof input === "string" ? input : input?.url ?? "";
      if (url === baseUrl) {
        return {
          ok: true,
          text: async () => "<html><head></head><body></body></html>",
        } as any;
      }
      return { ok: false, status: 404, statusText: "Not Found" } as any;
    });
    (global as any).fetch = mockFetch;
  });

  test("getInfo includes currency field", async () => {
    const shop = new ShopClient(baseUrl);
    const info = await shop.getInfo({ force: true });
    expect(info).toBeDefined();
    expect(info.country).toBe("US");
    expect(info.currency).toBe("USD");
  });
});

