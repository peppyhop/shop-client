import { unique } from "remeda";
import type { ShopInfo } from "../store";
import type { EnhancedProductSeo } from "../types";
import { detectShopCountry } from "../utils/detect-country";
import {
  extractDomainWithoutSuffix,
  generateStoreSlug,
  sanitizeDomain,
} from "../utils/func";
import { rateLimitedFetch } from "../utils/rate-limit";

function parseSeoFromHtml(html: string, url: string): EnhancedProductSeo {
  const esc = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const getMeta = (key: string) => {
    const k = esc(key);
    const regex = new RegExp(
      `<meta[^>]*(?:name|property)=["']${k}["'][^>]*content=["'](.*?)["']`,
      "i"
    );
    const match = html.match(regex);
    return match?.[1] ?? "";
  };
  const titleTag = () => {
    const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    return match?.[1]?.trim() ?? "";
  };
  const canonicalTag = () => {
    const match = html.match(
      /<link[^>]*rel=["']canonical["'][^>]*href=["'](.*?)["']/i
    );
    return match?.[1] ?? "";
  };
  const charsetTag = () => {
    const match = html.match(/<meta[^>]*charset=["']?([^"'>\s]+)["']?/i);
    return match?.[1] ?? "";
  };
  const xuaTag = () => {
    const match = html.match(
      /<meta[^>]*http-equiv=["']X-UA-Compatible["'][^>]*content=["'](.*?)["']/i
    );
    return match?.[1] ?? "";
  };

  const canonical = canonicalTag() || url;
  const description = getMeta("description") || getMeta("og:description");
  const title = getMeta("og:title") || getMeta("twitter:title") || titleTag();

  const meta = {
    charset: charsetTag(),
    "x-ua-compatible": xuaTag(),
    viewport: getMeta("viewport"),
    description,
    "og:site_name": getMeta("og:site_name"),
    "og:url": getMeta("og:url") || canonical,
    "og:title": getMeta("og:title") || title,
    "og:type": getMeta("og:type"),
    "og:description": getMeta("og:description") || description,
    "og:image": getMeta("og:image"),
    "og:image:secure_url": getMeta("og:image:secure_url"),
    "og:image:width": getMeta("og:image:width"),
    "og:image:height": getMeta("og:image:height"),
    "og:price:amount": getMeta("og:price:amount"),
    "og:price:currency": getMeta("og:price:currency"),
    "twitter:card": getMeta("twitter:card"),
    "twitter:title": getMeta("twitter:title") || title,
    "twitter:description": getMeta("twitter:description") || description,
    "shopify-digital-wallet": getMeta("shopify-digital-wallet"),
  };

  const openGraph = {
    "og:site_name": meta["og:site_name"],
    "og:url": meta["og:url"],
    "og:title": meta["og:title"],
    "og:type": meta["og:type"],
    "og:description": meta["og:description"],
    "og:image": meta["og:image"],
    "og:image:secure_url": meta["og:image:secure_url"],
    "og:image:width": meta["og:image:width"],
    "og:image:height": meta["og:image:height"],
    "og:price:amount": meta["og:price:amount"],
    "og:price:currency": meta["og:price:currency"],
  };

  const twitter = {
    "twitter:card": meta["twitter:card"],
    "twitter:title": meta["twitter:title"],
    "twitter:description": meta["twitter:description"],
  };

  const jsonLdRaw =
    html
      .match(
        /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g
      )
      ?.map((match) => match.replace(/^.*?>/, "").replace(/<\/script>$/i, ""))
      ?.map((json) => {
        try {
          return JSON.parse(json);
        } catch {
          return undefined;
        }
      })
      .filter((x) => x !== undefined) ?? [];

  const jsonLd = jsonLdRaw
    .filter((e) => e && typeof e === "object")
    .map((e: any) => ({
      "@context": e?.["@context"] ?? "",
      "@type": e?.["@type"] ?? "",
      name: e?.name ?? "",
      logo: e?.logo,
      sameAs: e?.sameAs,
      url: e?.url ?? "",
      "@id": e?.["@id"],
      brand: e?.brand,
      category: e?.category,
      description: e?.description,
      hasVariant: e?.hasVariant,
      productGroupID: e?.productGroupID,
    }))
    .filter((e) => e["@context"] && e["@type"]);

  const productJsonLd = jsonLdRaw.filter((e: any) => {
    const t = e?.["@type"];
    if (!t) return false;
    if (Array.isArray(t)) return t.includes("Product");
    return t === "Product";
  });

  const requiredKeys = [
    "description",
    "og:site_name",
    "og:url",
    "og:title",
    "og:type",
    "og:description",
    "og:image",
    "twitter:card",
    "twitter:title",
    "twitter:description",
    "shopify-digital-wallet",
  ];
  const missing = requiredKeys.filter((k) => (meta as any)[k] === "");

  return {
    title,
    description,
    canonical,
    meta,
    openGraph,
    twitter,
    jsonLd,
    jsonLdRaw,
    productJsonLd,
    missing,
  };
}

export async function getSeoForUrl(args: {
  url: string;
  rateLimitClass: string;
  timeoutMs?: number;
}): Promise<EnhancedProductSeo> {
  const response = await rateLimitedFetch(args.url, {
    rateLimitClass: args.rateLimitClass,
    timeoutMs: args.timeoutMs ?? 7000,
  });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const html = await response.text();
  return parseSeoFromHtml(html, response.url || args.url);
}

type Args = {
  baseUrl: string;
  storeDomain: string;
  validateProductExists: (handle: string) => Promise<boolean>;
  validateCollectionExists: (handle: string) => Promise<boolean>;
  validateLinksInBatches: <T>(
    items: T[],
    validator: (item: T) => Promise<boolean>,
    batchSize?: number
  ) => Promise<T[]>;
};

/**
 * Fetches comprehensive store information including metadata, social links, and showcase content.
 * Returns the structured StoreInfo and detected currency code (if available).
 */
export async function getInfoForShop(
  args: Args,
  options?: { validateShowcase?: boolean; validationBatchSize?: number }
): Promise<{ info: ShopInfo; currencyCode?: string }> {
  const {
    baseUrl,
    storeDomain,
    validateProductExists,
    validateCollectionExists,
    validateLinksInBatches,
  } = args;

  const response = await rateLimitedFetch(baseUrl, {
    rateLimitClass: "store:info",
    timeoutMs: 7000,
  });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const html = await response.text();

  const getMetaTag = (name: string) => {
    const regex = new RegExp(
      `<meta[^>]*name=["']${name}["'][^>]*content=["'](.*?)["']`
    );
    const match = html.match(regex);
    return match ? match[1] : null;
  };

  const shopifyWalletId = getMetaTag("shopify-digital-wallet")?.split("/")[1];

  const isShopifyStore =
    html.includes("cdn.shopify.com") ||
    html.includes("myshopify.com") ||
    html.includes("shopify-digital-wallet") ||
    html.includes("Shopify.shop") ||
    html.includes("Shopify.currency") ||
    html.includes("shopify-section");

  if (!isShopifyStore || !shopifyWalletId) {
    throw new Error(
      "The provided URL does not appear to be a valid Shopify store."
    );
  }

  const getPropertyMetaTag = (property: string) => {
    const regex = new RegExp(
      `<meta[^>]*property=["']${property}["'][^>]*content=["'](.*?)["']`
    );
    const match = html.match(regex);
    return match ? match[1] : null;
  };

  const name =
    getMetaTag("og:site_name") ?? extractDomainWithoutSuffix(baseUrl);
  const title = getMetaTag("og:title") ?? getMetaTag("twitter:title");
  const description =
    getMetaTag("description") || getPropertyMetaTag("og:description");

  const myShopifySubdomainMatch = html.match(/['"](.*?\.myshopify\.com)['"]/);
  const myShopifySubdomain = myShopifySubdomainMatch
    ? myShopifySubdomainMatch[1]
    : null;

  let logoUrl =
    getPropertyMetaTag("og:image") || getPropertyMetaTag("og:image:secure_url");
  if (!logoUrl) {
    const logoMatch = html.match(
      /<img[^>]+src=["']([^"']+\/cdn\/shop\/[^"']+)["']/
    );
    const matchedUrl = logoMatch?.[1];
    logoUrl = matchedUrl ? matchedUrl.replace("http://", "https://") : null;
  } else {
    logoUrl = logoUrl.replace("http://", "https://");
  }

  const socialLinks: Record<string, string> = {};
  const socialRegex =
    /<a[^>]+href=["']([^"']*(?:facebook|twitter|instagram|pinterest|youtube|linkedin|tiktok|vimeo)\.com[^"']*)["']/g;
  for (const match of html.matchAll(socialRegex)) {
    const str = match[1];
    if (!str) continue;
    let href: string = str;
    try {
      if (href.startsWith("//")) {
        href = `https:${href}`;
      } else if (href.startsWith("/")) {
        href = new URL(href, baseUrl).toString();
      }
      const parsed = new URL(href);
      const domain = parsed.hostname.replace("www.", "").split(".")[0];
      if (domain) {
        socialLinks[domain] = parsed.toString();
      }
    } catch {
      // Skip invalid URLs without failing
    }
  }

  const contactLinks = {
    tel: null as string | null,
    email: null as string | null,
    contactPage: null as string | null,
  };

  for (const match of html.matchAll(/href=["']tel:([^"']+)["']/g)) {
    contactLinks.tel = match?.[1]?.trim() || null;
  }
  for (const match of html.matchAll(/href=["']mailto:([^"']+)["']/g)) {
    contactLinks.email = match?.[1]?.trim() || null;
  }
  for (const match of html.matchAll(
    /href=["']([^"']*(?:\/contact|\/pages\/contact)[^"']*)["']/g
  )) {
    contactLinks.contactPage = match?.[1] || null;
  }

  const extractedProductLinks = unique(
    html
      .match(/href=["']([^"']*\/products\/[^"']+)["']/g)
      ?.map((match) =>
        match?.split("href=")[1]?.replace(/["']/g, "")?.split("/").at(-1)
      )
      ?.filter(Boolean) || []
  ).slice(0, 8);

  const extractedCollectionLinks = unique(
    html
      .match(/href=["']([^"']*\/collections\/[^"']+)["']/g)
      ?.map((match) =>
        match?.split("href=")[1]?.replace(/["']/g, "")?.split("/").at(-1)
      )
      ?.filter(Boolean) || []
  ).slice(0, 8);

  const headerLinks =
    html
      .match(
        /<(header|nav|div|section)\b[^>]*\b(?:id|class)=["'][^"']*(?=.*shopify-section)(?=.*\b(header|navigation|nav|menu)\b)[^"']*["'][^>]*>[\s\S]*?<\/\1>/gi
      )
      ?.flatMap((header) => {
        const links = header
          .match(/href=["']([^"']+)["']/g)
          ?.filter(
            (link) =>
              link.includes("/products/") ||
              link.includes("/collections/") ||
              link.includes("/pages/")
          );
        return (
          links
            ?.map((link) => {
              const href = link.match(/href=["']([^"']+)["']/)?.[1];
              if (
                href &&
                !href.startsWith("#") &&
                !href.startsWith("javascript:")
              ) {
                try {
                  const url = new URL(href, storeDomain);
                  return url.pathname.replace(/^\/|\/$/g, "");
                } catch {
                  return href.replace(/^\/|\/$/g, "");
                }
              }
              return null;
            })
            .filter((item): item is string => Boolean(item)) ?? []
        );
      }) ?? [];

  const slug = generateStoreSlug(baseUrl);

  const countryDetection = await detectShopCountry(html);

  const doValidate = options?.validateShowcase === true;
  let homePageProductLinks: string[] = [];
  let homePageCollectionLinks: string[] = [];
  if (doValidate) {
    const batchSize = options?.validationBatchSize ?? 5;
    const validated = await Promise.all([
      validateLinksInBatches(
        extractedProductLinks.filter((handle): handle is string =>
          Boolean(handle)
        ),
        (handle) => validateProductExists(handle),
        batchSize
      ),
      validateLinksInBatches(
        extractedCollectionLinks.filter((handle): handle is string =>
          Boolean(handle)
        ),
        (handle) => validateCollectionExists(handle),
        batchSize
      ),
    ]);
    homePageProductLinks = validated[0] ?? [];
    homePageCollectionLinks = validated[1] ?? [];
  } else {
    homePageProductLinks = extractedProductLinks.filter(
      (handle): handle is string => Boolean(handle)
    );
    homePageCollectionLinks = extractedCollectionLinks.filter(
      (handle): handle is string => Boolean(handle)
    );
  }

  const dedupeByNormalized = (arr: string[]): string[] => {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const h of arr) {
      const base = h?.split("?")[0]?.replace(/^\/|\/$/g, "");
      if (!base) continue;
      if (seen.has(base)) continue;
      seen.add(base);
      out.push(base);
    }
    return out;
  };

  const seo = parseSeoFromHtml(html, baseUrl);

  const info: ShopInfo = {
    name: name || slug,
    domain: sanitizeDomain(baseUrl),
    slug,
    title: title || null,
    description: description || null,
    logoUrl: logoUrl,
    socialLinks,
    contactLinks,
    headerLinks,
    showcase: {
      products: dedupeByNormalized(homePageProductLinks ?? []),
      collections: dedupeByNormalized(homePageCollectionLinks ?? []),
    },
    jsonLdData:
      html
        .match(
          /<script[^>]*type="application\/ld\+json"[^>]*>([^<]+)<\/script>/g
        )
        ?.map(
          (match) => match?.split(">")[1]?.replace(/<\/script/g, "") || null
        )
        ?.map((json) => (json ? JSON.parse(json) : null)) || [],
    seo,
    techProvider: {
      name: shopifyWalletId ? "shopify" : "",
      walletId: shopifyWalletId,
      subDomain: myShopifySubdomain ?? null,
    },
    country: countryDetection.country,
    currency: countryDetection.currencyCode ?? null,
  };

  const currencyCode = countryDetection.currencyCode;
  return { info, currencyCode };
}
