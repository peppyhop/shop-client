import { getInfoForShop, getSeoForUrl } from "./client/get-info";
import type {
  CountryDetectionResult,
  CurrencyCode,
  EnhancedProductSeo,
  JsonLdEntry,
} from "./types";
import { rateLimitedFetch } from "./utils/rate-limit";

/**
 * Store operations interface for managing store-related functionality.
 * Provides methods to fetch comprehensive store information and metadata.
 */
export interface ShopOperations {
  info(): Promise<ShopInfo>;
  getSeo(): Promise<EnhancedProductSeo>;
  getMetaData(): Promise<OpenGraphMeta>;
  getJsonLd(): Promise<JsonLdEntry[] | undefined>;
  getHeaderLinks(): Promise<string[]>;
}

/**
 * Comprehensive store information structure returned by the info method.
 * Contains all metadata, branding, social links, and showcase content for a Shopify store.
 */
export interface ShopInfo {
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
  seo: EnhancedProductSeo;
  techProvider: {
    name: string;
    walletId: string | undefined;
    subDomain: string | null;
  };
  country: CountryDetectionResult["country"];
  currency: CurrencyCode | null;
}

export type StoreInfoColumnsConfig<K extends keyof ShopInfo = keyof ShopInfo> =
  {
    pick?: readonly K[];
  };

export type StoreInfoResult<K extends keyof ShopInfo = keyof ShopInfo> = Pick<
  ShopInfo,
  K
>;

export interface OpenGraphMeta {
  siteName: string | null;
  title: string | null;
  description: string | null;
  url: string | null;
  type: string | null;
  image: string | null;
  imageSecureUrl: string | null;
}

/**
 * Creates store operations for a ShopClient instance.
 * @param context - ShopClient context containing necessary methods and properties for store operations
 */
export function createShopOperations(context: {
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
}): ShopOperations {
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
     * - `currency` - ISO 4217 currency code inferred from store (e.g., "USD")
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
    info: async (): Promise<ShopInfo> => {
      try {
        // Delegate to shared client parser to avoid redundancy
        const { info } = await getInfoForShop({
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
    getSeo: async (): Promise<EnhancedProductSeo> => {
      try {
        return await getSeoForUrl({
          url: context.baseUrl,
          rateLimitClass: "store:seo",
        });
      } catch (error) {
        context.handleFetchError(error, "fetching store SEO", context.baseUrl);
      }
    },
    getMetaData: async (): Promise<OpenGraphMeta> => {
      try {
        const response = await rateLimitedFetch(context.baseUrl, {
          rateLimitClass: "store:metadata",
          timeoutMs: 7000,
        });
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const html = await response.text();
        const getPropertyMetaTag = (property: string) => {
          const regex = new RegExp(
            `<meta[^>]*property=["']${property}["'][^>]*content=["'](.*?)["']`
          );
          const match = html.match(regex);
          return match ? match[1] : null;
        };
        const siteName = getPropertyMetaTag("og:site_name");
        const title = getPropertyMetaTag("og:title");
        const description = getPropertyMetaTag("og:description");
        const url = getPropertyMetaTag("og:url");
        const type = getPropertyMetaTag("og:type");
        const image = getPropertyMetaTag("og:image");
        const imageSecureUrl = getPropertyMetaTag("og:image:secure_url");
        return {
          siteName: siteName ?? null,
          title: title ?? null,
          description: description ?? null,
          url: url ?? null,
          type: type ?? null,
          image: image ?? null,
          imageSecureUrl: imageSecureUrl ?? null,
        };
      } catch (error) {
        context.handleFetchError(
          error,
          "fetching store metadata",
          context.baseUrl
        );
      }
    },
    getJsonLd: async (): Promise<JsonLdEntry[] | undefined> => {
      try {
        const response = await rateLimitedFetch(context.baseUrl, {
          rateLimitClass: "store:jsonld",
          timeoutMs: 7000,
        });
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const html = await response.text();
        const scripts =
          html
            .match(
              /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g
            )
            ?.map((match) =>
              match.replace(/^.*?>/, "").replace(/<\/script>$/i, "")
            ) ?? [];
        const parsed = scripts
          .map((json) => {
            try {
              return JSON.parse(json) as JsonLdEntry;
            } catch {
              return undefined;
            }
          })
          .filter((x): x is JsonLdEntry => !!x);
        return parsed.length ? parsed : undefined;
      } catch (error) {
        context.handleFetchError(
          error,
          "fetching store JSON-LD",
          context.baseUrl
        );
      }
    },
    getHeaderLinks: async (): Promise<string[]> => {
      try {
        const response = await rateLimitedFetch(context.baseUrl, {
          rateLimitClass: "store:header",
          timeoutMs: 7000,
        });
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const html = await response.text();
        const sections =
          html.match(
            /<(header|nav|div|section)\b[^>]*\b(?:id|class)=["'][^"']*(?=.*shopify-section)(?=.*\b(header|navigation|nav|menu)\b)[^"']*["'][^>]*>[\s\S]*?<\/\1>/gi
          ) ?? [];
        const links = sections
          .flatMap((section) => section.match(/href=["']([^"']+)["']/g) ?? [])
          .map((link) => link.match(/href=["']([^"']+)["']/)?.[1])
          .filter((href): href is string => !!href)
          .filter(
            (href) =>
              href.includes("/products/") ||
              href.includes("/collections/") ||
              href.includes("/pages/")
          )
          .map((href) => {
            try {
              if (href.startsWith("//"))
                return new URL(`https:${href}`).pathname;
              if (href.startsWith("/"))
                return new URL(href, context.storeDomain).pathname;
              return new URL(href).pathname;
            } catch {
              return href;
            }
          })
          .map((p) => p.replace(/^\/|\/$/g, ""));
        // Deduplicate while preserving order
        const seen = new Set<string>();
        const deduped: string[] = [];
        for (const l of links) {
          if (!seen.has(l)) {
            seen.add(l);
            deduped.push(l);
          }
        }
        return deduped;
      } catch (error) {
        context.handleFetchError(
          error,
          "fetching header links",
          context.baseUrl
        );
      }
    },
  };
}
