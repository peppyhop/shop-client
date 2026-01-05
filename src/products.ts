import { filter, isNonNullish } from "remeda";
// Heavy AI enrich utilities are lazy-loaded where needed to keep base bundle light
import type { ShopInfo } from "./store";
import type {
  CurrencyCode,
  EnhancedProductResponse,
  OpenRouterConfig,
  Product,
  ProductClassification,
  ProductColumnsConfig,
  ProductResult,
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
  all(options?: {
    currency?: CurrencyCode;
    columns?: ProductColumnsConfig;
  }): Promise<ProductResult[] | null>;

  /**
   * Fetches products with pagination support.
   */
  paginated(options?: {
    page?: number;
    limit?: number;
    currency?: CurrencyCode;
    columns?: ProductColumnsConfig;
  }): Promise<ProductResult[] | null>;

  /**
   * Finds a specific product by its handle.
   */
  find(
    productHandle: string,
    options?: { currency?: CurrencyCode; columns?: ProductColumnsConfig }
  ): Promise<ProductResult | null>;

  /**
   * Finds a product and enhances it with AI-generated content using an external service.
   *
   * @param productHandle - The handle of the product to find.
   * @param options - Options for the request.
   * @param options.apiKey - API key for the enhancement service. Required for authentication via x-api-key header.
   * @param options.updatedAt - Optional product updatedAt timestamp used to cache-bust/invalidate enrichment.
   * @param options.endpoint - Optional custom endpoint URL for the enhancement service. Defaults to the standard worker URL.
   */
  findEnhanced(
    productHandle: string,
    options: {
      apiKey: string;
      updatedAt?: string;
      endpoint?: string;
      columns?: ProductColumnsConfig;
    }
  ): Promise<EnhancedProductResponse<ProductResult> | null>;

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
  showcased(options?: {
    columns?: ProductColumnsConfig;
  }): Promise<ProductResult[]>;

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
      columns?: ProductColumnsConfig;
    }
  ): Promise<ProductResult[]>;

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
      columns?: ProductColumnsConfig;
    }
  ): Promise<ProductResult[] | null>;
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
    options?: { columns?: ProductColumnsConfig }
  ) => Promise<ProductResult[] | null>,
  productsDto: (
    products: ShopifyProduct[],
    options?: { columns?: ProductColumnsConfig }
  ) => ProductResult[] | null,
  productDto: (
    product: ShopifySingleProduct,
    options?: { columns?: ProductColumnsConfig }
  ) => ProductResult,
  getStoreInfo: () => Promise<ShopInfo>,
  _findProduct: (
    handle: string,
    options?: { columns?: ProductColumnsConfig }
  ) => Promise<ProductResult | null>,
  getDefaultProductColumns: () => ProductColumnsConfig,
  ai?: { openRouter?: OpenRouterConfig }
): ProductOperations {
  // Use shared formatter from utils
  const cacheExpiryMs = 5 * 60 * 1000; // 5 minutes
  const findCache = new Map<
    string,
    { ts: number; value: ProductResult | null }
  >();
  const getCached = (key: string): ProductResult | null | undefined => {
    const entry = findCache.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.ts < cacheExpiryMs) return entry.value;
    findCache.delete(key);
    return undefined;
  };
  const setCached = (key: string, value: ProductResult | null) => {
    findCache.set(key, { ts: Date.now(), value });
  };

  function applyCurrencyOverride(
    product: ProductResult,
    currency: CurrencyCode
  ): ProductResult {
    if ("priceMin" in product) {
      const p = product as any;
      const priceMin =
        typeof p.priceMin === "number" ? p.priceMin : (p.price ?? 0);
      const priceMax =
        typeof p.priceMax === "number" ? p.priceMax : (p.price ?? 0);
      const compareAtMin =
        typeof p.compareAtPriceMin === "number"
          ? p.compareAtPriceMin
          : (p.compareAtPrice ?? 0);
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
      } as ProductResult;
    }

    const compareAtPrice = (product as any).compareAtPrice ?? 0;
    return {
      ...product,
      localizedPricing: {
        priceFormatted: formatPrice((product as any).price ?? 0, currency),
        compareAtPriceFormatted: formatPrice(compareAtPrice, currency),
      },
    } as ProductResult;
  }

  function maybeOverrideProductsCurrency(
    products: ProductResult[] | null,
    currency?: CurrencyCode
  ): ProductResult[] | null {
    if (!products || !currency || products.length === 0) return products;
    return products.map((p) => applyCurrencyOverride(p, currency));
  }

  const resolveColumns = (
    override?: ProductColumnsConfig
  ): ProductColumnsConfig => {
    const base = getDefaultProductColumns() || {};
    return {
      mode: override?.mode ?? base.mode ?? "minimal",
      images: override?.images ?? base.images ?? "minimal",
      options: override?.options ?? base.options ?? "minimal",
    };
  };

  async function allInternal(options: {
    currency?: CurrencyCode;
    columns?: ProductColumnsConfig;
  }): Promise<ProductResult[] | null> {
    const limit = 250;
    const allProducts: ProductResult[] = [];
    const columns = resolveColumns(options.columns);

    async function fetchAll() {
      let currentPage = 1;

      while (true) {
        const products = await fetchProducts(currentPage, limit, {
          columns,
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
      return allProducts;
    }

    try {
      const products = await fetchAll();
      return maybeOverrideProductsCurrency(products, options.currency);
    } catch (error) {
      console.error("Failed to fetch all products:", storeDomain, error);
      throw error;
    }
  }

  async function paginatedInternal(options: {
    page?: number;
    limit?: number;
    currency?: CurrencyCode;
    columns?: ProductColumnsConfig;
  }): Promise<ProductResult[] | null> {
    const page = options.page ?? 1;
    const limit = Math.min(options.limit ?? 250, 250);
    const columns = resolveColumns(options.columns);
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
        columns,
      });
      return maybeOverrideProductsCurrency(
        (normalized as ProductResult[] | null) || null,
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

  async function findInternal(
    productHandle: string,
    options: { currency?: CurrencyCode; columns?: ProductColumnsConfig }
  ): Promise<ProductResult | null> {
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

      const columns = resolveColumns(options.columns);
      const cacheKey = `${sanitizedHandle}|${columns.mode}|${columns.images}|${columns.options}`;
      const cached = getCached(cacheKey) as unknown as
        | ProductResult
        | null
        | undefined;
      if (typeof cached !== "undefined") {
        if (!cached || !options.currency) return cached;
        return applyCurrencyOverride(cached, options.currency);
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
      const productData = productDto(product, { columns });

      setCached(cacheKey, productData as any);
      if (finalHandle !== sanitizedHandle) {
        const finalKey = `${finalHandle}|${columns.mode}|${columns.images}|${columns.options}`;
        setCached(finalKey, productData as any);
      }
      return options.currency
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
  }

  async function predictiveSearchInternal(
    query: string,
    options: {
      limit?: number;
      locale?: string;
      currency?: CurrencyCode;
      unavailableProducts?: "show" | "hide" | "last";
      columns?: ProductColumnsConfig;
    }
  ): Promise<ProductResult[]> {
    if (!query || typeof query !== "string") {
      throw new Error("Query is required and must be a string");
    }
    const limit = Math.max(1, Math.min(options.limit ?? 10, 10));
    const columns = resolveColumns(options.columns);
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
      handles.map((h) => findInternal(h, { columns }))
    );
    const results = filter(fetched, isNonNullish);
    return (
      maybeOverrideProductsCurrency(
        results as ProductResult[],
        options.currency
      ) ?? []
    );
  }

  async function recommendationsInternal(
    productId: number,
    options: {
      limit?: number;
      intent?: "related" | "complementary";
      locale?: string;
      currency?: CurrencyCode;
      columns?: ProductColumnsConfig;
    }
  ): Promise<ProductResult[] | null> {
    if (!Number.isFinite(productId) || productId <= 0) {
      throw new Error("Valid productId is required");
    }
    const limit = Math.max(1, Math.min(options.limit ?? 10, 10));
    const intent = options.intent ?? "related";
    const columns = resolveColumns(options.columns);
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
    const normalized = productsDto(productsArray, { columns }) || [];
    return maybeOverrideProductsCurrency(
      normalized as ProductResult[],
      options.currency
    );
  }

  /**
   * Internal implementation of findEnhanced.
   *
   * @param productHandle - The handle of the product to find.
   * @param options - Options for the request.
   * @param options.apiKey - API key for the enhancement service. Required for authentication via x-api-key header.
   * @param options.updatedAt - Optional product updatedAt timestamp used to cache-bust/invalidate enrichment.
   * @param options.endpoint - Optional custom endpoint URL for the enhancement service. Defaults to the standard worker URL.
   */
  async function findEnhancedInternal(
    productHandle: string,
    options: {
      apiKey: string;
      updatedAt?: string;
      endpoint?: string;
      columns?: ProductColumnsConfig;
    }
  ): Promise<EnhancedProductResponse<ProductResult> | null> {
    const apiKey = options.apiKey;
    if (!apiKey || typeof apiKey !== "string" || !apiKey.trim()) {
      throw new Error("apiKey is required");
    }

    const updatedAt = (options as any).updatedAt as unknown;
    let updatedAtTrimmed: string | undefined;
    if (typeof updatedAt === "string") {
      const trimmed = updatedAt.trim();
      updatedAtTrimmed = trimmed ? trimmed : undefined;
    } else if (updatedAt != null) {
      throw new Error("updatedAt must be a string");
    }

    const columns = resolveColumns(options.columns);
    const baseProduct = await findInternal(productHandle, { columns });
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

    let resolvedHandle = productHandle;
    try {
      const base = (productHandle.split("?")[0] ?? productHandle).trim();
      const sanitized = base.replace(/[^a-zA-Z0-9\-_]/g, "");
      if (sanitized) {
        resolvedHandle = sanitized;
        const htmlResp = await rateLimitedFetch(
          `${baseUrl}products/${encodeURIComponent(sanitized)}`,
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
              resolvedHandle = maybeHandle;
            }
          }
        }
      }
    } catch {}

    const resp = await rateLimitedFetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        storeDomain: hostname,
        handle: resolvedHandle,
        ...(updatedAtTrimmed ? { updatedAt: updatedAtTrimmed } : {}),
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
    let mappedProduct: ProductResult = baseProduct;
    try {
      const raw = parsed.shopify;
      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        if ("body_html" in raw) {
          const mapped = productsDto([raw as ShopifyProduct], {
            columns,
          });
          const first = Array.isArray(mapped) ? mapped[0] : null;
          if (first) mappedProduct = first as ProductResult;
        } else if ("description" in raw) {
          mappedProduct = productDto(raw as ShopifySingleProduct, {
            columns,
          }) as ProductResult;
        }
      }
    } catch {}
    return {
      enrichment: parsed.enrichment,
      cache: parsed.cache,
      product: mappedProduct,
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
      columns?: ProductColumnsConfig;
    }): Promise<ProductResult[] | null> =>
      allInternal({
        currency: options?.currency,
        columns: options?.columns,
      }),

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
      columns?: ProductColumnsConfig;
    }): Promise<ProductResult[] | null> =>
      paginatedInternal({
        page: options?.page,
        limit: options?.limit,
        currency: options?.currency,
        columns: options?.columns,
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
      options?: { currency?: CurrencyCode; columns?: ProductColumnsConfig }
    ): Promise<ProductResult | null> =>
      findInternal(productHandle, {
        currency: options?.currency,
        columns: options?.columns,
      }),

    findEnhanced: async (
      productHandle: string,
      options: {
        apiKey: string;
        updatedAt?: string;
        endpoint?: string;
        columns?: ProductColumnsConfig;
      }
    ): Promise<EnhancedProductResponse<ProductResult> | null> =>
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

      const baseProduct = (await findInternal(productHandle, {
        columns: { mode: "full", images: "full", options: "full" },
      })) as Product | null;
      if (!baseProduct) return null;

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

      const baseProduct = (await findInternal(productHandle, {
        columns: { mode: "full", images: "full", options: "full" },
      })) as Product | null;
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

      const baseProduct = (await findInternal(productHandle, {
        columns: { mode: "full", images: "full", options: "full" },
      })) as Product | null;
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

      const baseProduct = (await findInternal(productHandle, {
        columns: { mode: "full", images: "full", options: "full" },
      })) as Product | null;
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

      const baseProduct = (await findInternal(productHandle, {
        columns: { mode: "full", images: "full", options: "full" },
      })) as Product | null;
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
    showcased: async (options?: {
      columns?: ProductColumnsConfig;
    }): Promise<ProductResult[]> => {
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
      const columns = resolveColumns(options?.columns);
      const products = await Promise.all(
        uniqueHandles.map((productHandle: string) =>
          findInternal(productHandle, {
            columns,
          })
        )
      );
      return filter(products, isNonNullish) as ProductResult[];
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
        const products = (await operations.all({
          columns: { mode: "full", images: "full", options: "full" },
        })) as Product[] | null;
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
        columns?: ProductColumnsConfig;
      }
    ): Promise<ProductResult[]> =>
      predictiveSearchInternal(query, {
        limit: options?.limit,
        locale: options?.locale,
        currency: options?.currency,
        unavailableProducts: options?.unavailableProducts,
        columns: options?.columns,
      }),

    recommendations: async (
      productId: number,
      options?: {
        limit?: number;
        intent?: "related" | "complementary";
        locale?: string;
        currency?: CurrencyCode;
        columns?: ProductColumnsConfig;
      }
    ): Promise<ProductResult[] | null> =>
      recommendationsInternal(productId, {
        limit: options?.limit,
        intent: options?.intent,
        locale: options?.locale,
        currency: options?.currency,
        columns: options?.columns,
      }),
  };

  return operations;
}
