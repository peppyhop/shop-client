import { filter, isNonNullish } from "remeda";
// Heavy AI enrich utilities are lazy-loaded where needed to keep base bundle light
import type { StoreInfo } from "./store";
import type {
  CurrencyCode,
  Product,
  ProductClassification,
  SEOContent,
  ShopifyPredictiveProductSearch,
  ShopifyProduct,
  ShopifySingleProduct,
} from "./types";
import { formatPrice } from "./utils/func";
import { rateLimitedFetch } from "./utils/rate-limit";

/**
 * Interface for product operations
 */
export interface ProductOperations {
  /**
   * Fetches all products from the store across all pages.
   */
  all(options?: { currency?: CurrencyCode }): Promise<Product[] | null>;

  /**
   * Fetches products with pagination support.
   */
  paginated(options?: {
    page?: number;
    limit?: number;
    currency?: CurrencyCode;
  }): Promise<Product[] | null>;

  /**
   * Finds a specific product by its handle.
   */
  find(
    productHandle: string,
    options?: { currency?: CurrencyCode }
  ): Promise<Product | null>;

  /**
   * Finds a product by handle and enriches its content using LLM.
   * Requires an OpenAI API key via options.apiKey or process.env.OPENAI_API_KEY.
   */
  enriched(
    productHandle: string,
    options?: {
      apiKey?: string;
      useGfm?: boolean;
      inputType?: "markdown" | "html";
      model?: string;
      outputFormat?: "markdown" | "json";
    }
  ): Promise<Product | null>;
  classify(
    productHandle: string,
    options?: { apiKey?: string; model?: string }
  ): Promise<ProductClassification | null>;

  /**
   * Generate SEO and marketing content for a product.
   */
  generateSEOContent(
    productHandle: string,
    options?: { apiKey?: string; model?: string }
  ): Promise<SEOContent | null>;

  /**
   * Fetches products that are showcased/featured on the store's homepage.
   */
  showcased(): Promise<Product[]>;

  /**
   * Creates a filter map of variant options and their distinct values from all products.
   */
  filter(): Promise<Record<string, string[]> | null>;

  /**
   * Predictive product search using Shopify Ajax API.
   */
  predictiveSearch(
    query: string,
    options?: {
      limit?: number;
      locale?: string;
      currency?: CurrencyCode;
      unavailableProducts?: "show" | "hide" | "last";
    }
  ): Promise<Product[]>;

  /**
   * Product recommendations for a given product ID using Shopify Ajax API.
   */
  recommendations(
    productId: number,
    options?: {
      limit?: number;
      intent?: "related" | "complementary";
      locale?: string;
      currency?: CurrencyCode;
    }
  ): Promise<Product[] | null>;
}

/**
 * Creates product operations for a store instance
 */
