/**
 * @fileoverview Type definitions for the shop-client package.
 *
 * This file contains all TypeScript type definitions used throughout the shop-client library,
 * including Shopify API response types, normalized product/collection types, and utility types.
 *
 * @author shop-client
 */

// Simplified version of RequireAtLeastOne utility type
type RequireAtLeastOne<T> = {
  [K in keyof T]-?: Required<Pick<T, K>> & Partial<Omit<T, K>>;
}[keyof T];

export type OpenRouterConfig = {
  apiKey?: string;
  model?: string;
  fallbackModels?: string[];
  baseUrl?: string;
  siteUrl?: string;
  appTitle?: string;
  offline?: boolean;
};

export type SystemUserPrompt = {
  system: string;
  user: string;
};

/**
 * Supported audience demographics for product categorization.
 */
type Audience =
  | "adult_male"
  | "adult_female"
  | "kid_male"
  | "kid_female"
  | "adult_unisex"
  | "kid_unisex";

/**
 * Product category structure for organizing store inventory.
 */
type Category = {
  clothing?: string[];
  jewellery?: string[];
  accessories?: string[];
};

/**
 * Special category for non-demographic specific products.
 */
type NoneCategory = {
  home_decor: string[];
  accessories: string[];
};

/**
 * Complete store catalog structure with demographic-based categorization.
 */
export type StoreCatalog = RequireAtLeastOne<{
  [K in Audience]: RequireAtLeastOne<Category>;
}> & {
  none: RequireAtLeastOne<NoneCategory>;
};

/**
 * Base timestamp fields used across Shopify entities.
 */
export type ShopifyTimestamps = {
  created_at: string;
  updated_at: string;
};

/**
 * Basic information fields common to Shopify entities.
 */
export type ShopifyBasicInfo = {
  id: number;
  title: string;
  handle: string;
};

/**
 * Image dimension properties.
 */
export type ShopifyImageDimensions = {
  width: number;
  height: number;
  aspect_ratio?: number;
};

/**
 * Shopify product image structure from API responses.
 */
export type ShopifyImage = ShopifyBasicInfo &
  ShopifyTimestamps &
  ShopifyImageDimensions & {
    src: string;
    position: number;
    product_id: number;
    variant_ids: string[];
  };

/**
 * Shopify variant image structure with additional properties.
 */
export type ShopifyVariantImage = ShopifyBasicInfo &
  ShopifyTimestamps &
  ShopifyImageDimensions & {
    src: string;
    position: number;
    product_id: number;
    variant_ids: number[];
    alt: string | null;
  };

/**
 * Featured media structure for products.
 */
export type ShopifyFeaturedMedia = {
  alt: string | null;
  id: number;
  position: number;
  preview_image: {
    aspect_ratio: number;
    height: number;
    width: number;
    src: string;
  };
};

/**
 * Media structure supporting both images and videos.
 */
export type ShopifyMedia = ShopifyFeaturedMedia &
  ShopifyImageDimensions & {
    media_type: "image" | "video";
    src: string;
  };

/**
 * Product option structure (e.g., Size, Color).
 */
export type ShopifyOption = {
  name: string;
  position: number;
  values: string[];
};

/**
 * Base variant structure with common properties.
 */
export type ShopifyBaseVariant = ShopifyBasicInfo &
  ShopifyTimestamps & {
    option1: string | null;
    option2: string | null;
    option3: string | null;
    sku: string | null;
    requires_shipping: boolean;
    taxable: boolean;
    position: number;
    product_id: number;
  };

/**
 * Product variant structure for Shopify products with basic properties.
 */
export type ShopifyProductVariant = ShopifyBaseVariant & {
  name?: string | undefined;
  options?: string[] | undefined;
  featured_image: {
    id: number;
    src: string;
    width: number;
    height: number;
    position: number;
    product_id: number;
    aspect_ratio: number;
    variant_ids: unknown[];
    created_at: string;
    updated_at: string;
    alt: string | null;
  } | null;
  available: boolean;
  price: string | number;
  weightInGrams?: number | undefined;
  compare_at_price?: string | number | undefined;
};

