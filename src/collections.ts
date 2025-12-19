import { filter, isNonNullish } from "remeda";
import type { ShopInfo } from "./store";
import type {
  Collection,
  CurrencyCode,
  Product,
  ShopifyCollection,
} from "./types";
import { formatPrice } from "./utils/func";
import { rateLimitedFetch } from "./utils/rate-limit";

/**
 * Interface for collection operations
 */
export interface CollectionOperations {
  /**
   * Fetches all collections from the store across all pages.
   */
  all(): Promise<Collection[]>;

  /**
   * Fetches collections with pagination support.
   *
   * @param options - Pagination options
   * @param options.page - Page number (default: 1)
   * @param options.limit - Number of collections per page (default: 10, max: 250)
   *
   * @returns {Promise<Collection[] | null>} Array of collections for the page or null if error occurs
   */
  paginated(options?: {
    page?: number;
    limit?: number;
  }): Promise<Collection[] | null>;

  /**
   * Finds a specific collection by its handle.
   */
  find(collectionHandle: string): Promise<Collection | null>;

  /**
   * Fetches collections that are showcased/featured on the store's homepage.
   */
  showcased(): Promise<Collection[]>;

  /**
   * Product-related methods for fetching products from specific collections.
   */
  products: {
    /**
     * Fetches products from a specific collection with pagination support.
     */
    paginated(
      collectionHandle: string,
      options?: { page?: number; limit?: number; currency?: CurrencyCode }
    ): Promise<Product[] | null>;

    /**
     * Fetches all products from a specific collection.
     */
    all(
      collectionHandle: string,
      options?: { currency?: CurrencyCode }
    ): Promise<Product[] | null>;
    /**
     * Fetches all product slugs from a specific collection.
     */
    slugs(collectionHandle: string): Promise<string[] | null>;
  };
}

/**
 * Creates collection operations for a store instance
 */
