import { toJsonLdEntries } from "../client/get-info";

describe("toJsonLdEntries", () => {
  test("flattens a top-level array block into individual entries", () => {
    // A single ld+json block holding an array is valid and common; each
    // descriptor must surface separately rather than being dropped.
    const parsed = [[{ "@type": "Organization" }, { "@type": "WebSite" }]];
    expect(toJsonLdEntries(parsed)).toEqual([
      { "@type": "Organization" },
      { "@type": "WebSite" },
    ]);
  });

  test("keeps plain object blocks unchanged", () => {
    const parsed = [{ "@type": "Product", name: "Dress" }];
    expect(toJsonLdEntries(parsed)).toEqual([
      { "@type": "Product", name: "Dress" },
    ]);
  });

  test("mixes array and object blocks in source order", () => {
    const parsed = [
      { "@type": "Organization" },
      [{ "@type": "BreadcrumbList" }, { "@type": "Product" }],
      { "@type": "WebSite" },
    ];
    expect(toJsonLdEntries(parsed).map((e) => e["@type"])).toEqual([
      "Organization",
      "BreadcrumbList",
      "Product",
      "WebSite",
    ]);
  });

  test("discards non-object values", () => {
    const parsed = [null, undefined, "a string", 42, { "@type": "Product" }];
    expect(toJsonLdEntries(parsed)).toEqual([{ "@type": "Product" }]);
  });

  test("discards non-object values nested inside an array block", () => {
    const parsed = [[{ "@type": "Product" }, "junk", null]];
    expect(toJsonLdEntries(parsed)).toEqual([{ "@type": "Product" }]);
  });

  test("returns an empty list when there is nothing usable", () => {
    expect(toJsonLdEntries([])).toEqual([]);
    expect(toJsonLdEntries([null, "x"])).toEqual([]);
  });
});