/**
 * Enhanced product variant structure for single product API responses.
 */
export type ShopifySingleProductVariant = ShopifyBaseVariant & {
  featured_image: ShopifyVariantImage | null;
  featured_media: ShopifyFeaturedMedia | null;
  available?: boolean | undefined;
  price: string;
  compare_at_price: string | null;
  inventory_quantity?: number | undefined;
  inventory_management: string | null;
  inventory_policy?: string | undefined;
  fulfillment_service?: string | undefined;
  barcode?: string | null | undefined;
  grams?: number | undefined;
  weight?: number | undefined;
  weight_unit?: string | undefined;
  requires_selling_plan?: boolean | undefined;
  selling_plan_allocations?: unknown[] | undefined;
};

/**
 * Base product structure with common Shopify product properties.
 */
export type ShopifyBaseProduct = ShopifyBasicInfo &
  ShopifyTimestamps & {
    vendor: string;
    tags: string[];
    options: ShopifyOption[];
  };

/**
 * Standard Shopify product structure from products API.
 */
export type ShopifyProduct = ShopifyBaseProduct & {
  body_html: string;
  body?: string | undefined;
  published_at: string;
  product_type: string;
  variants: ShopifyProductVariant[];
  images: ShopifyImage[];
};

/**
 * Alias for ShopifyProduct with store context.
 */
export type ShopifyProductAndStore = ShopifyProduct;

/**
 * Enhanced single product structure with additional pricing and availability data.
 */
export type ShopifySingleProduct = ShopifyBaseProduct & {
  description: string;
  published_at: string;
  type: string;
  tags: (string | string[] | undefined) & (string | string[]);
  price: number;
  price_min: number;
  price_max: number;
  available: boolean;
  price_varies: boolean;
  compare_at_price: number | null;
  compare_at_price_min: number;
  compare_at_price_max: number;
  compare_at_price_varies: boolean;
  variants: ShopifySingleProductVariant[];
  images: string[];
  featured_image: string | null;
  url?: string;
  media?: ShopifyMedia[];
  requires_selling_plan?: boolean;
  selling_plan_groups?: string[];
};

/**
 * Shopify predictive search API response structure.
 */
export type ShopifyPredictiveProductSearch = {
  resources: {
    results: {
      products: Array<
        Omit<ShopifySingleProduct, "description"> & {
          body: string;
        }
      >;
    };
  };
};

/**
 * Normalized pricing information for products.
 */
export type ProductPricing = {
  price: number;
  priceMin: number;
  priceMax: number;
  priceVaries: boolean;
  compareAtPrice: number;
  compareAtPriceMin: number;
  compareAtPriceMax: number;
  compareAtPriceVaries: boolean;
  discount: number;
  currency?: string;
};

/**
 * Localized/display pricing with currency-aware formatted strings.
 */
export type LocalizedPricing = {
  currency: string;
  priceFormatted: string;
  priceMinFormatted: string;
  priceMaxFormatted: string;
  compareAtPriceFormatted: string;
};

/**
 * ISO 4217 currency code type aligned with Intl.NumberFormat expectations.
 * Example values: "USD", "EUR", "GBP".
 */
export type CurrencyCode = NonNullable<Intl.NumberFormatOptions["currency"]>;

/**
 * Product option structure (e.g., Size, Color) for normalized products.
 */
export type ProductOption = {
  key: string;
  data: string[];
  name: string;
  position: number;
  values: string[];
};

/**
 * Normalized product variant image structure.
 */
export type ProductVariantImage = ShopifyImageDimensions & {
  id: number;
  src: string;
  position: number;
  productId: number;
  aspectRatio: number;
  variantIds: unknown[];
  createdAt: string;
  updatedAt: string;
  alt: string | null;
};

