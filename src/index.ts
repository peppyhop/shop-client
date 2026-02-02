import { determineStoreTypeForStore } from "./ai/determine-store-type";
import type { CheckoutOperations } from "./checkout";
import { createCheckoutOperations } from "./checkout";
import { getInfoForShop } from "./client/get-info";
import type { CollectionOperations } from "./collections";
import { createCollectionOperations } from "./collections";
import { collectionsDto as dtoCollections } from "./dto/collections.dto";
import { mapProductDto, mapProductsDto } from "./dto/products.mapped";
import type { ProductOperations } from "./products";
import { createProductOperations } from "./products";
import type { OpenGraphMeta, ShopInfo, ShopOperations } from "./store";
import { createShopOperations } from "./store";
import type {
  Collection,
  CollectionColumnsConfig,
  OpenRouterConfig,
  ProductColumnsConfig,
  ProductColumnsMode,
  ProductImagesMode,
  ProductOptionsMode,
  ProductResult,
  ShopifyCollection,
  ShopifyProduct,
  ShopifySingleProduct,
  StoreTypeBreakdown,
} from "./types";
import { generateStoreSlug } from "./utils/func";
import { rateLimitedFetch } from "./utils/rate-limit";

/**
 * A comprehensive Shopify store client for fetching products, collections, and store information.
 *
 * @example
 * ```typescript
 * import { ShopClient } from 'shop-client';
 *
 * const shop = new ShopClient('https://exampleshop.com');
 *
 * // Fetch all products
 * const products = await shop.products.all();
 *
 * // Get store information
 * const storeInfo = await shop.getInfo();
 * ```
 */
export type ShopClientOptions = {
  cacheTTL?: number;
  openRouter?: OpenRouterConfig;
  productColumns?: ProductColumnsConfig;
  collectionColumns?: CollectionColumnsConfig;
};

export class ShopClient {
  private storeDomain: string;
  private baseUrl: string;
  private storeSlug: string;
  private openRouter?: OpenRouterConfig;
  private validationCache: Map<string, boolean> = new Map();
  private cacheExpiry: number = 5 * 60 * 1000; // 5 minutes
  private cacheTimestamps: Map<string, number> = new Map();
  private normalizeImageUrlCache: Map<string, string> = new Map();
  private storeCurrency?: string;
  private infoCacheValue?: ShopInfo;
  private infoCacheTimestamp?: number;
  private infoInFlight?: Promise<ShopInfo>;
  private metaCacheValue?: OpenGraphMeta;
  private metaCacheTimestamp?: number;
  private metaInFlight?: Promise<OpenGraphMeta>;
  private productColumns: ProductColumnsConfig = {
    mode: "minimal",
    images: "minimal",
    options: "minimal",
  };
  private collectionColumns?: CollectionColumnsConfig;

  // Public operations interfaces
  public products: ProductOperations;
  public collections: CollectionOperations;
  public checkout: CheckoutOperations;
  public shopOperations: ShopOperations;

