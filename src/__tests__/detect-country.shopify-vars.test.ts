import { detectShopCountry } from "../utils/detect-country";

describe("detectShopCountry with Shopify variables", () => {
  test("detects country and currency from Shopify variables", async () => {
    const script = `
      <script>
        var Shopify = Shopify || {};
        Shopify.shop = "weareallbirds.myshopify.com";
        Shopify.locale = "en-US";
        Shopify.currency = {"active":"USD","rate":"1.0"};
        Shopify.country = "US";
        Shopify.theme = {"name":"rc-cm-2025-12-13_00-18 Update","id":128488144976,"schema_name":"allbirds-theme","schema_version":"1.119.4","theme_store_id":null,"role":"main"};
        Shopify.theme.handle = "null";
        Shopify.theme.style = {"id":null,"handle":null};
        Shopify.cdnHost = "www.allbirds.com/cdn";
        Shopify.routes = Shopify.routes || {};
        Shopify.routes.root = "/";
      </script>
    `;
    const html = `<html><head>${script}</head><body></body></html>`;
    const result = await detectShopCountry(html);
    expect(result.country).toBe("US");
    expect(result.currencyCode).toBe("USD");
    expect(result.confidence).toBeGreaterThanOrEqual(0.89);
    expect(result.signals).toEqual(
      expect.arrayContaining(["Shopify.country", "Shopify.currency.active"])
    );
  });
});

