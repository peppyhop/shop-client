# Shop Client - API Reference

## Overview

This document provides a comprehensive API reference for the `shop-client` library, designed for LLM understanding and code generation assistance.

## Installation

```bash
npm install shop-client
# or
yarn add shop-client
# or
pnpm add shop-client
```

## Basic Usage

```typescript
import { ShopClient } from 'shop-client';

const shop = new ShopClient('your-store-domain.com');
```

## ShopClient Class

### Constructor

```typescript
new ShopClient(domain: string, options?: ShopClientOptions)
```

**Parameters:**
- `domain` (string): The Shopify store domain (e.g., 'example.myshopify.com' or 'shop.example.com')
- `options` (ShopClientOptions, optional): Configuration overrides

```typescript
type ShopClientOptions = {
  /** Cache TTL for getInfo() in milliseconds (default ~300_000) */
  cacheTTL?: number;
};
```

**Returns:** ShopClient instance

**Example:**
```typescript
const shop = new ShopClient('anuki.in');

// Customize cache TTL to 60 seconds
const fastExpiring = new ShopClient('anuki.in', { cacheTTL: 60_000 });
```

### Methods

#### getInfo(options?)

```typescript
async getInfo(options?: { force?: boolean }): Promise<StoreInfo | null>
```

Fetches comprehensive store information including metadata, social links, and featured content.
Validates the URL is a Shopify store; throws an Error if validation fails.

Caching:
- Results are cached per `ShopClient` instance.
- TTL is configurable via `ShopClientOptions.cacheTTL`.
- Concurrent calls are deduplicated while a request is in-flight.
- `options.force === true` bypasses the cache and triggers a fresh fetch regardless of TTL.

**Parameters:**
- `options.force` (boolean, optional): When `true`, bypasses cache and refetches.

**Returns:** Promise resolving to StoreInfo object or null if store not found

**Examples:**
```typescript
// Normal usage
const storeInfo = await shop.getInfo();
console.log(storeInfo?.name); // Store name
console.log(storeInfo?.description); // Store description

// Force refetch within TTL
await shop.getInfo(); // cached
const fresh = await shop.getInfo({ force: true }); // refetched
```

#### clearInfoCache()

```typescript
clearInfoCache(): void
```

Manually invalidates the `getInfo()` cache on the current `ShopClient` instance. After calling this, the next `getInfo()` triggers a fresh network request regardless of TTL.

**Example:**
```typescript
const shop = new ShopClient('anuki.in', { cacheTTL: 5 * 60_000 });
await shop.getInfo(); // cached
shop.clearInfoCache(); // invalidate
const fresh = await shop.getInfo(); // refetches
```

#### determineStoreType(options?)

```typescript
async determineStoreType(options?: {
  apiKey?: string;
  model?: string;
  maxShowcaseProducts?: number;
  maxShowcaseCollections?: number;
}): Promise<StoreTypeBreakdown>
```

Infers the store’s audiences and verticals by classifying showcased products using only `product.bodyHtml`. Aggregates per-product classifications into a multi-audience breakdown and prunes results with store-level signals.

**Parameters:**
- `apiKey` (string, optional): OpenRouter API key for online classification. If omitted or `OPENROUTER_OFFLINE=1`, uses offline heuristics.
- `model` (string, optional): Model name for online classification.
- `maxShowcaseProducts` (number, optional): Sample size for showcased products (default: 10, max: 50).
- `maxShowcaseCollections` (number, optional): Ignored for classification; kept for API symmetry.

**Returns:** Promise resolving to `StoreTypeBreakdown`:

```typescript
type StoreTypeBreakdown = Partial<
  Record<
    'adult_male' | 'adult_female' | 'kid_male' | 'kid_female' | 'generic',
    Partial<Record<'clothing' | 'beauty' | 'accessories' | 'home-decor' | 'food-and-beverages', string[]>>
  >
>;
```

**Example:**
```typescript
const breakdown = await shop.determineStoreType({
  apiKey: process.env.OPENROUTER_API_KEY,
  model: 'openai/gpt-4o-mini',
  maxShowcaseProducts: 12,
});
// { generic: { accessories: ['general'] }, adult_female: { clothing: ['dresses'] } }
```

## ProductOperations

Access via `shop.products`

### predictiveSearch(query: string, options?)