/**
 * Normalized product variant structure used by the library.
 */
export type ProductVariant = {
  id: string;
  platformId: string;
  name?: string | undefined;
  title: string;
  option1: string | null;
  option2: string | null;
  option3: string | null;
  options?: string[] | undefined;
  sku: string | null;
  requiresShipping: boolean;
  taxable: boolean;
  featuredImage: ProductVariantImage | null;
  available: boolean;
  price: number;
  weightInGrams?: number | undefined;
  compareAtPrice: number;
  position: number;
  productId: number;
  createdAt?: string | undefined;
  updatedAt?: string | undefined;
};

/**
 * Normalized product image structure.
 */
export type ProductImage = ShopifyImageDimensions & {
  id: number;
  productId: number;
  alt: string | null;
  position: number;
  src: string;
  mediaType: "image" | "video";
  variantIds: unknown[];
  createdAt?: string | undefined;
  updatedAt?: string | undefined;
};

/**
 * HTML meta tag structure for SEO data.
 */
export type MetaTag =
  | { name: string; content: string }
  | { property: string; content: string }
  | { itemprop: string; content: string };

/**
 * Main normalized product structure returned by the library.
 * This is the primary interface for working with products.
 */
export type Product = {
  slug: string;
  handle: string;
  platformId: string;
  title: string;
  available: boolean;
  price: number;
  priceMin: number;
  priceVaries: boolean;
  compareAtPrice: number;
  compareAtPriceMin: number;
  priceMax: number;
  compareAtPriceMax: number;
  compareAtPriceVaries: boolean;
  discount: number;
  currency?: string;
  localizedPricing?: LocalizedPricing;
  options: ProductOption[];
  bodyHtml: string | null;
  active?: boolean;
  productType: string | null;
  tags: string[];
  vendor: string;
  featuredImage?: string | null;
  isProxyFeaturedImage: boolean | null;
  createdAt?: Date;
  updatedAt?: Date;
  variants: ProductVariant[] | null;
  images: ProductImage[];
  publishedAt: Date | null;
  seo?: MetaTag[] | null;
  metaTags?: MetaTag[] | null;
  displayScore?: number;
  deletedAt?: Date | null;
  storeSlug: string;
  storeDomain: string;
  embedding?: number[] | null;
  url: string;
  requiresSellingPlan?: boolean | null;
  sellingPlanGroups?: unknown;
  variantOptionsMap: Record<string, string>; // Keys formatted as name#value parts joined by '##' (alphabetically sorted), e.g., "color#blue##size#xl"
  enriched_content?: string;
};

/**
 * Alternative product structure for API responses with normalized field names.
 */
export type ShopifyApiProduct = ShopifyBasicInfo & {
  bodyHtml: string;
  body?: string | undefined;
  publishedAt: string;
  createdAt?: string | undefined;
  updatedAt?: string | undefined;
  vendor: string;
  productType: string;
  tags: string[];
  variants: (Omit<ShopifyBaseVariant, "id"> & {
    id: number;
    name?: string | undefined;
    title: string;
    featuredImage: ProductVariantImage | null;
    available: boolean;
    price: number;
    weightInGrams?: number | undefined;
    compareAtPrice: number;
    position: number;
    productId: number;
    createdAt?: string | undefined;
    updatedAt?: string | undefined;
  })[];
  images: ProductImage[];
  options: ShopifyOption[];
};

/**
 * Product category structure for store catalogs.
 */
export type CatalogCategory = {
  clothing?: string[] | undefined;
  jewellery?: string[] | undefined;
  accessories?: string[] | undefined;
};

/**
 * Demographic categories for product targeting.
 */
export type Demographics =
  | "adult_male"
  | "adult_female"
  | "adult_unisex"
  | "kid_male"
  | "kid_female"
  | "kid_unisex";

/**
 * Valid store catalog structure with demographic-based organization.
 */
