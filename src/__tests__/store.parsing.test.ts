import { createShopOperations } from "../store";

jest.mock("../utils/detect-country", () => ({
  detectShopCountry: jest.fn(async () => ({ country: "US" })),
}));

describe("ShopOperations.info parsing", () => {
  const baseUrl = "https://examplestore.com/";

  const html = `
    <meta name="og:site_name" content="Example Store">
    <meta name="description" content="An example description">
    <meta name="shopify-digital-wallet" content="/123456/digital_wallets/dialog">
    <a href="//instagram.com/example">Instagram</a>
    <a href="https://www.twitter.com/example">Twitter</a>
    <a href="https://www.linkedin.com/company/example/">LinkedIn</a>
    <a href="/pages/contact">Contact Us</a>
    <a href="mailto:support@example.com">Email</a>
    <a href="tel:+1234567890">Call</a>
    <script type="application/ld+json">{"name":"Example"}</script>
  `;

  beforeEach(() => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => html,
    }) as unknown as Response;
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    (global.fetch as unknown as jest.Mock | undefined)?.mockReset();
  });

  test("parses social links including protocol-relative and normalizes to https", async () => {
    const ops = createShopOperations({
      baseUrl,
      storeDomain: baseUrl,
      validateProductExists: async () => true,
      validateCollectionExists: async () => true,
      validateLinksInBatches: async <T>(items: T[]) => items,
      handleFetchError: (error: unknown) => {
        throw error as Error;
      },
    });

    const info = await ops.info();
    expect(info.socialLinks).toBeDefined();
    expect(info.socialLinks.instagram).toBe("https://instagram.com/example");
    expect(info.socialLinks.twitter).toBe("https://www.twitter.com/example");
    expect(info.socialLinks.linkedin).toBe(
      "https://www.linkedin.com/company/example/"
    );
  });

  test("parses contact links for tel, mailto, and contact page", async () => {
    const ops = createShopOperations({
      baseUrl,
      storeDomain: baseUrl,
      validateProductExists: async () => true,
      validateCollectionExists: async () => true,
      validateLinksInBatches: async <T>(items: T[]) => items,
      handleFetchError: (error: unknown) => {
        throw error as Error;
      },
    });

    const info = await ops.info();
    expect(info.contactLinks.tel).toBe("+1234567890");
    expect(info.contactLinks.email).toBe("support@example.com");
    expect(info.contactLinks.contactPage).toBe("/pages/contact");
  });
});
