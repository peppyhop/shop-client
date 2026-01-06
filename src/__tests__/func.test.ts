import {
  buildVariantKey,
  buildVariantOptionsMap,
  calculateDiscount,
  extractDomainWithoutSuffix,
  generateStoreSlug,
  genProductSlug,
  normalizeKey,
  safeParseDate,
  sanitizeDomain,
} from "../utils/func";

describe("Utility Functions", () => {
  describe("generateStoreSlug", () => {
    test("should generate slug from https URL", () => {
      expect(generateStoreSlug("https://example.com")).toBe("example");
      expect(generateStoreSlug("https://my-store.com")).toBe("my-store");
      expect(generateStoreSlug("https://anuki.in")).toBe("anuki");
    });

    test("should generate slug from https URL with trailing slash", () => {
      expect(generateStoreSlug("https://example.com/")).toBe("example");
      expect(generateStoreSlug("https://my-store.com/")).toBe("my-store");
    });

    test("should generate slug from http URL", () => {
      expect(generateStoreSlug("http://example.com")).toBe("example");
      expect(generateStoreSlug("http://my-store.com")).toBe("my-store");
    });

    test("should generate slug from URL with subdomain", () => {
      expect(generateStoreSlug("https://shop.example.com")).toBe("example");
      expect(generateStoreSlug("https://store.mycompany.co.uk")).toBe(
        "mycompany"
      );
    });

    test("should generate slug from myshopify domain", () => {
      expect(generateStoreSlug("https://mystore.myshopify.com")).toBe(
        "myshopify"
      );
      expect(generateStoreSlug("https://awesome-shop.myshopify.com")).toBe(
        "myshopify"
      );
    });

    test("should handle complex domain names", () => {
      expect(generateStoreSlug("https://my-awesome-store123.com")).toBe(
        "my-awesome-store123"
      );
      expect(generateStoreSlug("https://store_with_underscores.com")).toBe(
        "store-with-underscores"
      );
    });

    test("should handle URLs with paths", () => {
      expect(generateStoreSlug("https://example.com/some/path")).toBe(
        "example"
      );
      expect(generateStoreSlug("https://my-store.com/products")).toBe(
        "my-store"
      );
    });

    test("should handle URLs with query parameters", () => {
      expect(generateStoreSlug("https://example.com?param=value")).toBe(
        "example"
      );
      expect(generateStoreSlug("https://my-store.com/?utm_source=test")).toBe(
        "my-store"
      );
    });

    test("should throw error for invalid URLs", () => {
      expect(() => generateStoreSlug("invalid-url")).toThrow();
      expect(() => generateStoreSlug("not-a-url")).toThrow();
      expect(() => generateStoreSlug("://missing-protocol")).toThrow();
    });

    test("should throw error for undefined/null/empty values", () => {
      expect(() => generateStoreSlug(undefined as any)).toThrow();
      expect(() => generateStoreSlug(null as any)).toThrow();
      expect(() => generateStoreSlug("")).toThrow();
      expect(() => generateStoreSlug("   ")).toThrow();
    });

    test("should normalize special characters", () => {
      expect(generateStoreSlug("https://café-store.com")).toBe(
        "xn-caf-store-d4a"
      );
      expect(generateStoreSlug("https://store@example.com")).toBe("example");
    });

    test("should remove consecutive dashes", () => {
      expect(generateStoreSlug("https://my---store.com")).toBe("my-store");
      expect(generateStoreSlug("https://store--with--dashes.com")).toBe(
        "store-with-dashes"
      );
    });

    test("should remove leading and trailing dashes", () => {
      expect(generateStoreSlug("https://-store-.com")).toBe("store");
      expect(generateStoreSlug("https://--store--.com")).toBe("store");
    });
  });

  describe("extractDomainWithoutSuffix", () => {
    test("should extract domain without suffix", () => {
      expect(extractDomainWithoutSuffix("https://example.com")).toBe("example");
      expect(extractDomainWithoutSuffix("https://my-store.co.uk")).toBe(
        "my-store"
      );
      expect(extractDomainWithoutSuffix("https://shop.example.org")).toBe(
        "example"
      );
    });

    test("should handle complex domains", () => {
      expect(extractDomainWithoutSuffix("https://subdomain.example.com")).toBe(
        "example"
      );
      expect(extractDomainWithoutSuffix("https://store.mycompany.co.uk")).toBe(
        "mycompany"
      );
    });
  });

  describe("genProductSlug", () => {
    test("should generate product slug with store slug", () => {
      const result = genProductSlug({
        handle: "awesome-product",
        storeDomain: "https://example.com",
      });
      expect(result).toBe("awesome-product-by-example");
    });

    test("should handle complex product handles", () => {
      const result = genProductSlug({
        handle: "my-awesome-product-123",
        storeDomain: "https://my-store.myshopify.com",
      });
      expect(result).toBe("my-awesome-product-123-by-myshopify");
    });

    test("should work with different store domains", () => {
      const result = genProductSlug({
        handle: "product",
        storeDomain: "https://shop.example.co.uk",
      });
      expect(result).toBe("product-by-example");
    });
  });

  describe("calculateDiscount", () => {
    test("should calculate discount percentage correctly", () => {
      expect(calculateDiscount(80, 100)).toBe(20);
      expect(calculateDiscount(75, 100)).toBe(25);
      expect(calculateDiscount(50, 100)).toBe(50);
    });

    test("should return 0 when no compare price", () => {
      expect(calculateDiscount(100)).toBe(0);
      expect(calculateDiscount(100, undefined)).toBe(0);
      expect(calculateDiscount(100, 0)).toBe(0);
    });

    test("should return 0 when price equals compare price", () => {
      expect(calculateDiscount(100, 100)).toBe(0);
    });

    test("should handle edge cases", () => {
      expect(calculateDiscount(0, 100)).toBe(100);
      expect(calculateDiscount(1, 100)).toBe(99);
    });

    test("should return 0 for negative discounts", () => {
      expect(calculateDiscount(120, 100)).toBe(0);
      expect(calculateDiscount(150, 100)).toBe(0);
    });

    test("should round discount to nearest integer", () => {
      expect(calculateDiscount(33.33, 100)).toBe(67);
      expect(calculateDiscount(66.67, 100)).toBe(33);
    });
  });

  describe("sanitizeDomain", () => {
    test("normalizes full URLs to domain", () => {
      expect(sanitizeDomain("https://WWW.Example.com/path?x=1#top")).toBe(
        "example.com"
      );
      expect(sanitizeDomain("http://sub.example.co.uk/something")).toBe(
        "example.co.uk"
      );
      expect(sanitizeDomain("https://example.com/")).toBe("example.com");
    });

    test("handles protocol-relative and bare hostnames", () => {
      expect(sanitizeDomain("//Example.com")).toBe("example.com");
      expect(sanitizeDomain("www.example.com")).toBe("example.com");
      expect(sanitizeDomain("EXAMPLE.CO.UK")).toBe("example.co.uk");
      expect(sanitizeDomain("example.com/")).toBe("example.com");
    });

    test("strips ports, paths, query and fragments", () => {
      expect(sanitizeDomain("example.com:8080")).toBe("example.com");
      expect(sanitizeDomain("example.com/path/to#frag")).toBe("example.com");
      expect(sanitizeDomain("example.com?utm=1")).toBe("example.com");
      expect(sanitizeDomain("www.example.com/?q=1")).toBe("example.com");
    });

    test("respects stripWWW option", () => {
      expect(sanitizeDomain("www.example.com", { stripWWW: false })).toBe(
        "www.example.com"
      );
      expect(sanitizeDomain("www.example.com/", { stripWWW: false })).toBe(
        "www.example.com"
      );
    });

    test("throws for empty input", () => {
      expect(() => sanitizeDomain("" )) .toThrow();
      expect(() => sanitizeDomain("   ")).toThrow();
      expect(() => sanitizeDomain(undefined as any)).toThrow();
    });

    test("throws for bare hostnames without suffix", () => {
      expect(() => sanitizeDomain("example")).toThrow();
      expect(() => sanitizeDomain("www.example", { stripWWW: false })).toThrow();
    });
  });

  describe("safeParseDate", () => {
    test("returns a valid Date for ISO strings", () => {
      const d = safeParseDate("2020-01-01T00:00:00Z");
      expect(d).toBeInstanceOf(Date);
      expect(d?.toISOString()).toBe("2020-01-01T00:00:00.000Z");
    });

    test("returns undefined for invalid strings", () => {
      expect(safeParseDate("not-a-date")).toBeUndefined();
      expect(safeParseDate("")).toBeUndefined();
      expect(safeParseDate(undefined)).toBeUndefined();
      expect(safeParseDate(null)).toBeUndefined();
    });

    test("handles non-ISO but parseable dates", () => {
      const d = safeParseDate("Jan 2, 2021");
      expect(d).toBeInstanceOf(Date);
      expect(Number.isNaN(d!.getTime())).toBe(false);
    });
  });

  describe("normalizeKey", () => {
    test("lowercases and replaces spaces with underscores", () => {
      expect(normalizeKey("XL")).toBe("xl");
      expect(normalizeKey("Light Blue")).toBe("light_blue");
      // normalizeKey collapses multiple spaces into a single underscore
      expect(normalizeKey("  Mix  ed  ")).toBe("_mix_ed_");
    });

    test("normalizes non-alphanumeric separators to underscores", () => {
      expect(normalizeKey("Light-Blue")).toBe("light_blue");
      expect(normalizeKey("Blue/Green")).toBe("blue_green");
    });

    test("removes non-ascii characters", () => {
      expect(normalizeKey("Crème Brûlée")).toBe("creme_brulee");
      expect(normalizeKey("Größe")).toBe("grosse");
    });

    test("handles currency symbols", () => {
      expect(normalizeKey("₹100")).toBe("_100");
      expect(normalizeKey("€ 1,000")).toBe("_1_000");
      expect(normalizeKey("$100")).toBe("_100");
    });
  });

  describe("buildVariantOptionsMap", () => {
    test("builds keys for two options and maps IDs", () => {
      const optionNames = ["Size", "Color"]; // option3 omitted
      const variants = [
        { id: 1, option1: "XL", option2: "Blue", option3: null },
        { id: 2, option1: "XL", option2: "Red", option3: null },
        { id: 3, option1: "L", option2: "Blue", option3: null },
      ];

      const map = buildVariantOptionsMap(optionNames, variants);
      expect(map).toEqual({
        "color__blue____size__xl": "1",
        "color__red____size__xl": "2",
        "color__blue____size__l": "3",
      });
    });

    test("handles single-option variants and aggregates duplicates", () => {
      const optionNames = ["Size"]; // only one option
      const variants = [
        { id: 10, option1: "XL", option2: null, option3: null },
        { id: 11, option1: "XL", option2: null, option3: null },
        { id: 12, option1: "L", option2: null, option3: null },
      ];

      const map = buildVariantOptionsMap(optionNames, variants);
      expect(map).toEqual({
        // first-write wins, duplicates are ignored
        "size__xl": "10",
        "size__l": "12",
      });
    });

    test("includes third option when present", () => {
      const optionNames = ["Size", "Color", "Material"]; // three options
      const variants = [
        { id: 21, option1: "M", option2: "Blue", option3: "Cotton" },
      ];

      const map = buildVariantOptionsMap(optionNames, variants);
      expect(map).toEqual({
        "color__blue____material__cotton____size__m": "21",
      });
    });
  });

  describe("buildVariantKey", () => {
    test("builds key for two options and sorts alphabetically", () => {
      const key = buildVariantKey({ Size: "XL", Color: "Blue" });
      expect(key).toBe("color__blue____size__xl");
    });

    test("handles single option", () => {
      const key = buildVariantKey({ Size: "XL" });
      expect(key).toBe("size__xl");
    });

    test("includes third option and normalizes values", () => {
      const key = buildVariantKey({ Size: "M", Color: "Blue", Material: "Cotton" });
      expect(key).toBe("color__blue____material__cotton____size__m");
    });

    test("ignores null/undefined values and returns empty for none", () => {
      expect(buildVariantKey({ Size: null, Color: undefined })).toBe("");
    });
  });
});