  /**
   * Creates a new ShopClient instance for interacting with a Shopify store.
   *
   * @param urlPath - The Shopify store URL (e.g., 'https://exampleshop.com' or 'exampleshop.com')
   *
   * @throws {Error} When the URL is invalid or contains malicious patterns
   *
   * @example
   * ```typescript
   * // With full URL
   * const shop = new ShopClient('https://exampleshop.com');
   *
   * // Without protocol (automatically adds https://)
   * const shop = new ShopClient('exampleshop.com');
   *
   * // Works with any Shopify store domain
   * const shop1 = new ShopClient('https://example.myshopify.com');
   * const shop2 = new ShopClient('https://boutique.fashion');
   * ```
   */
  constructor(urlPath: string, options?: ShopClientOptions) {
    // Validate input URL
    if (!urlPath || typeof urlPath !== "string") {
      throw new Error("Store URL is required and must be a string");
    }

    // Sanitize and validate URL
    let normalizedUrl = urlPath.trim();
    if (
      !normalizedUrl.startsWith("http://") &&
      !normalizedUrl.startsWith("https://")
    ) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    let storeUrl: URL;
    try {
      storeUrl = new URL(normalizedUrl);
    } catch (_error) {
      throw new Error("Invalid store URL format");
    }

    // Validate domain format (basic check for Shopify domains)
    const hostname = storeUrl.hostname;
    if (!hostname || hostname.length < 3) {
      throw new Error("Invalid domain name");
    }

    // Check for potentially malicious patterns
    if (
      hostname.includes("..") ||
      hostname.includes("//") ||
      hostname.includes("@")
    ) {
      throw new Error("Invalid characters in domain name");
    }

    // Validate domain structure - must contain at least one dot for TLD
    if (
      !hostname.includes(".") ||
      hostname.startsWith(".") ||
      hostname.endsWith(".")
    ) {
      throw new Error(
        "Invalid domain format - must be a valid domain with TLD"
      );
    }

    // Check for valid domain pattern (basic regex)
    const domainPattern =
      /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    if (!domainPattern.test(hostname)) {
      throw new Error("Invalid domain format");
    }

    this.storeDomain = `https://${hostname}`;
    let fetchUrl = `https://${hostname}${storeUrl.pathname}`;
    if (!fetchUrl.endsWith("/")) {
      fetchUrl = `${fetchUrl}/`;
    }
    this.baseUrl = fetchUrl;

    // Pre-calculate store slug once
    this.storeSlug = generateStoreSlug(this.storeDomain);

    // Apply configuration
    if (typeof options?.cacheTTL === "number" && options.cacheTTL > 0) {
      this.cacheExpiry = options.cacheTTL;
    }
    this.openRouter = options?.openRouter;
    if (options?.productColumns) {
      this.productColumns = {
        mode: options.productColumns.mode ?? this.productColumns.mode,
        images: options.productColumns.images ?? this.productColumns.images,
        options: options.productColumns.options ?? this.productColumns.options,
      };
    }
    if (options?.collectionColumns) {
      this.collectionColumns = options.collectionColumns;
    }

    // Initialize operations
    this.shopOperations = createShopOperations({
      baseUrl: this.baseUrl,
      storeDomain: this.storeDomain,
      validateProductExists: this.validateProductExists.bind(this),
      validateCollectionExists: this.validateCollectionExists.bind(this),
      validateLinksInBatches: this.validateLinksInBatches.bind(this),
      handleFetchError: this.handleFetchError.bind(this),
    });

    this.products = createProductOperations(
      this.baseUrl,
      this.storeDomain,
      this.fetchProducts.bind(this),
      this.productsDto.bind(this),
      this.productDto.bind(this),
      () => this.getInfo(),
      (handle: string) => this.products.find(handle),
      () => this.productColumns,
      { openRouter: this.openRouter }
    );

    this.collections = createCollectionOperations(
      this.baseUrl,
      this.storeDomain,
      this.fetchCollections.bind(this),
      this.collectionsDto.bind(this),
      this.fetchPaginatedProductsFromCollection.bind(this),
      () => this.getInfo(),
      (handle: string) => this.collections.find(handle)
    );

    this.checkout = createCheckoutOperations(this.baseUrl);
  }

  /**
   * Optimized image URL normalization with caching
   */
  private normalizeImageUrl(url?: string | null): string {
    if (!url) {
      return "";
    }

    if (this.normalizeImageUrlCache.has(url)) {
      return this.normalizeImageUrlCache.get(url)!;
    }

    const normalized = url.startsWith("//") ? `https:${url}` : url;
    this.normalizeImageUrlCache.set(url, normalized);
    return normalized;
  }