export type ValidStoreCatalog = {
  [key in Demographics]?: CatalogCategory | undefined;
};

/**
 * Physical address structure for shipping and contact information.
 */
export type Address = {
  addressLine1: string;
  addressLine2?: string | undefined;
  city: string;
  state: string;
  code: string;
  country: string;
  label?: string | undefined;
};

/**
 * Contact URL structure for store communication channels.
 */
export type ContactUrls = {
  whatsapp?: string | undefined;
  tel?: string | undefined;
  email?: string | undefined;
};

/**
 * Coupon/discount code structure.
 */
export type Coupon = {
  label: string;
  description?: string | undefined;
};

/**
 * Shopify collection structure from API responses.
 */
export type ShopifyCollection = {
  id: number;
  title: string;
  handle: string;
  description?: string | undefined;
  published_at: string;
  updated_at: string;
  image?:
    | {
        id: number;
        created_at: string;
        src: string;
        alt?: string;
      }
    | undefined;
  products_count: number;
};

/**
 * Main normalized collection structure returned by the library.
 * This is the primary interface for working with collections.
 */
/**
 * Country detection result with confidence scoring.
 */
/**
 * Result of country detection analysis for a Shopify store.
 * Contains the detected country as an ISO 3166-1 alpha-2 code.
 */
export type CountryDetectionResult = {
  /** The detected country as ISO 3166-1 alpha-2 code (e.g., "US", "GB") or "Unknown" if no reliable detection */
  country: string;
  /** Confidence score between 0 and 1 (higher = more confident) */
  confidence: number;
  /** Array of detection signals that contributed to the result */
  signals: string[];
  /** Detected currency code (e.g., "USD", "INR") if available */
  currencyCode?: string;
};

/**
 * Country scoring data for internal calculations.
 */
export type CountryScore = {
  score: number;
  reasons: string[];
};

/**
 * Country scores mapping for detection algorithm.
 */
export type CountryScores = {
  [country: string]: CountryScore;
};

/**
 * Shopify features data structure from script tags.
 */
export type ShopifyFeaturesData = {
  country?: string;
  locale?: string;
  moneyFormat?: string;
  [key: string]: unknown;
};

// Generic JSON-LD entry structure to capture parsed script contents without using `any`.
export type JsonLdEntry = Record<string, unknown>;

export type Collection = {
  id: string;
  title: string;
  handle: string;
  description?: string | undefined;
  image?: {
    id: number;
    createdAt: string;
    src: string;
    alt?: string;
  };
  productsCount: number;
  publishedAt: string;
  updatedAt: string;
};

/**
 * Product classification result returned by classifyProduct.
 */
export type ProductClassification = {
  audience:
    | "adult_male"
    | "adult_female"
    | "kid_male"
    | "kid_female"
    | "generic";
  vertical:
    | "clothing"
    | "beauty"
    | "accessories"
    | "home-decor"
    | "food-and-beverages";
  category?: string | null;
  subCategory?: string | null;
};

/**
 * SEO and marketing content generated by LLM.
 */
export type SEOContent = {
  metaTitle: string;
  metaDescription: string;
  shortDescription: string;
  longDescription: string;
  tags: string[];
  marketingCopy: string;
};

// Store type determination result with reasoning
export type StoreTypeResult = {
  vertical:
    | "clothing"
    | "beauty"
    | "accessories"
    | "home-decor"
    | "food-and-beverages";
  audience:
    | "adult_male"
    | "adult_female"
    | "kid_male"
    | "kid_female"
    | "generic";
  reason: string;
};

// Multi-audience store type breakdown: { [audience]: { [vertical]: string[] } }
export type StoreTypeBreakdown = Partial<
  Record<
    "adult_male" | "adult_female" | "kid_male" | "kid_female" | "generic",
    Partial<
      Record<
        | "clothing"
        | "beauty"
        | "accessories"
        | "home-decor"
        | "food-and-beverages",
        string[]
      >
    >
  >
>;