export function createCollectionOperations(
  baseUrl: string,
  storeDomain: string,
  fetchCollections: (
    page: number,
    limit: number
  ) => Promise<Collection[] | null>,
  collectionsDto: (collections: ShopifyCollection[]) => Collection[],
  fetchPaginatedProductsFromCollection: (
    collectionHandle: string,
    options?: { page?: number; limit?: number }
  ) => Promise<Product[] | null>,
  getStoreInfo: () => Promise<ShopInfo>,
  findCollection: (handle: string) => Promise<Collection | null>
): CollectionOperations {
  // Use shared formatter from utils
  const cacheExpiryMs = 5 * 60 * 1000; // 5 minutes
  const findCache = new Map<string, { ts: number; value: Collection | null }>();
  const getCached = (key: string): Collection | null | undefined => {
    const entry = findCache.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.ts < cacheExpiryMs) return entry.value;
    findCache.delete(key);
    return undefined;
  };
  const setCached = (key: string, value: Collection | null) => {
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

  return {
    /**
     * Fetches collections with pagination support.
     *
     * @param options - Pagination options
     * @param options.page - Page number (default: 1)
     * @param options.limit - Number of collections per page (default: 10, max: 250)
     *
     * @returns {Promise<Collection[] | null>} Collections for the requested page, or null on error
     */
    paginated: async (options?: {
      page?: number;
      limit?: number;
    }): Promise<Collection[] | null> => {
      const page = options?.page ?? 1;
      const limit = options?.limit ?? 10;

      if (page < 1 || limit < 1 || limit > 250) {
        throw new Error(
          "Invalid pagination parameters: page must be >= 1, limit must be between 1 and 250"
        );
      }

      try {
        const collections = await fetchCollections(page, limit);
        return collections ?? null;
      } catch (error) {
        console.error(
          "Failed to fetch paginated collections:",
          storeDomain,
          error
        );
        return null;
      }
    },
    /**
     * Fetches all collections from the store across all pages.
     *
     * @returns {Promise<Collection[]>} Array of all collections
     *
     * @throws {Error} When there's a network error or API failure
     *
     * @example
     * ```typescript
     * const shop = new ShopClient('https://exampleshop.com');
     * const allCollections = await shop.collections.all();
     *
     * console.log(`Found ${allCollections.length} collections`);
     * allCollections.forEach(collection => {
     *   console.log(collection.title, collection.handle);
     * });
     * ```
     */
    all: async (): Promise<Collection[]> => {
      const limit = 250;
      const allCollections: Collection[] = [];

      async function fetchAll() {
        let currentPage = 1;

        while (true) {
          const collections = await fetchCollections(currentPage, limit);

          if (
            !collections ||
            collections.length === 0 ||
            collections.length < limit
          ) {
            if (!collections) {
              console.warn(
                "fetchCollections returned null, treating as empty array."
              );
              break;
            }
            if (collections && collections.length > 0) {
              allCollections.push(...collections);
            }
            break;
          }

          allCollections.push(...collections);
          currentPage++;
        }
        return allCollections;
      }

      try {
        const collections = await fetchAll();
        return collections || [];
      } catch (error) {
        console.error("Failed to fetch all collections:", storeDomain, error);
        throw error;
      }
    },

    /**
     * Finds a specific collection by its handle.
     *
     * @param collectionHandle - The collection handle (URL slug) to search for
     *
     * @returns {Promise<Collection | null>} The collection if found, null if not found
     *
     * @throws {Error} When the handle is invalid or there's a network error
     *
     * @example
     * ```typescript
     * const shop = new ShopClient('https://example.myshopify.com');
     * const collection = await shop.collections.find('summer-collection');
     * if (collection) {
     *   console.log(collection.title); // "Summer Collection"
     * }
     * ```
     */
    find: async (collectionHandle: string): Promise<Collection | null> => {
      // Validate collection handle
      if (!collectionHandle || typeof collectionHandle !== "string") {
        throw new Error("Collection handle is required and must be a string");
      }

      // Sanitize handle - remove potentially dangerous characters
      const sanitizedHandle = collectionHandle
        .trim()
        .replace(/[^a-zA-Z0-9\-_]/g, "");
      if (!sanitizedHandle) {
        throw new Error("Invalid collection handle format");
      }

      // Check handle length (reasonable limits)
      if (sanitizedHandle.length > 255) {
        throw new Error("Collection handle is too long");
      }

      // Return cached value if present
      const cached = getCached(sanitizedHandle);
      if (typeof cached !== "undefined") {
        return cached;
      }

      try {
        const url = `${baseUrl}collections/${encodeURIComponent(sanitizedHandle)}.json`;
        const response = await rateLimitedFetch(url, {
          rateLimitClass: "collections:single",
        });

        if (!response.ok) {
          if (response.status === 404) {
            return null;
          }
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = (await response.json()) as {
          collection: ShopifyCollection;
        };

        let collectionImage = result.collection.image;
        if (!collectionImage) {
          const collectionProduct = (
            await fetchPaginatedProductsFromCollection(
              result.collection.handle,
              {
                limit: 1,
                page: 1,
              }
            )
          )?.at(0);
          const collectionProductImage = collectionProduct?.images?.[0];
          if (collectionProduct && collectionProductImage) {
            collectionImage = {
              id: collectionProductImage.id,
              src: collectionProductImage.src,
              alt: collectionProductImage.alt || collectionProduct.title,
              created_at:
                collectionProductImage.createdAt || new Date().toISOString(),
            };
          }
        }

        const collectionData = collectionsDto([
          {
            ...result.collection,
            image: collectionImage,
          },
        ]);
        const coll = collectionData[0] || null;
        // Cache under both original sanitized handle and resolved handle
        setCached(sanitizedHandle, coll);
        if (coll?.handle && coll.handle !== sanitizedHandle) {
          setCached(coll.handle, coll);
        }
        return coll;
      } catch (error) {
        if (error instanceof Error) {
          console.error(
            `Error fetching collection ${sanitizedHandle}:`,
            baseUrl,
            error.message
          );
        }
        throw error;
      }
    },

    /**
     * Fetches collections that are showcased/featured on the store's homepage.
     *
     * @returns {Promise<Collection[]>} Array of showcased collections found on the homepage
     *
     * @throws {Error} When there's a network error or API failure
     *
     * @example
     * ```typescript
     * const shop = new ShopClient('https://exampleshop.com');
     * const showcasedCollections = await shop.collections.showcased();
     *
     * console.log(`Found ${showcasedCollections.length} showcased collections`);
     * showcasedCollections.forEach(collection => {
     *   console.log(`Featured: ${collection.title} - ${collection.productsCount} products`);
     * });
     * ```
     */
    showcased: async () => {
      const storeInfo = await getStoreInfo();
      const collections = await Promise.all(
        storeInfo.showcase.collections.map((collectionHandle: string) =>
          findCollection(collectionHandle)
        )
      );
      return filter(collections, isNonNullish);
    },

    products: {
      /**
       * Fetches products from a specific collection with pagination support.
       *
       * @param collectionHandle - The collection handle to fetch products from
       * @param options - Pagination options
       * @param options.page - Page number (default: 1)
       * @param options.limit - Number of products per page (default: 250, max: 250)
       *
       * @returns {Promise<Product[] | null>} Array of products from the collection or null if error occurs
       *
       * @throws {Error} When the collection handle is invalid or there's a network error
       *
       * @example
       * ```typescript
       * const shop = new ShopClient('https://example.myshopify.com');
       *
       * // Get first page of products from a collection
       * const products = await shop.collections.products.paginated('summer-collection');
       *
       * // Get second page with custom limit
       * const moreProducts = await shop.collections.products.paginated(
       *   'summer-collection',
       *   { page: 2, limit: 50 }
       * );
       * ```
       */
      paginated: async (
        collectionHandle: string,
        options?: { page?: number; limit?: number; currency?: CurrencyCode }
      ) => {
        // Validate collection handle
        if (!collectionHandle || typeof collectionHandle !== "string") {
          throw new Error("Collection handle is required and must be a string");
        }
        // Sanitize handle - remove potentially dangerous characters
        const sanitizedHandle = collectionHandle
          .trim()
          .replace(/[^a-zA-Z0-9\-_]/g, "");

        if (!sanitizedHandle) {
          throw new Error("Invalid collection handle format");
        }

        if (sanitizedHandle.length > 255) {
          // Check handle length (reasonable limits)
          throw new Error("Collection handle is too long");
        }

        // Validate pagination options
        const page = options?.page ?? 1;
        const limit = options?.limit ?? 250;

        if (page < 1 || limit < 1 || limit > 250) {
          throw new Error(
            "Invalid pagination parameters: page must be >= 1, limit must be between 1 and 250"
          );
        }

        const products = await fetchPaginatedProductsFromCollection(
          sanitizedHandle,
          { page, limit }
        );
        return maybeOverrideProductsCurrency(products, options?.currency);
      },

      /**
       * Fetches all products from a specific collection.
       *
       * @param collectionHandle - The collection handle to fetch products from
       *
       * @returns {Promise<Product[] | null>} Array of all products from the collection or null if error occurs
       *
       * @throws {Error} When the collection handle is invalid or there's a network error
       *
       * @example
       * ```typescript
       * const shop = new ShopClient('https://exampleshop.com');
       * const allProducts = await shop.collections.products.all('summer-collection');
       *
       * if (allProducts) {
       *   console.log(`Found ${allProducts.length} products in the collection`);
       *   allProducts.forEach(product => {
       *     console.log(`${product.title} - $${product.price}`);
       *   });
       * }
       * ```
       */
      all: async (
        collectionHandle: string,
        options?: { currency?: CurrencyCode }
      ): Promise<Product[] | null> => {
        // Validate collection handle
        if (!collectionHandle || typeof collectionHandle !== "string") {
          throw new Error("Collection handle is required and must be a string");
        }

        // Sanitize handle - remove potentially dangerous characters
        const sanitizedHandle = collectionHandle
          .trim()
          .replace(/[^a-zA-Z0-9\-_]/g, "");
        if (!sanitizedHandle) {
          throw new Error("Invalid collection handle format");
        }

        // Check handle length (reasonable limits)
        if (sanitizedHandle.length > 255) {
          throw new Error("Collection handle is too long");
        }

        try {
          const limit = 250;
          const allProducts: Product[] = [];

          let currentPage = 1;

          while (true) {
            const products = await fetchPaginatedProductsFromCollection(
              sanitizedHandle,
              {
                page: currentPage,
                limit,
              }
            );

            if (!products || products.length === 0 || products.length < limit) {
              if (products && products.length > 0) {
                allProducts.push(...products);
              }
              break;
            }

            allProducts.push(...products);
            currentPage++;
          }

          return maybeOverrideProductsCurrency(allProducts, options?.currency);
        } catch (error) {
          console.error(
            `Error fetching all products for collection ${sanitizedHandle}:`,
            baseUrl,
            error
          );
          return null;
        }
      },

      /**
       * Fetches all product slugs from a specific collection.
       *
       * @param collectionHandle - The collection handle to fetch product slugs from
       *
       * @returns {Promise<string[] | null>} Array of product slugs from the collection or null if error occurs
       *
       * @throws {Error} When the collection handle is invalid or there's a network error
       *
       * @example
       * ```typescript
       * const shop = new ShopClient('https://exampleshop.com');
       * const productSlugs = await shop.collections.products.slugs('summer-collection');
       * console.log(productSlugs);
       * ```
       */
      slugs: async (collectionHandle: string): Promise<string[] | null> => {
        // Validate collection handle
        if (!collectionHandle || typeof collectionHandle !== "string") {
          throw new Error("Collection handle is required and must be a string");
        }

        // Sanitize handle - remove potentially dangerous characters
        const sanitizedHandle = collectionHandle
          .trim()
          .replace(/[^a-zA-Z0-9\-_]/g, "");
        if (!sanitizedHandle) {
          throw new Error("Invalid collection handle format");
        }

        // Check handle length (reasonable limits)
        if (sanitizedHandle.length > 255) {
          throw new Error("Collection handle is too long");
        }

        try {
          const limit = 250;
          const slugs: string[] = [];

          let currentPage = 1;

          while (true) {
            const products = await fetchPaginatedProductsFromCollection(
              sanitizedHandle,
              {
                page: currentPage,
                limit,
              }
            );

            if (!products || products.length === 0 || products.length < limit) {
              if (products && products.length > 0) {
                slugs.push(...products.map((p) => p.slug));
              }
              break;
            }

            slugs.push(...products.map((p) => p.slug));
            currentPage++;
          }

          return slugs;
        } catch (error) {
          console.error(
            `Error fetching product slugs for collection ${sanitizedHandle}:`,
            baseUrl,
            error
          );
          return null;
        }
      },
    },
  };
}