  /**
   * Format a price amount (in cents) using the store currency.
   */
  private formatPrice(amountInCents: number): string {
    const currency = this.storeCurrency ?? "USD";
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency,
      }).format((amountInCents || 0) / 100);
    } catch {
      const val = (amountInCents || 0) / 100;
      return `${val} ${currency}`;
    }
  }

  /**
   * Transform Shopify products to our Product format
   */
  productsDto<
    C extends ProductColumnsMode = "minimal",
    I extends ProductImagesMode = "minimal",
    O extends ProductOptionsMode = "minimal",
  >(
    products: ShopifyProduct[],
    options?: { columns?: ProductColumnsConfig<C, I, O> }
  ): ProductResult<C, I, O>[] | null {
    return mapProductsDto<C, I, O>(
      products,
      {
        storeDomain: this.storeDomain,
        storeSlug: this.storeSlug,
        currency: this.storeCurrency ?? "USD",
        normalizeImageUrl: (url) => this.normalizeImageUrl(url),
        formatPrice: (amount) => this.formatPrice(amount),
      },
      {
        columns:
          options?.columns ??
          (this.productColumns as unknown as ProductColumnsConfig<C, I, O>),
      }
    );
  }

  productDto<
    C extends ProductColumnsMode = "minimal",
    I extends ProductImagesMode = "minimal",
    O extends ProductOptionsMode = "minimal",
  >(
    product: ShopifySingleProduct,
    options?: { columns?: ProductColumnsConfig<C, I, O> }
  ): ProductResult<C, I, O> {
    return mapProductDto<C, I, O>(
      product,
      {
        storeDomain: this.storeDomain,
        storeSlug: this.storeSlug,
        currency: this.storeCurrency ?? "USD",
        normalizeImageUrl: (url) => this.normalizeImageUrl(url),
        formatPrice: (amount) => this.formatPrice(amount),
      },
      {
        columns:
          options?.columns ??
          (this.productColumns as unknown as ProductColumnsConfig<C, I, O>),
      }
    );
  }

  collectionsDto(collections: ShopifyCollection[]): Collection[] {
    return dtoCollections(collections) ?? [];
  }

  /**
   * Enhanced error handling with context
   */
  private handleFetchError(
    error: unknown,
    context: string,
    url: string
  ): never {
    type EnhancedError = Error & {
      context: string;
      url: string;
      statusCode?: number;
      originalError: unknown;
    };

    const getStatus = (err: unknown): number | undefined => {
      if (!err || typeof err !== "object") return undefined;
      const rec = err as Record<string, unknown>;
      const status = rec.status;
      return typeof status === "number" ? status : undefined;
    };

    let errorMessage = `Error ${context}`;
    let statusCode: number | undefined;

    if (error instanceof Error) {
      errorMessage += `: ${error.message}`;
      // Check if it's a fetch error with response-like status
      statusCode = getStatus(error);
    } else if (typeof error === "string") {
      errorMessage += `: ${error}`;
    } else {
      errorMessage += ": Unknown error occurred";
    }

    // Add URL context for debugging
    errorMessage += ` (URL: ${url})`;

    if (statusCode) {
      // Add status code if available
      errorMessage += ` (Status: ${statusCode})`;
    }

    // Create enhanced error with additional properties
    const enhancedError: EnhancedError = Object.assign(
      new Error(errorMessage),
      {
        context,
        url,
        statusCode,
        originalError: error,
      }
    );

    throw enhancedError;
  }

  /**
   * Fetch products with pagination
   */
  private async fetchProducts<
    C extends ProductColumnsMode = "minimal",
    I extends ProductImagesMode = "minimal",
    O extends ProductOptionsMode = "minimal",
  >(
    page: number,
    limit: number,
    options?: { columns?: ProductColumnsConfig<C, I, O> }
  ): Promise<ProductResult<C, I, O>[] | null> {
    try {
      const url = `${this.baseUrl}products.json?page=${page}&limit=${limit}`;
      const response = await rateLimitedFetch(url, {
        rateLimitClass: "products:list",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: { products: ShopifyProduct[] } = await response.json();
      const rawProducts = Array.isArray(data.products) ? data.products : [];
      const filteredRawProducts = rawProducts.filter(
        (p) => !this.isGiftCardProductType((p as any).product_type)
      );
      return this.productsDto<C, I, O>(filteredRawProducts, {
        columns:
          options?.columns ??
          (this.productColumns as unknown as ProductColumnsConfig<C, I, O>),
      });
    } catch (error) {
      this.handleFetchError(
        error,
        "fetching products",
        `${this.baseUrl}products.json`
      );
    }
  }

  /**
   * Fetch collections with pagination
   */
  private async fetchCollections(page: number, limit: number) {
    try {
      const url = `${this.baseUrl}collections.json?page=${page}&limit=${limit}`;
      const response = await rateLimitedFetch(url, {
        rateLimitClass: "collections:list",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return this.collectionsDto(data.collections);
    } catch (error) {
      this.handleFetchError(
        error,
        "fetching collections",
        `${this.baseUrl}collections.json`
      );
    }
  }

  /**
   * Fetch paginated products from a specific collection
   */
  private async fetchPaginatedProductsFromCollection<
    C extends ProductColumnsMode = "minimal",
    I extends ProductImagesMode = "minimal",
    O extends ProductOptionsMode = "minimal",
  >(
    collectionHandle: string,
    options: {
      page?: number;
      limit?: number;
      columns?: ProductColumnsConfig<C, I, O>;
    } = {}
  ): Promise<ProductResult<C, I, O>[] | null> {
    try {
      const { page = 1, limit = 250 } = options;
      // Resolve canonical collection handle via HTML redirect if handle has changed
      let finalHandle = collectionHandle;
      try {
        const htmlResp = await rateLimitedFetch(
          `${this.baseUrl}collections/${encodeURIComponent(collectionHandle)}`,
          { rateLimitClass: "collections:resolve" }
        );
        if (htmlResp.ok) {
          const finalUrl = htmlResp.url;
          if (finalUrl) {
            const pathname = new URL(finalUrl).pathname.replace(/\/$/, "");
            const parts = pathname.split("/").filter(Boolean);
            const idx = parts.indexOf("collections");
            const maybeHandle = idx >= 0 ? parts[idx + 1] : undefined;
            if (typeof maybeHandle === "string" && maybeHandle.length) {
              finalHandle = maybeHandle;
            }
          }
        }
      } catch {
        // Ignore redirect resolution errors and proceed with original handle
      }

      const url = `${this.baseUrl}collections/${finalHandle}/products.json?page=${page}&limit=${limit}`;
      const response = await rateLimitedFetch(url, {
        rateLimitClass: "collections:items",
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null; // Collection not found
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: { products: ShopifyProduct[] } = await response.json();
      const rawProducts = Array.isArray(data.products) ? data.products : [];
      const filteredRawProducts = rawProducts.filter(
        (p) => !this.isGiftCardProductType((p as any).product_type)
      );
      return this.productsDto<C, I, O>(filteredRawProducts, {
        columns:
          options?.columns ??
          (this.productColumns as unknown as ProductColumnsConfig<C, I, O>),
      });
    } catch (error) {
      this.handleFetchError(
        error,
        "fetching products from collection",
        `${this.baseUrl}collections/${collectionHandle}/products.json`
      );
    }
  }

  private isGiftCardProductType(value: unknown): boolean {
    if (typeof value !== "string") return false;
    const s = value.trim().toLowerCase();
    if (!s) return false;
    if (s === "gift card" || s === "giftcard") return true;
    return s.includes("gift card") || s.includes("giftcard");
  }

  /**
   * Validate if a product exists (with caching)
   */
  private async validateProductExists(handle: string): Promise<boolean> {
    const cacheKey = `product:${handle}`;

    if (this.isCacheValid(cacheKey)) {
      return this.validationCache.get(cacheKey) || false;
    }

    try {
      const url = `${this.baseUrl}products/${handle}.js`;
      const response = await rateLimitedFetch(url, {
        method: "HEAD",
        rateLimitClass: "validate:product",
        timeoutMs: 5000,
      });
      const exists = response.ok;

      this.setCacheValue(cacheKey, exists);
      return exists;
    } catch (_error) {
      this.setCacheValue(cacheKey, false);
      return false;
    }
  }

  /**
   * Validate if a collection exists (with caching)
   */
  private async validateCollectionExists(handle: string): Promise<boolean> {
    const cacheKey = `collection:${handle}`;

    if (this.isCacheValid(cacheKey)) {
      return this.validationCache.get(cacheKey) || false;
    }

    try {
      const url = `${this.baseUrl}collections/${handle}.json`;
      const response = await rateLimitedFetch(url, {
        method: "HEAD",
        rateLimitClass: "validate:collection",
        timeoutMs: 5000,
      });
      const exists = response.ok;

      this.setCacheValue(cacheKey, exists);
      return exists;
    } catch (_error) {
      this.setCacheValue(cacheKey, false);
      return false;
    }
  }

  /**
   * Check if cache entry is still valid
   */
  private isCacheValid(key: string): boolean {
    const timestamp = this.cacheTimestamps.get(key);
    if (!timestamp) return false;

    return Date.now() - timestamp < this.cacheExpiry;
  }

  /**
   * Set cache value with timestamp
   */
  private setCacheValue(key: string, value: boolean): void {
    this.validationCache.set(key, value);
    this.cacheTimestamps.set(key, Date.now());
  }

  /**
   * Validate links in batches to avoid overwhelming the server
   */
  private async validateLinksInBatches<T>(
    items: T[],
    validator: (_item: T) => Promise<boolean>,
    batchSize = 10
  ): Promise<T[]> {
    const validItems: T[] = [];

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const validationPromises = batch.map(async (item) => {
        const isValid = await validator(item);
        return isValid ? item : null;
      });

      const results = await Promise.all(validationPromises);
      const validBatchItems = results.filter(
        (item): item is NonNullable<typeof item> => item !== null
      );
      validItems.push(...validBatchItems);

      // Add small delay between batches to be respectful
      if (i + batchSize < items.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    return validItems;
  }

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
  /**
   * Optionally bypass cache and force a fresh fetch.
   *
   * @param options - `{ force?: boolean }` when `true`, ignores cached value and TTL.
   */
  async getInfo(options?: {
    force?: boolean;
    validateShowcase?: boolean;
    validationBatchSize?: number;
  }): Promise<ShopInfo> {
    try {
      // If force is requested, clear local cache to bypass freshness check
      if (options?.force === true) {
        this.clearInfoCache();
      }
      // Return cached info if fresh
      if (
        this.infoCacheValue &&
        this.infoCacheTimestamp !== undefined &&
        Date.now() - this.infoCacheTimestamp < this.cacheExpiry
      ) {
        return this.infoCacheValue;
      }

      // If a request is already in-flight, reuse it to avoid duplicate network calls
      if (this.infoInFlight) {
        return await this.infoInFlight;
      }
      // Create a single shared promise for the network request
      this.infoInFlight = (async () => {
        const { info, currencyCode } = await getInfoForShop(
          {
            baseUrl: this.baseUrl,
            storeDomain: this.storeDomain,
            validateProductExists: (handle: string) =>
              this.validateProductExists(handle),
            validateCollectionExists: (handle: string) =>
              this.validateCollectionExists(handle),
            validateLinksInBatches: <T>(
              items: T[],
              validator: (item: T) => Promise<boolean>,
              batchSize?: number
            ) => this.validateLinksInBatches(items, validator, batchSize),
          },
          {
            validateShowcase: options?.validateShowcase === true,
            validationBatchSize: options?.validationBatchSize,
          }
        );
        if (typeof currencyCode === "string") {
          this.storeCurrency = currencyCode;
        }
        // Cache the info for a short duration
        this.infoCacheValue = info;
        this.infoCacheTimestamp = Date.now();
        return info;
      })();

      try {
        const result = await this.infoInFlight;
        return result;
      } finally {
        // Clear in-flight marker once resolved or rejected
        this.infoInFlight = undefined;
      }
    } catch (error: unknown) {
      throw this.handleFetchError(error, "fetching store info", this.baseUrl);
    }
  }

  /**
   * Manually clear the cached store info.
   * The next call to `getInfo()` will fetch fresh data regardless of TTL.
   */
  clearInfoCache(): void {
    this.infoCacheValue = undefined;
    this.infoCacheTimestamp = undefined;
    // Intentionally do not cancel or modify in-flight request.
    // If a fetch is already in progress, it will populate fresh cache on completion.
  }

  /**
   * Fetch OpenGraph metadata from the store homepage.
   * Returns only `og:*` fields without additional parsing or validation.
   */
  async getMetaData(options?: { force?: boolean }): Promise<OpenGraphMeta> {
    try {
      if (options?.force === true) {
        this.metaCacheValue = undefined;
        this.metaCacheTimestamp = undefined;
      }
      if (
        this.metaCacheValue &&
        this.metaCacheTimestamp !== undefined &&
        Date.now() - this.metaCacheTimestamp < this.cacheExpiry
      ) {
        return this.metaCacheValue;
      }
      if (this.metaInFlight) {
        return await this.metaInFlight;
      }
      this.metaInFlight = (async () => {
        const meta = await this.shopOperations.getMetaData();
        this.metaCacheValue = meta;
        this.metaCacheTimestamp = Date.now();
        return meta;
      })();
      try {
        const result = await this.metaInFlight;
        return result;
      } finally {
        this.metaInFlight = undefined;
      }
    } catch (error: unknown) {
      throw this.handleFetchError(
        error,
        "fetching store metadata",
        this.baseUrl
      );
    }
  }

  async getJsonLd() {
    try {
      return await this.shopOperations.getJsonLd();
    } catch (error: unknown) {
      throw this.handleFetchError(
        error,
        "fetching store JSON-LD",
        this.baseUrl
      );
    }
  }

  async getHeaderLinks(): Promise<string[]> {
    try {
      return await this.shopOperations.getHeaderLinks();
    } catch (error: unknown) {
      throw this.handleFetchError(error, "fetching header links", this.baseUrl);
    }
  }

  /**
   * Determine the store's primary vertical and target audience.
   * Uses `getInfo()` internally; no input required.
   */
  async determineStoreType(options?: {
    apiKey?: string;
    model?: string;
    maxShowcaseProducts?: number;
    maxShowcaseCollections?: number;
  }): Promise<StoreTypeBreakdown> {
    try {
      const openRouter = this.openRouter;
      const breakdown = await determineStoreTypeForStore({
        baseUrl: this.baseUrl,
        getInfo: () => this.getInfo(),
        findProduct: (handle: string) => this.products.find(handle),
        apiKey: options?.apiKey,
        model: options?.model,
        openRouter,
        maxShowcaseProducts: options?.maxShowcaseProducts,
        maxShowcaseCollections: options?.maxShowcaseCollections,
      });
      return breakdown;
    } catch (error: unknown) {
      throw this.handleFetchError(error, "determineStoreType", this.baseUrl);
    }
  }
}

export { classifyProduct, generateSEOContent } from "./ai/enrich";
export type { CheckoutOperations } from "./checkout";
export type { CollectionOperations } from "./collections";
// Export operation interfaces
export type { ProductOperations } from "./products";
export * as schemas from "./schemas";
export type { OpenGraphMeta, ShopInfo, ShopOperations } from "./store";
// Export selected types for external use (excluding Shopify-prefixed types)
export type {
  Collection,
  CountryDetectionResult,
  CountryScores,
  CurrencyCode,
  LocalizedPricing,
  MetaTag,
  OpenRouterConfig,
  Product,
  ProductImage,
  ProductOption,
  ProductVariant,
  ProductVariantImage,
  StoreTypeBreakdown,
} from "./types";
export { detectShopCountry } from "./utils/detect-country";
// Export utility functions
export {
  buildVariantKey,
  calculateDiscount,
  extractDomainWithoutSuffix,
  generateStoreSlug,
  genProductSlug,
  safeParseDate,
  sanitizeDomain,
} from "./utils/func";
export { configureRateLimit } from "./utils/rate-limit";
