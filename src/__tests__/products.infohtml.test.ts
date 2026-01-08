import { ShopClient } from "../index";

describe("products.infoHtml", () => {
  const domain = "examplestore.com";
  const handle = "test-product";
  const htmlContent = '<html><body><section id="shopify-section-template--main__main"><h1>Product Title</h1><p>Description</p></section></body></html>';
  const expectedExtracted = '<section id="shopify-section-template--main__main"><h1>Product Title</h1><p>Description</p></section>';
  const seoHtmlContent = `<!doctype html>
    <html>
      <head>
        <title>Fallback Title</title>
        <link rel="canonical" href="https://${domain}/products/${handle}">
        <meta name="description" content="SEO description">
        <meta property="og:title" content="OG product title">
        <meta property="og:site_name" content="Example Store">
        <meta property="og:url" content="https://${domain}/products/${handle}">
        <meta property="og:type" content="product">
        <meta property="og:description" content="OG description">
        <meta property="og:image" content="https://cdn.example.com/p.png">
        <meta name="twitter:card" content="summary_large_image">
        <meta name="twitter:title" content="Twitter title">
        <meta name="twitter:description" content="Twitter description">
        <meta name="shopify-digital-wallet" content="/123456/digital_wallets/dialog">
      </head>
      <body></body>
    </html>`;

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  test("fetches and extracts main section HTML", async () => {
    (global as any).fetch = jest.fn(async (input: any) => {
      const url = typeof input === "string" ? input : input?.url ?? "";
      // Mock product JSON for find()
      if (url.includes(`/products/${handle}.js`)) {
        return {
          ok: true,
          json: async () => ({
            id: 12345,
            handle,
            title: "Test Product",
            options: [],
            variants: [],
            images: [],
          }),
        } as any;
      }
      // Mock product page HTML
      if (url.includes(`/products/${handle}`)) {
        return { ok: true, text: async () => htmlContent } as any;
      }
      return { ok: false, status: 404 } as any;
    });

    const shop = new ShopClient(`https://${domain}`);
    const result = await shop.products.infoHtml(handle);
    expect(result).toBe(expectedExtracted);
  });

  test("returns null if section not found", async () => {
    (global as any).fetch = jest.fn(async (input: any) => {
      const url = typeof input === "string" ? input : input?.url ?? "";
      // Mock product JSON for find()
      if (url.includes(`/products/${handle}.js`)) {
        return {
          ok: true,
          json: async () => ({
            id: 12345,
            handle,
            title: "Test Product",
            options: [],
            variants: [],
            images: [],
          }),
        } as any;
      }
      if (url.includes(`/products/${handle}`)) {
        return { ok: true, text: async () => "<html><body>No matching section</body></html>" } as any;
      }
      return { ok: false, status: 404 } as any;
    });

    const shop = new ShopClient(`https://${domain}`);
    const result = await shop.products.infoHtml(handle);
    expect(result).toBeNull();
  });

  test("uses provided content instead of fetching", async () => {
    const fetchSpy = jest.fn();
    (global as any).fetch = fetchSpy;

    const shop = new ShopClient(`https://${domain}`);
    const result = await shop.products.infoHtml(handle, htmlContent);
    expect(result).toBe(expectedExtracted);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("getSeo fetches product page and returns parsed EnhancedProductSeo", async () => {
    (global as any).fetch = jest.fn(async (input: any) => {
      const url = typeof input === "string" ? input : input?.url ?? "";
      if (url.includes(`/products/${handle}.js`)) {
        return {
          ok: true,
          json: async () => ({
            id: 12345,
            handle,
            title: "Test Product",
            options: [],
            variants: [],
            images: [],
          }),
        } as any;
      }
      if (url.includes(`/products/${handle}`)) {
        return {
          ok: true,
          url,
          text: async () => seoHtmlContent,
        } as any;
      }
      return { ok: false, status: 404 } as any;
    });

    const shop = new ShopClient(`https://${domain}`);
    const seo = await shop.products.getSeo(handle);
    expect(seo.title).toBe("OG product title");
    expect(seo.description).toBe("SEO description");
    expect(seo.canonical).toBe(`https://${domain}/products/${handle}`);
    expect(seo.openGraph["og:type"]).toBe("product");
  });
});