export function createProductOperations(
  baseUrl: string,
  storeDomain: string,
  fetchProducts: (page: number, limit: number) => Promise<Product[] | null>,
  productsDto: (products: ShopifyProduct[]) => Product[] | null,
  productDto: (product: ShopifySingleProduct) => Product,
  getStoreInfo: () => Promise<StoreInfo>,
  findProduct: (handle: string) => Promise<Product | null>
): ProductOperations {
  // Use shared formatter from utils
  const cacheExpiryMs = 5 * 60 * 1000; // 5 minutes
  const findCache = new Map<string, { ts: number; value: Product | null }>();
  const getCached = (key: string): Product | null | undefined => {
    const entry = findCache.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.ts < cacheExpiryMs) return entry.value;
    findCache.delete(key);
    return undefined;
  };
  const setCached = (key: string, value: Product | null) => {
    findCache.set(key, { ts: Date.now(), value });
  };

  function applyCurrencyOverride(
    product: Product,
    currency: CurrencyCode
  ): Product {
    const priceMin = product.priceMin ?? product.price ?? 0;
    const priceMax = product.priceMax ?? product.price ?? 0;
    const compareAtMin =
      product.compareAtPriceMin ?? product.compareAtPrice ?? 0;
    return {
      ...product,
      currency,
      localizedPricing: {
        currency,
        priceFormatted: formatPrice(priceMin, currency),
        priceMinFormatted: formatPrice(priceMin, currency),
        priceMaxFormatted: formatPrice(priceMax, currency),
        compareAtPriceFormatted: formatPrice(compareAtMin, currency),
      },
    };
  }

  function maybeOverrideProductsCurrency(
    products: Product[] | null,
    currency?: CurrencyCode
  ): Product[] | null {
    if (!products || !currency) return products;
    return products.map((p) => applyCurrencyOverride(p, currency));
  }

  const operations: ProductOperations = {
    /**
     * Fetches all products from the store across all pages.
     *
     * @returns {Promise<Product[] | null>} Array of all products or null if error occurs
     *
     * @throws {Error} When there's a network error or API failure
     *
     * @example
     * ```typescript
     * const shop = new ShopClient('https://exampleshop.com');
     * const allProducts = await shop.products.all();
     *
     * console.log(`Found ${allProducts?.length} products`);
     * allProducts?.forEach(product => {
     *   console.log(product.title, product.price);
     * });
     * ```
     */
    all: async (options?: {
      currency?: CurrencyCode;
    }): Promise<Product[] | null> => {
      const limit = 250;
      const allProducts: Product[] = [];

      async function fetchAll() {
        let currentPage = 1;

        while (true) {
          const products = await fetchProducts(currentPage, limit);

          if (!products || products.length === 0 || products.length < limit) {
            if (products && products.length > 0) {
              allProducts.push(...products);
            }
            break;
          }

          allProducts.push(...products);
          currentPage++;
        }
        return allProducts;
      }

      try {
        const products = await fetchAll();
        return maybeOverrideProductsCurrency(products, options?.currency);
      } catch (error) {
        console.error("Failed to fetch all products:", storeDomain, error);
        throw error;
      }
    },

    /**
     * Fetches products with pagination support.
     *
     * @param options - Pagination options
     * @param options.page - Page number (default: 1)
     * @param options.limit - Number of products per page (default: 250, max: 250)
     *
     * @returns {Promise<Product[] | null>} Array of products for the specified page or null if error occurs
     *
     * @throws {Error} When there's a network error or API failure
     *
     * @example
     * ```typescript
     * const shop = new ShopClient('https://example.myshopify.com');
     *
     * // Get first page with default limit (250)
     * const firstPage = await shop.products.paginated();
     *
     * // Get second page with custom limit
     * const secondPage = await shop.products.paginated({ page: 2, limit: 50 });
     * ```
     */
    paginated: async (options?: {
      page?: number;
      limit?: number;
      currency?: CurrencyCode;
    }): Promise<Product[] | null> => {
      const page = options?.page ?? 1;
      const limit = Math.min(options?.limit ?? 250, 250);
      const url = `${baseUrl}products.json?limit=${limit}&page=${page}`;

      try {
        const response = await rateLimitedFetch(url, {
          rateLimitClass: "products:paginated",
        });
        if (!response.ok) {
          console.error(
            `HTTP error! status: ${response.status} for ${storeDomain} page ${page}`
          );
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = (await response.json()) as {
          products: ShopifyProduct[];
        };
        if (data.products.length === 0) {
          return [];
        }
        const normalized = productsDto(data.products);
        return maybeOverrideProductsCurrency(normalized, options?.currency);
      } catch (error) {
        console.error(
          `Error fetching products for ${storeDomain} page ${page} with limit ${limit}:`,
          error
        );
        return null;
      }
    },

    /**
     * Finds a specific product by its handle.
     *
     * @param productHandle - The product handle (URL slug) to search for
     *
     * @returns {Promise<Product | null>} The product if found, null if not found
     *
     * @throws {Error} When the handle is invalid or there's a network error
     *
     * @example
     * ```typescript
     * const shop = new ShopClient('https://exampleshop.com');
     *
     * // Find product by handle
     * const product = await shop.products.find('awesome-t-shirt');
     *
     * if (product) {
     *   console.log(product.title, product.price);
     *   console.log('Available variants:', product.variants.length);
     * }
     *
     * // Handle with query string
     * const productWithVariant = await shop.products.find('t-shirt?variant=123');
     * ```
     */
    find: async (
      productHandle: string,
      options?: { currency?: CurrencyCode }
    ): Promise<Product | null> => {
      // Validate product handle
      if (!productHandle || typeof productHandle !== "string") {
        throw new Error("Product handle is required and must be a string");
      }

      try {
        let qs: string | null = null;
        if (productHandle.includes("?")) {
          const parts = productHandle.split("?");
          const handlePart = parts[0] ?? productHandle;
          const qsPart = parts[1] ?? null;
          productHandle = handlePart;
          qs = qsPart;
        }

        // Sanitize handle - remove potentially dangerous characters
        const sanitizedHandle = productHandle
          .trim()
          .replace(/[^a-zA-Z0-9\-_]/g, "");
        if (!sanitizedHandle) {
          throw new Error("Invalid product handle format");
        }

        // Check handle length (reasonable limits)
        if (sanitizedHandle.length > 255) {
          throw new Error("Product handle is too long");
        }

        // Return cached value if present
        const cached = getCached(sanitizedHandle);
        if (typeof cached !== "undefined") {
          return options?.currency
            ? cached
              ? applyCurrencyOverride(cached, options.currency!)
              : null
            : cached;
        }

        // Resolve canonical handle via HTML redirect if handle has changed
        let finalHandle = sanitizedHandle;
        try {
          const htmlResp = await rateLimitedFetch(
            `${baseUrl}products/${encodeURIComponent(sanitizedHandle)}`,
            { rateLimitClass: "products:resolve" }
          );
          if (htmlResp.ok) {
            const finalUrl = htmlResp.url;
            if (finalUrl) {
              const pathname = new URL(finalUrl).pathname.replace(/\/$/, "");
              const parts = pathname.split("/").filter(Boolean);
              const idx = parts.indexOf("products");
              const maybeHandle = idx >= 0 ? parts[idx + 1] : undefined;
              if (typeof maybeHandle === "string" && maybeHandle.length) {
                finalHandle = maybeHandle;
              }
            }
          }
        } catch {
          // Ignore redirect resolution errors and proceed with original handle
        }

        const url = `${baseUrl}products/${encodeURIComponent(finalHandle)}.js${qs ? `?${qs}` : ""}`;
        const response = await rateLimitedFetch(url, {
          rateLimitClass: "products:single",
        });

        if (!response.ok) {
          if (response.status === 404) {
            return null;
          }
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const product = (await response.json()) as ShopifySingleProduct;
        const productData = productDto(product);
        // Cache under both original sanitized handle and final handle
        setCached(sanitizedHandle, productData);
        if (finalHandle !== sanitizedHandle)
          setCached(finalHandle, productData);
        return options?.currency
          ? applyCurrencyOverride(productData, options.currency)
          : productData;
      } catch (error) {
        if (error instanceof Error) {
          console.error(
            `Error fetching product ${productHandle}:`,
            baseUrl,
            error.message
          );
        }
        throw error;
      }
    },

    /**
     * Enrich a product by generating merged markdown from body_html and product page.
     * Adds `enriched_content` to the returned product.
     */
    enriched: async (
      productHandle: string,
      options?: {
        apiKey?: string;
        useGfm?: boolean;
        inputType?: "markdown" | "html";
        model?: string;
        outputFormat?: "markdown" | "json";
      }
    ): Promise<Product | null> => {
      if (!productHandle || typeof productHandle !== "string") {
        throw new Error("Product handle is required and must be a string");
      }

      const apiKey = options?.apiKey || process.env.OPENROUTER_API_KEY;
      if (!apiKey) {
        throw new Error(
          "Missing OpenRouter API key. Pass options.apiKey or set OPENROUTER_API_KEY."
        );
      }

      // Reuse find() for validation and normalized product
      const baseProduct = await operations.find(productHandle);
      if (!baseProduct) {
        return null;
      }

      // Use the normalized handle from the found product
      const handle = baseProduct.handle;
      const { enrichProduct } = await import("./ai/enrich");
      const enriched = await enrichProduct(storeDomain, handle, {
        apiKey,
        useGfm: options?.useGfm,
        inputType: options?.inputType,
        model: options?.model,
        outputFormat: options?.outputFormat,
      });

      return {
        ...baseProduct,
        enriched_content: enriched.mergedMarkdown,
      };
    },
    classify: async (
      productHandle: string,
      options?: { apiKey?: string; model?: string }
    ): Promise<ProductClassification | null> => {
      if (!productHandle || typeof productHandle !== "string") {
        throw new Error("Product handle is required and must be a string");
      }
      const apiKey = options?.apiKey || process.env.OPENROUTER_API_KEY;
      if (!apiKey) {
        throw new Error(
          "Missing OpenRouter API key. Pass options.apiKey or set OPENROUTER_API_KEY."
        );
      }
      const enrichedProduct = await operations.enriched(productHandle, {
        apiKey,
        inputType: "html",
        model: options?.model,
        outputFormat: "json",
      });
      if (!enrichedProduct || !enrichedProduct.enriched_content) return null;

      let productContent = enrichedProduct.enriched_content;
      try {
        const obj = JSON.parse(enrichedProduct.enriched_content);
        const lines: string[] = [];
        if (obj.title && typeof obj.title === "string")
          lines.push(`Title: ${obj.title}`);
        if (obj.description && typeof obj.description === "string")
          lines.push(`Description: ${obj.description}`);
        if (Array.isArray(obj.materials) && obj.materials.length)
          lines.push(`Materials: ${obj.materials.join(", ")}`);
        if (Array.isArray(obj.care) && obj.care.length)
          lines.push(`Care: ${obj.care.join(", ")}`);
        if (obj.fit && typeof obj.fit === "string")
          lines.push(`Fit: ${obj.fit}`);
        if (obj.returnPolicy && typeof obj.returnPolicy === "string")
          lines.push(`ReturnPolicy: ${obj.returnPolicy}`);
        productContent = lines.join("\n");
      } catch {
        // keep as-is if not JSON
      }

      const { classifyProduct } = await import("./ai/enrich");
      const classification = await classifyProduct(productContent, {
        apiKey,
        model: options?.model,
      });
      return classification;
    },

    generateSEOContent: async (
      productHandle: string,
      options?: { apiKey?: string; model?: string }
    ): Promise<SEOContent | null> => {
      if (!productHandle || typeof productHandle !== "string") {
        throw new Error("Product handle is required and must be a string");
      }
      const apiKey = options?.apiKey || process.env.OPENROUTER_API_KEY;
      if (!apiKey) {
        throw new Error(
          "Missing OpenRouter API key. Pass options.apiKey or set OPENROUTER_API_KEY."
        );
      }

      const baseProduct = await operations.find(productHandle);
      if (!baseProduct) return null;

      const payload = {
        title: baseProduct.title,
        description: baseProduct.bodyHtml || undefined,
        vendor: baseProduct.vendor,
        price: baseProduct.price,
        tags: baseProduct.tags,
      };

      const { generateSEOContent: generateSEOContentLLM } = await import(
        "./ai/enrich"
      );
      const seo = await generateSEOContentLLM(payload, {
        apiKey,
        model: options?.model,
      });
      return seo;
    },

    /**
     * Fetches products that are showcased/featured on the store's homepage.
     *
     * @returns {Promise<Product[]>} Array of showcased products found on the homepage
     *
     * @throws {Error} When there's a network error or API failure
     *
     * @example
     * ```typescript
     * const shop = new ShopClient('https://exampleshop.com');
     * const showcasedProducts = await shop.products.showcased();
     *
     * console.log(`Found ${showcasedProducts.length} showcased products`);
     * showcasedProducts.forEach(product => {
     *   console.log(`Featured: ${product.title} - ${product.price}`);
     * });
     * ```
     */
    showcased: async () => {
      const storeInfo = await getStoreInfo();
      const products = await Promise.all(
        storeInfo.showcase.products.map((productHandle: string) =>
          findProduct(productHandle)
        )
      );
      return filter(products, isNonNullish);
    },

    /**
     * Creates a filter map of variant options and their distinct values from all products.
     *
     * @returns {Promise<Record<string, string[]> | null>} Map of option names to their distinct values or null if error occurs
     *
     * @throws {Error} When there's a network error or API failure
     *
     * @example
     * ```typescript
     * const shop = new ShopClient('https://exampleshop.com');
     * const filters = await shop.products.filter();
     *
     * console.log('Available filters:', filters);
     * // Output: { "Size": ["S", "M", "L", "XL"], "Color": ["Red", "Blue", "Green"] }
     *
     * // Use filters for UI components
     * Object.entries(filters || {}).forEach(([optionName, values]) => {
     *   console.log(`${optionName}: ${values.join(', ')}`);
     * });
     * ```
     */
    filter: async (): Promise<Record<string, string[]> | null> => {
      try {
        // Use the existing all() method to get all products across all pages
        const products = await operations.all();
        if (!products || products.length === 0) {
          return {};
        }

        // Create a map to store option names and their distinct values
        const filterMap: Record<string, Set<string>> = {};

        // Process each product and its variants
        products.forEach((product) => {
          if (product.variants && product.variants.length > 0) {
            // Process product options
            if (product.options && product.options.length > 0) {
              product.options.forEach((option) => {
                const lowercaseOptionName = option.name.toLowerCase();
                if (!filterMap[lowercaseOptionName]) {
                  filterMap[lowercaseOptionName] = new Set();
                }
                // Add all values from this option (converted to lowercase)
                option.values.forEach((value) => {
                  const trimmed = value?.trim();
                  if (trimmed) {
                    let set = filterMap[lowercaseOptionName];
                    if (!set) {
                      set = new Set<string>();
                      filterMap[lowercaseOptionName] = set;
                    }
                    set.add(trimmed.toLowerCase());
                  }
                });
              });
            }

            // Also process individual variant options as fallback
            product.variants.forEach((variant) => {
              if (variant.option1) {
                const optionName = (
                  product.options?.[0]?.name || "Option 1"
                ).toLowerCase();
                let set1 = filterMap[optionName];
                if (!set1) {
                  set1 = new Set<string>();
                  filterMap[optionName] = set1;
                }
                set1.add(variant.option1.trim().toLowerCase());
              }

              if (variant.option2) {
                const optionName = (
                  product.options?.[1]?.name || "Option 2"
                ).toLowerCase();
                let set2 = filterMap[optionName];
                if (!set2) {
                  set2 = new Set<string>();
                  filterMap[optionName] = set2;
                }
                set2.add(variant.option2.trim().toLowerCase());
              }

              if (variant.option3) {
                const optionName = (
                  product.options?.[2]?.name || "Option 3"
                ).toLowerCase();
                if (!filterMap[optionName]) {
                  filterMap[optionName] = new Set();
                }
                filterMap[optionName].add(variant.option3.trim().toLowerCase());
              }
            });
          }
        });

        // Convert Sets to sorted arrays (values are already lowercase and unique due to Set)
        const result: Record<string, string[]> = {};
        Object.entries(filterMap).forEach(([optionName, valueSet]) => {
          result[optionName] = Array.from(valueSet).sort();
        });

        return result;
      } catch (error) {
        console.error("Failed to create product filters:", storeDomain, error);
        throw error;
      }
    },

    predictiveSearch: async (
      query: string,
      options?: {
        limit?: number;
        locale?: string;
        currency?: CurrencyCode;
        unavailableProducts?: "show" | "hide" | "last";
      }
    ): Promise<Product[]> => {
      if (!query || typeof query !== "string") {
        throw new Error("Query is required and must be a string");
      }
      const limit = Math.max(1, Math.min(options?.limit ?? 10, 10));
      const unavailable =
        options?.unavailableProducts === "show" ||
        options?.unavailableProducts === "hide"
          ? options.unavailableProducts
          : "hide";
      const localeValue = (options?.locale && options.locale.trim()) || "en";
      const localePrefix = `${localeValue.replace(/^\/|\/$/g, "")}/`;
      const url =
        `${baseUrl}${localePrefix}search/suggest.json` +
        `?q=${encodeURIComponent(query)}` +
        `&resources[type]=product` +
        `&resources[limit]=${limit}` +
        `&resources[options][unavailable_products]=${unavailable}`;

      const response = await rateLimitedFetch(url, {
        rateLimitClass: "search:predictive",
        timeoutMs: 7000,
        retry: { maxRetries: 2, baseDelayMs: 300 },
      });
      let resp = response;
      if (!resp.ok && (resp.status === 404 || resp.status === 417)) {
        const fallbackUrl =
          `${baseUrl}search/suggest.json` +
          `?q=${encodeURIComponent(query)}` +
          `&resources[type]=product` +
          `&resources[limit]=${limit}` +
          `&resources[options][unavailable_products]=${unavailable}`;
        resp = await rateLimitedFetch(fallbackUrl, {
          rateLimitClass: "search:predictive",
          timeoutMs: 7000,
          retry: { maxRetries: 2, baseDelayMs: 300 },
        });
      }
      if (!resp.ok) {
        // Common error statuses: 417 (language), 422 (invalid params), 429 (throttle), 5xx
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }
      const data = (await resp.json()) as ShopifyPredictiveProductSearch;
      const raw = data?.resources?.results?.products ?? [];
      const handles = raw
        .filter((p: any) => Boolean(p?.available ?? true))
        .map((p: any) => String(p?.handle ?? ""))
        .filter((h: string) => h.length > 0)
        .slice(0, limit);
      const fetched = await Promise.all(handles.map((h) => findProduct(h)));
      const results = filter(fetched, isNonNullish);
      const finalProducts =
        maybeOverrideProductsCurrency(results, options?.currency) ?? [];
      return finalProducts;
    },

    recommendations: async (
      productId: number,
      options?: {
        limit?: number;
        intent?: "related" | "complementary";
        locale?: string;
        currency?: CurrencyCode;
      }
    ): Promise<Product[] | null> => {
      if (!Number.isFinite(productId) || productId <= 0) {
        throw new Error("Valid productId is required");
      }
      const limit = Math.max(1, Math.min(options?.limit ?? 10, 10));
      const intent =
        options?.intent === "complementary" ? "complementary" : "related";
      const localeValue = (options?.locale && options.locale.trim()) || "en";
      const localePrefix = `${localeValue.replace(/^\/|\/$/g, "")}/`;
      const url =
        `${baseUrl}${localePrefix}recommendations/products.json` +
        `?product_id=${encodeURIComponent(String(productId))}` +
        `&limit=${limit}` +
        `&intent=${intent}`;

      const resp = await rateLimitedFetch(url, {
        rateLimitClass: "products:recommendations",
        timeoutMs: 7000,
        retry: { maxRetries: 2, baseDelayMs: 300 },
      });
      if (!resp.ok) {
        if (resp.status === 404) {
          return [];
        }
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }
      const data = await resp.json();
      const productsArray: ShopifyProduct[] = Array.isArray(data)
        ? (data as ShopifyProduct[])
        : Array.isArray((data as any)?.products)
          ? ((data as any).products as ShopifyProduct[])
          : [];
      const normalized = productsDto(productsArray) || [];
      const finalProducts =
        maybeOverrideProductsCurrency(normalized, options?.currency) ?? [];
      return finalProducts;
    },
  };

  return operations;
}
