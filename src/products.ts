import { filter, isNonNullish } from "remeda";
// Heavy AI enrich utilities are lazy-loaded where needed to keep base bundle light
import type { ShopInfo } from "./store";
import type {
  CurrencyCode,
  EnhancedProductResponse,
  MinimalProduct,
  OpenRouterConfig,
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
   * Use `shop.products.minimal.all()` for MinimalProduct returns.
   */
  all(options?: { currency?: CurrencyCode }): Promise<Product[] | null>;

  /**
   * Fetches products with pagination support.
   * Use `shop.products.minimal.paginated()` for MinimalProduct returns.
   */
  paginated(options?: {
    page?: number;
    limit?: number;
    currency?: CurrencyCode;
  }): Promise<Product[] | null>;

  /**
   * Finds a specific product by its handle.
   * Use `shop.products.minimal.find()` for MinimalProduct returns.
   */
  find(
    productHandle: string,
    options?: { currency?: CurrencyCode }
  ): Promise<Product | null>;

  /**
   * Finds a product and enhances it with AI-generated content using an external service.
   *
   * @param productHandle - The handle of the product to find.
   * @param options - Options for the request.
   * @param options.apiKey - API key for the enhancement service. Required for authentication via x-api-key header.
   * @param options.updatedAt - Product updatedAt timestamp used to cache-bust/invalidate enrichment.
   * @param options.endpoint - Optional custom endpoint URL for the enhancement service. Defaults to the standard worker URL.
   */
  findEnhanced(
    productHandle: string,
    options: { apiKey: string; updatedAt: string; endpoint?: string }
  ): Promise<EnhancedProductResponse | null>;

  /**
   * Finds a product by handle and enriches its content using LLM.
   * Requires an OpenRouter API key via options.apiKey or ShopClient options.
   */
  enriched(
    productHandle: string,
    options?: {
      apiKey?: string;
      useGfm?: boolean;
      inputType?: "markdown" | "html";
      model?: string;
      outputFormat?: "markdown" | "json";
      content?: string;
    }
  ): Promise<Product | null>;

  enrichedPrompts(
    productHandle: string,
    options?: {
      useGfm?: boolean;
      inputType?: "markdown" | "html";
      outputFormat?: "markdown" | "json";
      content?: string;
    }
  ): Promise<{ system: string; user: string }>;

  classify(
    productHandle: string,
    options?: { apiKey?: string; model?: string; content?: string }
  ): Promise<ProductClassification | null>;

  classifyPrompts(
    productHandle: string,
    options?: {
      useGfm?: boolean;
      inputType?: "markdown" | "html";
      content?: string;
    }
  ): Promise<{ system: string; user: string }>;

  /**
   * Generate SEO and marketing content for a product.
   */
  generateSEOContent(
    productHandle: string,
    options?: { apiKey?: string; model?: string }
  ): Promise<SEOContent | null>;

  /**
   * Fetches the extracted HTML content from the product page.
   * This is useful for getting the main product description and content directly from the page HTML.
   * If content is provided, it is used directly to extract the main section.
   */
  infoHtml(productHandle: string, content?: string): Promise<string | null>;

  /**
   * Fetches products that are showcased/featured on the store's homepage.
   */
  showcased(): Promise<Product[]>;
  /**
   * Showcase namespace for convenience methods related to featured items.
   */
  showcase: {
    /**
     * Returns showcased products in MinimalProduct form.
     */
    minimal(): Promise<MinimalProduct[]>;
  };

  /**
   * Creates a filter map of variant options and their distinct values from all products.
   */
  filter(): Promise<Record<string, string[]> | null>;

  /**
   * Predictive product search using Shopify Ajax API.
   * Use `shop.products.minimal.predictiveSearch()` for MinimalProduct returns.
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
   * Use `shop.products.minimal.recommendations()` for MinimalProduct returns.
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

  /**
   * Minimal namespace for convenience methods that always return MinimalProduct types.
   */
  minimal: {
    all(options?: {
      currency?: CurrencyCode;
    }): Promise<MinimalProduct[] | null>;
    paginated(options?: {
      page?: number;
      limit?: number;
      currency?: CurrencyCode;
    }): Promise<MinimalProduct[] | null>;
    find(
      productHandle: string,
      options?: { currency?: CurrencyCode }
    ): Promise<MinimalProduct | null>;
    findEnhanced(
      productHandle: string,
      options: { apiKey: string; updatedAt: string; endpoint?: string }
    ): Promise<EnhancedProductResponse<MinimalProduct> | null>;
    showcased(): Promise<MinimalProduct[]>;
    predictiveSearch(
      query: string,
      options?: {
        limit?: number;
        locale?: string;
        currency?: CurrencyCode;
        unavailableProducts?: "show" | "hide" | "last";
      }
    ): Promise<MinimalProduct[]>;
    recommendations(
      productId: number,
      options?: {
        limit?: number;
        intent?: "related" | "complementary";
        locale?: string;
        currency?: CurrencyCode;
      }
    ): Promise<MinimalProduct[] | null>;
  };
}

