import { getInfoForStore } from "./client/get-info";
import type { CountryDetectionResult, JsonLdEntry } from "./types";

/**
 * Store operations interface for managing store-related functionality.
 * Provides methods to fetch comprehensive store information and metadata.
 */
export interface StoreOperations {
  info(): Promise<StoreInfo>;
}

/**
 * Comprehensive store information structure returned by the info method.
 * Contains all metadata, branding, social links, and showcase content for a Shopify store.
 */
export interface StoreInfo {
  name: string;
  domain: string;
  slug: string;
  title: string | null;
  description: string | null;
  logoUrl: string | null;
  socialLinks: Record<string, string>;
  contactLinks: {
    tel: string | null;
    email: string | null;
    contactPage: string | null;
  };
  headerLinks: string[];
  showcase: {
    products: string[];
    collections: string[];
  };
  jsonLdData: JsonLdEntry[] | undefined;
  techProvider: {
    name: string;
    walletId: string | undefined;
    subDomain: string | null;
  };
  country: CountryDetectionResult["country"];
}

/**
 * Creates store operations for a ShopClient instance.
 * @param context - ShopClient context containing necessary methods and properties for store operations
 */
export function createStoreOperations(context: {
  baseUrl: string;
  storeDomain: string;
  validateProductExists: (handle: string) => Promise<boolean>;
  validateCollectionExists: (handle: string) => Promise<boolean>;
  validateLinksInBatches: <T>(
    items: T[],
    validator: (item: T) => Promise<boolean>,
    batchSize?: number
  ) => Promise<T[]>;
  handleFetchError: (error: unknown, context: string, url: string) => never;
}): StoreOperations {
  return {
    /**
     * Fetches comprehensive store information including metadata, social links, and showcase content.
     *
     * @returns {Promise<StoreInfo>} Store information object containing:
     * - `name` - Store name from meta tags or domain
     * - `domain` - Store domain URL
     * - `slug` - Generated store slug
     * - `title` - Store title from meta tags
     * - `description` - Store description from meta tags
     * - `logoUrl` - Store logo URL from Open Graph or CDN
     * - `socialLinks` - Object with social media links (facebook, twitter, instagram, etc.)
     * - `contactLinks` - Object with contact information (tel, email, contactPage)
     * - `headerLinks` - Array of navigation links from header
     * - `showcase` - Object with featured products and collections from homepage
     * - `jsonLdData` - Structured data from JSON-LD scripts
     * - `techProvider` - Shopify-specific information (walletId, subDomain)
     * - `country` - Country detection results with ISO 3166-1 alpha-2 codes (e.g., "US", "GB")
     *
     * @throws {Error} When the store URL is unreachable or returns an error
     *
     * @example
     * ```typescript
     * const shop = new ShopClient('https://exampleshop.com');
     * const storeInfo = await shop.getInfo();
     *
     * console.log(storeInfo.name); // "Example Store"
     * console.log(storeInfo.socialLinks.instagram); // "https://instagram.com/example"
     * console.log(storeInfo.showcase.products); // ["product-handle-1", "product-handle-2"]
     * console.log(storeInfo.country); // "US"
     * ```
     */
    info: async (): Promise<StoreInfo> => {
      try {
        // Delegate to shared client parser to avoid redundancy
        const { info } = await getInfoForStore({
          baseUrl: context.baseUrl,
          storeDomain: context.storeDomain,
          validateProductExists: context.validateProductExists,
          validateCollectionExists: context.validateCollectionExists,
          validateLinksInBatches: context.validateLinksInBatches,
        });
        return info;
        /* const response = await rateLimitedFetch(context.baseUrl);
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
          getMetaTag("og:site_name") ??
          extractDomainWithoutSuffix(context.baseUrl);
        const title = getMetaTag("og:title") ?? getMetaTag("twitter:title");

        const description =
          getMetaTag("description") || getPropertyMetaTag("og:description");

        const shopifyWalletId = getMetaTag("shopify-digital-wallet")?.split(
          "/"
        )[1];

        const myShopifySubdomainMatch = html.match(
          /['"](.*?\.myshopify\.com)['"]/
        );
        const myShopifySubdomain = myShopifySubdomainMatch
          ? myShopifySubdomainMatch[1]
          : null;

        let logoUrl =
          getPropertyMetaTag("og:image") ||
          getPropertyMetaTag("og:image:secure_url");
        if (!logoUrl) {
          const logoMatch = html.match(
            /<img[^>]+src=["']([^"']+\/cdn\/shop\/[^"']+)["']/
          );
          const group = logoMatch?.[1];
          logoUrl = group ? group.replace("http://", "https://") : null;
        } else {
          logoUrl = logoUrl.replace("http://", "https://");
        }

        const socialLinks: Record<string, string> = {};
        const socialRegex =
          /<a[^>]+href=["']([^"']*(?:facebook|twitter|instagram|pinterest|youtube|linkedin|tiktok|vimeo)\.com[^"']*)["']/g;
        for (const match of html.matchAll(socialRegex)) {
          const hrefGroup = match[1];
          if (!hrefGroup) continue;
          let href: string = hrefGroup;
          try {
            if (href.startsWith("//")) {
              href = `https:${href}`;
            } else if (href.startsWith("/")) {
              href = new URL(href, context.baseUrl).toString();
            }
            const parsed = new URL(href);
            const domain = parsed.hostname.replace("www.", "").split(".")[0];
            if (domain) {
              socialLinks[domain] = parsed.toString();
            }
          } catch {
            // Skip invalid URL entries silently
          }
        }

        const contactLinks = {
          tel: null as string | null,
          email: null as string | null,
          contactPage: null as string | null,
        };

        // Extract contact details using focused regexes to avoid parser pitfalls
        for (const match of html.matchAll(/href=["']tel:([^"']+)["']/g)) {
          const group = match[1];
          if (group) contactLinks.tel = group.trim();
        }
        for (const match of html.matchAll(/href=["']mailto:([^"']+)["']/g)) {
          const group = match[1];
          if (group) contactLinks.email = group.trim();
        }
        for (const match of html.matchAll(
          /href=["']([^"']*(?:\/contact|\/pages\/contact)[^"']*)["']/g
        )) {
          const group = match[1];
          if (group) contactLinks.contactPage = group;
        }

        const extractedProductLinks =
          html
            .match(/href=["']([^"']*\/products\/[^"']+)["']/g)
            ?.map((match) => {
              const afterHref = match.split("href=")[1];
              if (!afterHref) return null;
              const last = afterHref.replace(/[\'"]/g, "").split("/").at(-1);
              return last ?? null;
            })
            ?.filter((x): x is string => Boolean(x)) || [];

        const extractedCollectionLinks =
          html
            .match(/href=["']([^"']*\/collections\/[^"']+)["']/g)
            ?.map((match) => {
              const afterHref = match.split("href=")[1];
              if (!afterHref) return null;
              const last = afterHref.replace(/[\'"]/g, "").split("/").at(-1);
              return last ?? null;
            })
            ?.filter((x): x is string => Boolean(x)) || [];

        // Validate links in batches for better performance
        const [homePageProductLinks, homePageCollectionLinks] =
          await Promise.all([
            context.validateLinksInBatches(
              extractedProductLinks.filter((handle): handle is string =>
                Boolean(handle)
              ),
              (handle) => context.validateProductExists(handle)
            ),
            context.validateLinksInBatches(
              extractedCollectionLinks.filter((handle): handle is string =>
                Boolean(handle)
              ),
              (handle) => context.validateCollectionExists(handle)
            ),
          ]);

        const jsonLd = html
          .match(
            /<script[^>]*type="application\/ld\+json"[^>]*>([^<]+)<\/script>/g
          )
          ?.map((match) => {
            const afterGt = match.split(">")[1];
            return afterGt ? afterGt.replace(/<\/script/g, "") : "";
          });
        const jsonLdData: JsonLdEntry[] | undefined = jsonLd?.map(
          (json) => JSON.parse(json) as JsonLdEntry
        );

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
                        const url = new URL(href, context.storeDomain);
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

        const slug = generateStoreSlug(context.baseUrl);

        // Detect country information
        const countryDetection = await detectShopCountry(html);

        return {
          name: name || slug,
          domain: context.baseUrl,
          slug,
          title: title ?? null,
          description: description ?? null,
          logoUrl,
          socialLinks,
          contactLinks,
          headerLinks,
          showcase: {
            products: unique(homePageProductLinks ?? []),
            collections: unique(homePageCollectionLinks ?? []),
          },
          jsonLdData,
          techProvider: {
            name: "shopify",
            walletId: shopifyWalletId,
            subDomain: myShopifySubdomain ?? null,
          },
          country: countryDetection?.country || "",
        };
        */
      } catch (error) {
        context.handleFetchError(error, "fetching store info", context.baseUrl);
      }
    },
  };
}