Locale-aware Shopify Ajax predictive search for products.
- `limit` clamps to 1–10 (default 10)
- `locale` defaults to `en`; falls back to non-locale on 404/417
- `unavailableProducts` defaults to `hide`
- Applies optional `currency` override to returned products

```typescript
const results = await shop.products.predictiveSearch("dress", { limit: 10, locale: "en" });
```

### recommendations(productId: number, options?)

Product recommendations for a given product ID.
- `intent`: `related` (default) or `complementary`
- `limit`: 1–10 (default 10)
- `locale`: defaults to `en`
- Applies optional `currency` override

```typescript
const recos = await shop.products.recommendations(1234567890, { intent: "related", limit: 6 });
```

### all()

```typescript
async all(): Promise<Product[] | null>
```

Fetches all products from the store with automatic pagination handling.

**Returns:** Promise resolving to array of Product objects or null on error

**Example:**
```typescript
const products = await shop.products.all();
if (products) {
  console.log(`Found ${products.length} products`);
}
```

### paginated()

```typescript
async paginated(options?: PaginationOptions): Promise<Product[] | null>
```

Fetches products with manual pagination control.

**Parameters:**
- `options` (PaginationOptions, optional):
  - `limit?: number` - Number of products per page (default: 250)
  - `page?: number` - Page number to fetch (default: 1)

**Returns:** Promise resolving to array of Product objects or null on error

**Example:**
```typescript
const firstPage = await shop.products.paginated({ limit: 10, page: 1 });
const secondPage = await shop.products.paginated({ limit: 10, page: 2 });
```

### find()

```typescript
async find(handle: string): Promise<Product | null>
```

Finds a specific product by its handle (URL-friendly identifier).

**Parameters:**
- `handle` (string): The product handle

**Returns:** Promise resolving to Product object or null if not found

**Example:**
```typescript
const product = await shop.products.find('awesome-t-shirt');
if (product) {
  console.log(product.title);
  console.log(`$${product.price / 100}`); // Convert cents to dollars
}
```

### showcased()

```typescript
async showcased(): Promise<Product[] | null>
```

Fetches products featured on the store's homepage.

**Returns:** Promise resolving to array of featured Product objects or null on error

**Example:**
```typescript
const featuredProducts = await shop.products.showcased();
```

### filter()

```typescript
async filter(): Promise<Record<string, string[]> | null>
```

Extracts available filter options from all product variants (e.g., sizes, colors).

**Returns:** Promise resolving to object with filter options or null on error

**Example:**
```typescript
const filters = await shop.products.filter();
// Returns: { "Size": ["S", "M", "L"], "Color": ["Red", "Blue", "Green"] }
```

## CollectionOperations

Accessed via `shop.collections`

### `all(): Promise<Collection[]>`

Fetches all collections from the store.

**Returns:** Array of all collections

**Example:**
```typescript
const collections = await shop.collections.all();
console.log(`Store has ${collections.length} collections`);
```

### `find(handle: string): Promise<Collection | null>`

Finds a specific collection by its handle.

**Parameters:**
- `handle: string` - Collection handle (URL slug)

**Returns:** Collection object or null if not found

**Example:**
```typescript
const collection = await shop.collections.find('summer-collection');
if (collection) {
  console.log(`${collection.title} has ${collection.productsCount} products`);
}
```

### `showcased(): Promise<Collection[]>`

Fetches collections that are showcased/featured on the store's homepage.

**Returns:** Array of showcased collections

**Example:**
```typescript
const featuredCollections = await shop.collections.showcased();
```

### `paginated(options?: PaginationOptions): Promise<Collection[] | null>`

Fetches collections with pagination.

**Parameters:**
- `options.page?: number` - Page number (default: 1)
- `options.limit?: number` - Items per page (default: 10, max: 250)

**Returns:** Array of collections for the specified page or null on error

**Example:**
```typescript
const collectionsPage = await shop.collections.paginated({
  page: 1,
  limit: 10,
});
```

### Collection Products

#### `products.all(collectionHandle: string): Promise<Product[] | null>`

Fetches all products from a specific collection.

**Parameters:**
- `collectionHandle: string` - Collection handle

**Returns:** Array of products in the collection

**Example:**
```typescript
const products = await shop.collections.products.all('summer-collection');
```

#### `products.paginated(collectionHandle: string, options?: PaginationOptions): Promise<Product[] | null>`

Fetches products from a collection with pagination.

