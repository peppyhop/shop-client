import { unique } from "remeda";
import type { StoreInfo } from "../store";
import { detectStoreCountry } from "../utils/detect-country";
import {
  extractDomainWithoutSuffix,
  generateStoreSlug,
  sanitizeDomain,
} from "../utils/func";
import { rateLimitedFetch } from "../utils/rate-limit";

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
export async function getInfoForStore(
  args: Args
): Promise<{ info: StoreInfo; currencyCode?: string }> {
  const {
    baseUrl,
    storeDomain,
    validateProductExists,
    validateCollectionExists,
    validateLinksInBatches,
  } = args;

  const response = await rateLimitedFetch(baseUrl, {
    rateLimitClass: "store:info",
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

  const shopifyWalletId = getMetaTag("shopify-digital-wallet")?.split("/")[1];

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

  const extractedProductLinks =
    html
      .match(/href=["']([^"']*\/products\/[^"']+)["']/g)
      ?.map((match) =>
        match?.split("href=")[1]?.replace(/["']/g, "")?.split("/").at(-1)
      )
      ?.filter(Boolean) || [];

  const extractedCollectionLinks =
    html
      .match(/href=["']([^"']*\/collections\/[^"']+)["']/g)
      ?.map((match) =>
        match?.split("href=")[1]?.replace(/["']/g, "")?.split("/").at(-1)
      )
      ?.filter(Boolean) || [];

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

  const countryDetection = await detectStoreCountry(html);

  const [homePageProductLinks, homePageCollectionLinks] = await Promise.all([
    validateLinksInBatches(
      extractedProductLinks.filter((handle): handle is string =>
        Boolean(handle)
      ),
      (handle) => validateProductExists(handle)
    ),
    validateLinksInBatches(
      extractedCollectionLinks.filter((handle): handle is string =>
        Boolean(handle)
      ),
      (handle) => validateCollectionExists(handle)
    ),
  ]);

  const info: StoreInfo = {
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
      products: unique(homePageProductLinks ?? []),
      collections: unique(homePageCollectionLinks ?? []),
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
    techProvider: {
      name: "shopify",
      walletId: shopifyWalletId,
      subDomain: myShopifySubdomain ?? null,
    },
    country: countryDetection.country,
  };

  const currencyCode = (countryDetection as any)?.currencyCode;
  return { info, currencyCode };
}