/**
 * Creates product operations for a store instance
 */
export function createProductOperations(
  baseUrl: string,
  storeDomain: string,
  fetchProducts: (
    page: number,
    limit: number,
    options?: { minimal?: boolean }
  ) => Promise<Product[] | MinimalProduct[] | null>,
  productsDto: (
    products: ShopifyProduct[],
    options?: { minimal?: boolean }
  ) => Product[] | MinimalProduct[] | null,
  productDto: (
    product: ShopifySingleProduct,
    options?: { minimal?: boolean }
  ) => Product | MinimalProduct,
  getStoreInfo: () => Promise<ShopInfo>,
  _findProduct: (
    handle: string,
    options?: { minimal?: boolean }
  ) => Promise<Product | MinimalProduct | null>,
  ai?: { openRouter?: OpenRouterConfig }
): ProductOperations {
  // Use shared formatter from utils
  const cacheExpiryMs = 5 * 60 * 1000; // 5 minutes
  const findCacheFull = new Map<
    string,
    { ts: number; value: Product | null }
  >();
  const findCacheMinimal = new Map<
    string,
    { ts: number; value: MinimalProduct | null }
  >();
  const getCachedFull = (key: string): Product | null | undefined => {
    const entry = findCacheFull.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.ts < cacheExpiryMs) return entry.value;
    findCacheFull.delete(key);
    return undefined;
  };
  const setCachedFull = (key: string, value: Product | null) => {
    findCacheFull.set(key, { ts: Date.now(), value });
  };
  const getCachedMinimal = (key: string): MinimalProduct | null | undefined => {
    const entry = findCacheMinimal.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.ts < cacheExpiryMs) return entry.value;
    findCacheMinimal.delete(key);
    return undefined;
  };
  const setCachedMinimal = (key: string, value: MinimalProduct | null) => {
    findCacheMinimal.set(key, { ts: Date.now(), value });
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

  function applyCurrencyOverrideMinimal(
    product: MinimalProduct,
    currency: CurrencyCode
  ): MinimalProduct {
    const compareAtPrice = product.compareAtPrice ?? 0;
    return {
      ...product,
      localizedPricing: {
        priceFormatted: formatPrice(product.price, currency),
        compareAtPriceFormatted: formatPrice(compareAtPrice, currency),
      },
    };
  }

  function maybeOverrideProductsCurrency(
    products: Product[] | null,
    currency?: CurrencyCode
  ): Product[] | null {
    if (!products || !currency || products.length === 0) return products;
    return products.map((p) => applyCurrencyOverride(p, currency));
  }

  function maybeOverrideMinimalProductsCurrency(
    products: MinimalProduct[] | null,
    currency?: CurrencyCode
  ): MinimalProduct[] | null {
    if (!products || !currency || products.length === 0) return products;
    return products.map((p) => applyCurrencyOverrideMinimal(p, currency));
  }

  function allInternal(options: {
    currency?: CurrencyCode;
    minimal: true;
  }): Promise<MinimalProduct[] | null>;
  function allInternal(options: {
    currency?: CurrencyCode;
    minimal: false;
  }): Promise<Product[] | null>;
  async function allInternal(options: {
    currency?: CurrencyCode;
    minimal: boolean;
  }): Promise<Product[] | MinimalProduct[] | null> {
    const limit = 250;
    const allProducts: (Product | MinimalProduct)[] = [];

    async function fetchAll() {
      let currentPage = 1;

      while (true) {
        const products = await fetchProducts(currentPage, limit, {
          minimal: options.minimal,
        });

        if (!products || products.length === 0 || products.length < limit) {
          if (products && products.length > 0) {
            allProducts.push(...products);
          }
          break;
        }

        allProducts.push(...products);
        currentPage++;
      }
      return allProducts as Product[] | MinimalProduct[];
    }

    try {
      const products = await fetchAll();
      return options.minimal
        ? maybeOverrideMinimalProductsCurrency(
            products as MinimalProduct[],
            options.currency
          )
        : maybeOverrideProductsCurrency(
            products as Product[],
            options.currency
          );
    } catch (error) {
      console.error("Failed to fetch all products:", storeDomain, error);
      throw error;
    }
  }

  function paginatedInternal(options: {
    page?: number;
    limit?: number;
    currency?: CurrencyCode;
    minimal: true;
  }): Promise<MinimalProduct[] | null>;
  function paginatedInternal(options: {
    page?: number;
    limit?: number;
    currency?: CurrencyCode;
    minimal: false;
  }): Promise<Product[] | null>;
  async function paginatedInternal(options: {
    page?: number;
    limit?: number;
    currency?: CurrencyCode;
    minimal: boolean;
  }): Promise<Product[] | MinimalProduct[] | null> {
    const page = options.page ?? 1;
    const limit = Math.min(options.limit ?? 250, 250);
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
      const normalized = productsDto(data.products, {
        minimal: options.minimal,
      });
      return options.minimal
        ? maybeOverrideMinimalProductsCurrency(
            (normalized as MinimalProduct[] | null) || null,
            options.currency
          )
        : maybeOverrideProductsCurrency(
            (normalized as Product[] | null) || null,
            options.currency
          );
    } catch (error) {
      console.error(
        `Error fetching products for ${storeDomain} page ${page} with limit ${limit}:`,
        error
      );
      return null;
    }
  }

  function findInternal(
    productHandle: string,
    options: { currency?: CurrencyCode; minimal: true }
  ): Promise<MinimalProduct | null>;
  function findInternal(
    productHandle: string,
    options: { currency?: CurrencyCode; minimal: false }
  ): Promise<Product | null>;
  function findInternal(
    productHandle: string,
    options: { currency?: CurrencyCode; minimal: boolean }
  ): Promise<Product | MinimalProduct | null>;
  async function findInternal(
    productHandle: string,
    options: { currency?: CurrencyCode; minimal: boolean }
  ): Promise<Product | MinimalProduct | null> {
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

      const sanitizedHandle = productHandle
        .trim()
        .replace(/[^a-zA-Z0-9\-_]/g, "");
      if (!sanitizedHandle) {
        throw new Error("Invalid product handle format");
      }

      if (sanitizedHandle.length > 255) {
        throw new Error("Product handle is too long");
      }

      const cached = options.minimal
        ? getCachedMinimal(sanitizedHandle)
        : getCachedFull(sanitizedHandle);
      if (typeof cached !== "undefined") {
        if (!cached || !options.currency) return cached;
        return options.minimal
          ? applyCurrencyOverrideMinimal(
              cached as MinimalProduct,
              options.currency
            )
          : applyCurrencyOverride(cached as Product, options.currency);
      }

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
      const productData = productDto(product, { minimal: options.minimal });

      if (options.minimal) {
        const minimalData = productData as MinimalProduct;
        setCachedMinimal(sanitizedHandle, minimalData);
        if (finalHandle !== sanitizedHandle)
          setCachedMinimal(finalHandle, minimalData);
        return options.currency
          ? applyCurrencyOverrideMinimal(minimalData, options.currency)
          : minimalData;
      }

      const fullData = productData as Product;
      setCachedFull(sanitizedHandle, fullData);
      if (finalHandle !== sanitizedHandle) setCachedFull(finalHandle, fullData);
      return options.currency
        ? applyCurrencyOverride(fullData, options.currency)
        : fullData;
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
  }

  function predictiveSearchInternal(
    query: string,
    options: {
      limit?: number;
      locale?: string;
      currency?: CurrencyCode;
      unavailableProducts?: "show" | "hide" | "last";
      minimal: true;
    }
  ): Promise<MinimalProduct[]>;
  function predictiveSearchInternal(
    query: string,
    options: {
      limit?: number;
      locale?: string;
      currency?: CurrencyCode;
      unavailableProducts?: "show" | "hide" | "last";
      minimal: false;
    }
  ): Promise<Product[]>;
  async function predictiveSearchInternal(
    query: string,
    options: {
      limit?: number;
      locale?: string;
      currency?: CurrencyCode;
      unavailableProducts?: "show" | "hide" | "last";
      minimal: boolean;
    }
  ): Promise<Product[] | MinimalProduct[]> {
    if (!query || typeof query !== "string") {
      throw new Error("Query is required and must be a string");
    }
    const limit = Math.max(1, Math.min(options.limit ?? 10, 10));
    const unavailable =
      options.unavailableProducts === "show" ||
      options.unavailableProducts === "hide"
        ? options.unavailableProducts
        : "hide";
    const localeValue = (options.locale && options.locale.trim()) || "en";
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
      throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
    }
    const data = (await resp.json()) as ShopifyPredictiveProductSearch;
    const raw = data?.resources?.results?.products ?? [];
    const handles = raw
      .filter((p) => p.available !== false)
      .map((p) => p.handle)
      .filter((h) => typeof h === "string" && h.length > 0)
      .slice(0, limit);
    const fetched = await Promise.all(
      handles.map((h) => findInternal(h, { minimal: options.minimal }))
    );
    const results = filter(fetched, isNonNullish);
    const finalProducts = options.minimal
      ? (maybeOverrideMinimalProductsCurrency(
          results as MinimalProduct[],
          options.currency
        ) ?? [])
      : (maybeOverrideProductsCurrency(
          results as Product[],
          options.currency
        ) ?? []);
    return finalProducts as Product[] | MinimalProduct[];
  }

  function recommendationsInternal(
    productId: number,
    options: {
      limit?: number;
      intent?: "related" | "complementary";
      locale?: string;
      currency?: CurrencyCode;
      minimal: true;
    }
  ): Promise<MinimalProduct[] | null>;
  function recommendationsInternal(
    productId: number,
    options: {
      limit?: number;
      intent?: "related" | "complementary";
      locale?: string;
      currency?: CurrencyCode;
      minimal: false;
    }
  ): Promise<Product[] | null>;
  async function recommendationsInternal(
    productId: number,
    options: {
      limit?: number;
      intent?: "related" | "complementary";
      locale?: string;
      currency?: CurrencyCode;
      minimal: boolean;
    }
  ): Promise<Product[] | MinimalProduct[] | null> {
    if (!Number.isFinite(productId) || productId <= 0) {
      throw new Error("Valid productId is required");
    }
    const limit = Math.max(1, Math.min(options.limit ?? 10, 10));
    const intent = options.intent ?? "related";
    const localeValue = (options.locale && options.locale.trim()) || "en";
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
    const data: unknown = await resp.json();
    const isRecord = (v: unknown): v is Record<string, unknown> =>
      typeof v === "object" && v !== null;
    const productsArray: ShopifyProduct[] = Array.isArray(data)
      ? (data as ShopifyProduct[])
      : isRecord(data) && Array.isArray(data.products)
        ? (data.products as ShopifyProduct[])
        : [];
    const normalized =
      productsDto(productsArray, { minimal: options.minimal }) || [];
    const finalProducts = options.minimal
      ? maybeOverrideMinimalProductsCurrency(
          normalized as MinimalProduct[],
          options.currency
        )
      : maybeOverrideProductsCurrency(
          normalized as Product[],
          options.currency
        );
    return finalProducts ?? [];
  }

  /**
   * Internal implementation of findEnhanced.
   *
   * @param productHandle - The handle of the product to find.
   * @param options - Options for the request.
   * @param options.apiKey - API key for the enhancement service. Required for authentication via x-api-key header.
   * @param options.updatedAt - Product updatedAt timestamp used to cache-bust/invalidate enrichment.
   * @param options.endpoint - Optional custom endpoint URL for the enhancement service. Defaults to the standard worker URL.
   */
  async function findEnhancedInternal(
    productHandle: string,
    options: { apiKey: string; updatedAt: string; endpoint?: string }
  ): Promise<EnhancedProductResponse | null> {
    const apiKey = options.apiKey;
    if (!apiKey || typeof apiKey !== "string" || !apiKey.trim()) {
      throw new Error("apiKey is required");
    }

    const updatedAt = options.updatedAt;
    if (!updatedAt || typeof updatedAt !== "string" || !updatedAt.trim()) {
      throw new Error("updatedAt is required");
    }
    const updatedAtTrimmed = updatedAt.trim();

    const baseProduct = await findInternal(productHandle, { minimal: false });
    if (!baseProduct) return null;

    const endpoint =
      (typeof options.endpoint === "string" && options.endpoint.trim()) ||
      "https://shopify-product-enrichment-worker.ninjacode.workers.dev";

    let hostname = storeDomain;
    try {
      hostname = new URL(storeDomain).hostname;
    } catch {
      hostname = storeDomain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    }

    const resp = await rateLimitedFetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        storeDomain: hostname,
        handle: baseProduct.handle,
        updatedAt: updatedAtTrimmed,
      }),
      rateLimitClass: "products:enhanced",
      timeoutMs: 15000,
      retry: {
        maxRetries: 2,
        baseDelayMs: 300,
        retryOnStatuses: [429, 500, 502, 503, 504],
      },
    });
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
    }
    const data: unknown = await resp.json();
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("Invalid enhanced product response");
    }
    const o = data as Record<string, unknown>;
    if (!("shopify" in o) || !("enrichment" in o) || !("cache" in o)) {
      throw new Error("Invalid enhanced product response");
    }
    const parsed = data as {
      shopify: unknown;
      enrichment: EnhancedProductResponse["enrichment"];
      cache: EnhancedProductResponse["cache"];
    };
    let mappedProduct: Product = baseProduct;
    try {
      const raw = parsed.shopify;
      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        if ("body_html" in raw) {
          const mapped = productsDto([raw as ShopifyProduct], {
            minimal: false,
          });
          const first = Array.isArray(mapped) ? mapped[0] : null;
          if (first) mappedProduct = first as Product;
        } else if ("description" in raw) {
          mappedProduct = productDto(raw as ShopifySingleProduct, {
            minimal: false,
          }) as Product;
        }
      }
    } catch {}
    return {
      enrichment: parsed.enrichment,
      cache: parsed.cache,
      product: mappedProduct,
    };
  }

  /**
   * Internal implementation of minimal.findEnhanced.
   *
   * @param productHandle - The handle of the product to find.
   * @param options - Options for the request.
   * @param options.apiKey - API key for the enhancement service. Required for authentication via x-api-key header.
   * @param options.updatedAt - Product updatedAt timestamp used to cache-bust/invalidate enrichment.
   * @param options.endpoint - Optional custom endpoint URL for the enhancement service. Defaults to the standard worker URL.
   */
  async function findEnhancedMinimalInternal(
    productHandle: string,
    options: { apiKey: string; updatedAt: string; endpoint?: string }
  ): Promise<EnhancedProductResponse<MinimalProduct> | null> {
    const apiKey = options.apiKey;
    if (!apiKey || typeof apiKey !== "string" || !apiKey.trim()) {
      throw new Error("apiKey is required");
    }

    const updatedAt = options.updatedAt;
    if (!updatedAt || typeof updatedAt !== "string" || !updatedAt.trim()) {
      throw new Error("updatedAt is required");
    }
    const updatedAtTrimmed = updatedAt.trim();

    const baseProduct = await findInternal(productHandle, { minimal: false });
    if (!baseProduct) return null;

    const endpoint =
      (typeof options.endpoint === "string" && options.endpoint.trim()) ||
      "https://shopify-product-enrichment-worker.ninjacode.workers.dev";

    let hostname = storeDomain;
    try {
      hostname = new URL(storeDomain).hostname;
    } catch {
      hostname = storeDomain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    }

    const resp = await rateLimitedFetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        storeDomain: hostname,
        handle: baseProduct.handle,
        updatedAt: updatedAtTrimmed,
      }),
      rateLimitClass: "products:enhanced",
      timeoutMs: 15000,
      retry: {
        maxRetries: 2,
        baseDelayMs: 300,
        retryOnStatuses: [429, 500, 502, 503, 504],
      },
    });
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
    }
    const data: unknown = await resp.json();
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("Invalid enhanced product response");
    }
    const o = data as Record<string, unknown>;
    if (!("shopify" in o) || !("enrichment" in o) || !("cache" in o)) {
      throw new Error("Invalid enhanced product response");
    }
    const parsed = data as {
      shopify: unknown;
      enrichment: EnhancedProductResponse["enrichment"];
      cache: EnhancedProductResponse["cache"];
    };
    let mappedMinimal: MinimalProduct | null = null;
    try {
      const raw = parsed.shopify;
      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        if ("body_html" in raw) {
          const mapped = productsDto([raw as ShopifyProduct], {
            minimal: true,
          });
          const first = Array.isArray(mapped) ? mapped[0] : null;
          mappedMinimal = (first as MinimalProduct) || null;
        } else if ("description" in raw) {
          mappedMinimal = productDto(raw as ShopifySingleProduct, {
            minimal: true,
          }) as MinimalProduct;
        }
      }
    } catch {}
    if (!mappedMinimal) {
      mappedMinimal = await findInternal(baseProduct.handle, { minimal: true });
    }
    if (!mappedMinimal) return null;
    return {
      enrichment: parsed.enrichment,
      cache: parsed.cache,
      product: mappedMinimal,
    };
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
    }): Promise<Product[] | null> =>
      allInternal({ currency: options?.currency, minimal: false }),

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
    }): Promise<Product[] | null> =>
      paginatedInternal({
        page: options?.page,
        limit: options?.limit,
        currency: options?.currency,
        minimal: false,
      }),

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
    ): Promise<Product | null> =>
      findInternal(productHandle, {
        minimal: false,
        currency: options?.currency,
      }),

    findEnhanced: async (
      productHandle: string,
      options: { apiKey: string; updatedAt: string; endpoint?: string }
    ): Promise<EnhancedProductResponse | null> =>
      findEnhancedInternal(productHandle, options),

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
        content?: string;
      }
    ): Promise<Product | null> => {
      if (!productHandle || typeof productHandle !== "string") {
        throw new Error("Product handle is required and must be a string");
      }

      // Reuse find() for validation and normalized product
      const baseProduct = await operations.find(productHandle);
      if (!baseProduct) return null;

      // Use the normalized handle from the found product
      const handle = baseProduct.handle;
      const { enrichProduct } = await import("./ai/enrich");
      const enriched = await enrichProduct(storeDomain, handle, {
        apiKey: options?.apiKey,
        openRouter: ai?.openRouter,
        useGfm: options?.useGfm,
        inputType: options?.inputType,
        model: options?.model,
        outputFormat: options?.outputFormat,
        htmlContent: options?.content,
      });

      return {
        ...baseProduct,
        enriched_content: enriched.mergedMarkdown,
      };
    },

    enrichedPrompts: async (
      productHandle: string,
      options?: {
        useGfm?: boolean;
        inputType?: "markdown" | "html";
        outputFormat?: "markdown" | "json";
        content?: string;
      }
    ): Promise<{ system: string; user: string }> => {
      if (!productHandle || typeof productHandle !== "string") {
        throw new Error("Product handle is required and must be a string");
      }

      // Reuse find() for validation and normalized product
      const baseProduct = await operations.find(productHandle);
      if (!baseProduct) throw new Error("Product not found");

      const handle = baseProduct.handle;
      const { buildEnrichPromptForProduct } = await import("./ai/enrich");
      return buildEnrichPromptForProduct(storeDomain, handle, {
        useGfm: options?.useGfm,
        inputType: options?.inputType,
        outputFormat: options?.outputFormat,
        htmlContent: options?.content,
      });
    },
    classify: async (
      productHandle: string,
      options?: { apiKey?: string; model?: string; content?: string }
    ): Promise<ProductClassification | null> => {
      if (!productHandle || typeof productHandle !== "string") {
        throw new Error("Product handle is required and must be a string");
      }
      const enrichedProduct = await operations.enriched(productHandle, {
        apiKey: options?.apiKey,
        inputType: "html",
        model: options?.model,
        outputFormat: "json",
        content: options?.content,
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
        apiKey: options?.apiKey,
        openRouter: ai?.openRouter,
        model: options?.model,
      });
      return classification;
    },

    classifyPrompts: async (
      productHandle: string,
      options?: {
        useGfm?: boolean;
        inputType?: "markdown" | "html";
        content?: string;
      }
    ): Promise<{ system: string; user: string }> => {
      if (!productHandle || typeof productHandle !== "string") {
        throw new Error("Product handle is required and must be a string");
      }

      const baseProduct = await operations.find(productHandle);
      if (!baseProduct) throw new Error("Product not found");

      const handle = baseProduct.handle;
      const { buildClassifyPromptForProduct } = await import("./ai/enrich");
      return buildClassifyPromptForProduct(storeDomain, handle, {
        useGfm: options?.useGfm,
        inputType: options?.inputType,
        htmlContent: options?.content,
      });
    },

    generateSEOContent: async (
      productHandle: string,
      options?: { apiKey?: string; model?: string }
    ): Promise<SEOContent | null> => {
      if (!productHandle || typeof productHandle !== "string") {
        throw new Error("Product handle is required and must be a string");
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
        apiKey: options?.apiKey,
        openRouter: ai?.openRouter,
        model: options?.model,
      });
      return seo;
    },

    /**
     * Fetches the extracted HTML content from the product page.
     * This is useful for getting the main product description and content directly from the page HTML.
     *
     * @param productHandle - The handle of the product
     * @param content - Optional HTML content to extract from. If provided, skips fetching the product page.
     * @returns {Promise<string | null>} The extracted HTML content or null if not found
     *
     * @example
     * ```typescript
     * // Fetch from store
     * const html = await shop.products.infoHtml("product-handle");
     *
     * // Use provided HTML
     * const htmlFromContent = await shop.products.infoHtml("product-handle", "<html>...</html>");
     * ```
     */
    infoHtml: async (
      productHandle: string,
      content?: string
    ): Promise<string | null> => {
      if (!productHandle || typeof productHandle !== "string") {
        throw new Error("Product handle is required and must be a string");
      }

      const { extractMainSection, fetchProductPage } = await import(
        "./ai/enrich"
      );

      if (content) {
        return extractMainSection(content);
      }

      const baseProduct = await operations.find(productHandle);
      if (!baseProduct) return null;

      const pageHtml = await fetchProductPage(storeDomain, baseProduct.handle);
      return extractMainSection(pageHtml);
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
    showcased: async (): Promise<Product[]> => {
      const storeInfo = await getStoreInfo();
      const normalizedHandles = storeInfo.showcase.products
        .map((h: string) => h.split("?")[0]?.replace(/^\/|\/$/g, ""))
        .filter((base): base is string => Boolean(base));
      const seen = new Set<string>();
      const uniqueHandles: string[] = [];
      for (const base of normalizedHandles) {
        if (seen.has(base)) continue;
        seen.add(base);
        uniqueHandles.push(base);
      }
      const products = await Promise.all(
        uniqueHandles.map((productHandle: string) =>
          findInternal(productHandle, { minimal: false })
        )
      );
      return filter(products, isNonNullish) as Product[];
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
        // We cast to Product[] because filter logic requires full product details (options, variants)
        const products = (await operations.all()) as Product[] | null;
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
              if (product.options?.length) return;
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
    ): Promise<Product[]> =>
      predictiveSearchInternal(query, {
        limit: options?.limit,
        locale: options?.locale,
        currency: options?.currency,
        unavailableProducts: options?.unavailableProducts,
        minimal: false,
      }) as Promise<Product[]>,

    recommendations: async (
      productId: number,
      options?: {
        limit?: number;
        intent?: "related" | "complementary";
        locale?: string;
        currency?: CurrencyCode;
      }
    ): Promise<Product[] | null> =>
      recommendationsInternal(productId, {
        limit: options?.limit,
        intent: options?.intent,
        locale: options?.locale,
        currency: options?.currency,
        minimal: false,
      }) as Promise<Product[] | null>,
    minimal: {
      all: async (options?: {
        currency?: CurrencyCode;
      }): Promise<MinimalProduct[] | null> => {
        return allInternal({ minimal: true, currency: options?.currency });
      },
      paginated: async (options?: {
        page?: number;
        limit?: number;
        currency?: CurrencyCode;
      }): Promise<MinimalProduct[] | null> => {
        return paginatedInternal({
          page: options?.page,
          limit: options?.limit,
          currency: options?.currency,
          minimal: true,
        });
      },
      find: async (
        productHandle: string,
        options?: { currency?: CurrencyCode }
      ): Promise<MinimalProduct | null> => {
        return findInternal(productHandle, {
          minimal: true,
          currency: options?.currency,
        });
      },
      findEnhanced: async (
        productHandle: string,
        options: { apiKey: string; updatedAt: string; endpoint?: string }
      ): Promise<EnhancedProductResponse<MinimalProduct> | null> => {
        return findEnhancedMinimalInternal(productHandle, options);
      },
      showcased: async (): Promise<MinimalProduct[]> => {
        const res = await operations.showcase.minimal();
        return (res || []) as MinimalProduct[];
      },
      predictiveSearch: async (
        query: string,
        options?: {
          limit?: number;
          locale?: string;
          currency?: CurrencyCode;
          unavailableProducts?: "show" | "hide" | "last";
        }
      ): Promise<MinimalProduct[]> => {
        return predictiveSearchInternal(query, {
          limit: options?.limit,
          locale: options?.locale,
          currency: options?.currency,
          unavailableProducts: options?.unavailableProducts,
          minimal: true,
        }) as Promise<MinimalProduct[]>;
      },
      recommendations: async (
        productId: number,
        options?: {
          limit?: number;
          intent?: "related" | "complementary";
          locale?: string;
          currency?: CurrencyCode;
        }
      ): Promise<MinimalProduct[] | null> => {
        return recommendationsInternal(productId, {
          limit: options?.limit,
          intent: options?.intent,
          locale: options?.locale,
          currency: options?.currency,
          minimal: true,
        }) as Promise<MinimalProduct[] | null>;
      },
    },
    showcase: {
      minimal: async (): Promise<MinimalProduct[]> => {
        const storeInfo = await getStoreInfo();
        const normalizedHandles = storeInfo.showcase.products
          .map((h: string) => h.split("?")[0]?.replace(/^\/|\/$/g, ""))
          .filter((base): base is string => Boolean(base));
        const seen = new Set<string>();
        const uniqueHandles: string[] = [];
        for (const base of normalizedHandles) {
          if (seen.has(base)) continue;
          seen.add(base);
          uniqueHandles.push(base);
        }
        const products = await Promise.all(
          uniqueHandles.map((productHandle: string) =>
            findInternal(productHandle, { minimal: true })
          )
        );
        return filter(products, isNonNullish) as MinimalProduct[];
      },
    },
  };

  return operations;
}