**Parameters:**
- `collectionHandle: string` - Collection handle
- `options.page?: number` - Page number
- `options.limit?: number` - Items per page

**Returns:** Array of products for the specified page

**Example:**
```typescript
const products = await shop.collections.products.paginated('summer-collection', {
  page: 1,
  limit: 20
});
```

## CheckoutOperations

Accessed via `shop.checkout`

### `createUrl(params: CheckoutParams): string`

Creates a Shopify checkout URL with pre-filled information.

**Parameters:**
```typescript
type CheckoutParams = {
  email: string;
  items: Array<{
    productVariantId: string;
    quantity: string;
  }>;
  address: {
    firstName: string;
    lastName: string;
    address1: string;
    city: string;
    zip: string;
    country: string;
    province: string;
    phone: string;
  };
}
```

**Returns:** Pre-filled checkout URL string

**Example:**
```typescript
const checkoutUrl = shop.checkout.createUrl({
  email: 'customer@example.com',
  items: [
    { productVariantId: '12345', quantity: '2' },
    { productVariantId: '67890', quantity: '1' }
  ],
  address: {
    firstName: 'John',
    lastName: 'Doe',
    address1: '123 Main St',
    city: 'New York',
    zip: '10001',
    country: 'United States',
    province: 'New York',
    phone: '+1234567890'
  }
});
```

## Type Definitions

### Product

```typescript
type Product = {
  // Identifiers
  slug: string;
  handle: string;
  platformId: string | null;
  
  // Basic Information
  title: string;
  available: boolean;
  productType: string | null;
  vendor: string;
  tags: string[];
  
  // Pricing
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
  
  // Content
  bodyHtml: string | null;
  featuredImage?: string | null;
  isProxyFeaturedImage: boolean | null;
  images: ProductImage[];
  
  // Variants and Options
  variants: ProductVariant[] | null;
  options: ProductOption[];
  
  // Metadata
  seo?: MetaTag[] | null;
  metaTags?: MetaTag[] | null;
  createdAt?: Date;
  updatedAt?: Date;
  publishedAt: Date | null;
  
  // Store Context
  storeSlug: string;
  storeDomain: string;
  url: string;
  
  // Additional
  active?: boolean;
  displayScore?: number;
  deletedAt?: Date | null;
  embedding?: number[] | null;
  requiresSellingPlan?: boolean | null;
  sellingPlanGroups?: unknown;
};
```

### Collection

```typescript
type Collection = {
  id: string;
  title: string;
  handle: string;
  description?: string;
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
```

### StoreInfo

```typescript
type StoreInfo = {
  name: string;
  domain: string;
  slug: string;
  title: string;
  description: string;
  logoUrl?: string;
  socialLinks: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    youtube?: string;
    tiktok?: string;
    pinterest?: string;
    linkedin?: string;
  };
  contactLinks: {
    phone?: string;
    email?: string;
    contact?: string;
    whatsapp?: string;
  };
  headerLinks: Array<{
    title: string;
    url: string;
  }>;
  showcase: {
    products: string[];
    collections: string[];
  };
  jsonLdData?: any;
  techProvider: string;
  country: string;
  currency: string;
};
```

### ProductVariant

```typescript
type ProductVariant = {
  id: string;
  title: string;
  option1: string | null;
  option2: string | null;
  option3: string | null;
  sku: string | null;
  requiresShipping: boolean;
  taxable: boolean;
  featuredImage: ProductVariantImage | null;
  available: boolean;
  name?: string;
  publicTitle?: string;
  options: string[];
  price: number;
  weightInGrams?: number;
  compareAtPrice: number;
  position: number;
  productId: number;
  createdAt?: string;
  updatedAt?: string;
};
```

### ProductImage

```typescript
type ProductImage = {
  id: number;
  productId: number;
  alt: string | null;
  position: number;
  src: string;
  mediaType: "image" | "video";
  variantIds: unknown[];
  width: number;
  height: number;
  aspectRatio?: number;
  createdAt?: string;
  updatedAt?: string;
};
```

### ProductOption

```typescript
type ProductOption = {
  name: string;
  position: number;
  values: string[];
};
```

### MetaTag

```typescript
type MetaTag =
  | { name: string; content: string }
  | { property: string; content: string }
  | { itemprop: string; content: string };
```

## Utility Functions

### `detectShopCountry(domain: string): Promise<CountryDetectionResult>`

Detects the country of a Shopify store based on various signals.

**Parameters:**
- `domain: string` - Store domain

**Returns:** Country detection result with confidence score

**Example:**
```typescript
import { detectShopCountry } from 'shop-client';

const result = await detectShopCountry('anuki.in');
console.log(`Country: ${result.country}, Confidence: ${result.confidence}`);
```

### `extractDomainWithoutSuffix(domain: string): string`

Extracts domain name without TLD suffix.

### `generateStoreSlug(domain: string): string`

Generates SEO-friendly store slug from domain.

### `genProductSlug(product: Product): string`

Generates product slug from product data.

### `calculateDiscount(price: number, compareAtPrice: number): number`

Calculates discount percentage between prices.

## Error Handling

All async methods may throw errors for:
- Network connectivity issues
- Invalid domain formats
- API rate limiting
- Server errors (5xx responses)

Handle errors appropriately:

```typescript
try {
  const products = await shop.products.all();
} catch (error) {
  console.error('Failed to fetch products:', error.message);
}
```

## Rate Limiting

The library respects Shopify's rate limits. For high-volume usage:
- Implement exponential backoff
- Use pagination instead of fetching all data at once
- Cache results when appropriate
- Monitor for 429 (Too Many Requests) responses
## Utilities

Utility functions are exported to support common normalization and parsing tasks.

### sanitizeDomain(input, opts?)

```typescript
import { sanitizeDomain } from 'shop-client';
sanitizeDomain('https://WWW.Example.com/path?x=1#top'); // 'example.com'
sanitizeDomain('www.example.com', { stripWWW: false }); // 'www.example.com'
// sanitizeDomain('example'); // throws (invalid: missing public suffix)
```

Normalizes domains by:
- Lowercasing
- Stripping protocol, path, query, fragment, and ports
- Stripping `www.` by default (configurable via `stripWWW`)
Throws for invalid inputs:
- Empty strings or whitespace-only
- Hostnames missing a public suffix (e.g., 'example')

### safeParseDate(input?)

```typescript
import { safeParseDate } from 'shop-client';
safeParseDate('2024-10-31T12:34:56Z'); // Date
safeParseDate(''); // undefined
```

Parses date strings safely, returning `undefined` for falsy or invalid inputs. Use `|| null` if null is preferred.

### Variant helpers

```typescript
import { ProductOperations } from 'shop-client';
// helper usage is internal in DTOs; keys are normalized
// map format: 'color#blue##size#xl' → '123456'
```

Keys in `variantOptionsMap` are normalized (`name#value` parts sorted alphabetically and joined by `##`).

## AI Enrichment

### `classifyProduct(input: { title?: string; bodyHtml?: string; tags?: string[]; vendor?: string; }): Promise<StoreTypeBreakdown>`

Classifies a single product into audiences and verticals using offline heuristics or OpenRouter when configured.

**Parameters:**
- `title?: string`
- `bodyHtml?: string`
- `tags?: string[]`
- `vendor?: string`

**Returns:** `StoreTypeBreakdown`

**Example:**
```typescript
import { classifyProduct } from 'shop-client';
const breakdown = await classifyProduct({
  title: 'Organic Cotton T-Shirt',
  bodyHtml: '<p>Soft, breathable tee</p>',
  tags: ['organic', 'cotton', 'unisex'],
});
```

### `generateSEOContent(input: { title?: string; description?: string; tags?: string[]; }): Promise<{ metaTitle: string; metaDescription: string; keywords: string[] }>`

Generates simple, deterministic SEO metadata for product pages.

**Parameters:**
- `title?: string`
- `description?: string`
- `tags?: string[]`

**Returns:** Object with `metaTitle`, `metaDescription`, and `keywords`.

**Example:**
```typescript
import { generateSEOContent } from 'shop-client';
const seo = await generateSEOContent({
  title: 'Organic Cotton T-Shirt',
  description: 'Soft, breathable tee for everyday wear',
  tags: ['organic', 'cotton', 'unisex'],
});
```

## Release & Publishing

- Automated releases via `semantic-release`.
- Node.js `22.14.0` for the release job to satisfy `semantic-release` requirements.
- npm Trusted Publishing with provenance enabled:
  - Workflow grants `id-token: write` and sets `NPM_CONFIG_PROVENANCE=true`.
  - npm package settings should add this GitHub repo as a trusted publisher and use environment `npm-publish`.
