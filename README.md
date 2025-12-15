# Shop Search

[![npm version](https://badge.fury.io/js/shop-client.svg)](https://badge.fury.io/js/shop-client)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

`shop-client` is a powerful, type-safe TypeScript library for fetching and transforming product data from Shopify stores. Perfect for building e-commerce applications, product catalogs, price comparison tools, and automated store analysis.

## Contents

- [Installation](#-installation)
- [Quick Start](#-quick-start)
- [Store Info Caching & Concurrency](#store-info-caching--concurrency)
- [Browser Usage](#browser-usage)
- [Server/Edge Usage](#serveredge-usage)
- [Deep Imports & Tree-Shaking](#deep-imports--tree-shaking)
- [Rate Limiting](#rate-limiting)
- [Migration: Barrel → Subpath Imports](#migration-barrel--subpath-imports)
 - [API Docs](#api-docs)

## 🚀 Features

- **Complete Store Data Access**: Fetch products, collections, and store information
- **Flexible Product Retrieval**: Get all products, paginated results, or find specific items
- **Collection Management**: Access collections and their associated products
- **Checkout Integration**: Generate pre-filled checkout URLs
- **Type-Safe**: Written in TypeScript with comprehensive type definitions
- **Performance Optimized**: Efficient data fetching with built-in error handling
- **Zero Dependencies**: Lightweight with minimal external dependencies
- **Store Type Classification**: Infers audience and verticals from showcased products (body_html-only)

## 🧠 Store Info Caching & Concurrency

`getInfo()` uses time-based caching and in-flight request deduping to avoid redundant network calls:

- Cache window: `5 minutes` (`cacheExpiry`). Fresh cached results return immediately.
  - You can configure this TTL via the `ShopClient` constructor option `cacheTTL` (milliseconds).
- Cached fields: `infoCacheValue` (last `StoreInfo`) and `infoCacheTimestamp` (last fetch time).
- In-flight deduping: concurrent calls share a single request via an internal promise; result is cached and returned to all callers.
- Failure handling: the in-flight marker clears in a `finally` block so subsequent calls can retry.

Behavior:
- Cached and fresh → returns cached `StoreInfo`.
- Stale/missing and request in-flight → awaits shared promise.
- Stale/missing and no in-flight → performs fetch, caches, returns.

Example: configure cache TTL

```ts
import { ShopClient } from "shop-client";

// Set store info + validation cache TTL to 10 seconds
const shop = new ShopClient("https://exampleshop.com", { cacheTTL: 10_000 });
const info = await shop.getInfo();
```

Manual invalidation

```ts
import { ShopClient } from "shop-client";

const shop = new ShopClient("https://exampleshop.com", { cacheTTL: 60_000 });

// Fetch and cache
await shop.getInfo();

// Invalidate cache proactively (e.g., after a content update)
shop.clearInfoCache();

// Next call refetches and repopulates cache
await shop.getInfo();
```

Force refetch

```ts
import { ShopClient } from "shop-client";

const shop = new ShopClient("https://exampleshop.com", { cacheTTL: 60_000 });

// First call caches within TTL
await shop.getInfo();

// Force a fresh network fetch even if the cache is still fresh
const fresh = await shop.getInfo({ force: true });
```

See also:
- Architecture: [Caching Strategy](./ARCHITECTURE.md#caching-strategy)
- API Reference (LLM): [ShopClientOptions, getInfo(force), clearInfoCache](./.llm/api-reference.md#constructor)

## 📦 Installation

```bash
npm install shop-client
```

```bash
yarn add shop-client
```

```bash
pnpm add shop-client
```

## 🔧 Quick Start

```typescript
import { ShopClient } from 'shop-client';

// Initialize shop client instance
const shop = new ShopClient("your-store-domain.com");

// Fetch store information
const storeInfo = await shop.getInfo();

// Fetch all products
const products = await shop.products.all();

// Find specific product
const product = await shop.products.find("product-handle");
```

## Browser Usage

Some in-browser environments load npm packages via blob URLs and can error if the content is not served with a JavaScript MIME type (e.g., “Modules must be served with a valid MIME type like application/javascript”). To use `shop-client` directly in the browser, import the ESM build from a CDN that sets the correct `Content-Type`:

```html
<!-- Import map to pin shop-client to a CDN ESM URL -->
<script type="importmap">
{
  "imports": {
    "shop-client": "https://cdn.jsdelivr.net/npm/shop-client/+esm"
  }
}
</script>

<script type="module">
  import { ShopClient } from 'shop-client';
  const shop = new ShopClient('https://example.myshopify.com/');
  const info = await shop.getInfo();
  console.log(info);
  const products = await shop.products.paginated({ page: 1, limit: 24 });
  console.log(products);
  // For collections:
  const colProducts = await shop.collections.products.paginated('mens', { page: 1, limit: 24 });
  console.log(colProducts);
}</script>
```

Alternative CDN URLs:
- `https://esm.sh/shop-client@3.5.0`
- `https://unpkg.com/shop-client@3.5.0?module`

Troubleshooting:
- Ensure the CDN returns `Content-Type: application/javascript`. The `+esm` and `?module` suffixes enforce ESM delivery.
- If you build your own blob, set `new Blob(code, { type: 'text/javascript' })` before `import()`.
- For app frameworks (Vite, Next.js), import `shop-client` normally and let the bundler serve modules.

## Server/Edge Usage

For robust production setups, run `shop-client` on the server or an edge function and return JSON to the browser:

```ts
// /api/shop-info.ts (Edge/Node)
import { ShopClient } from 'shop-client';

export default async function handler(req, res) {
  const shop = new ShopClient('https://example.myshopify.com/');
  const info = await shop.getInfo();
  res.json(info);
}
```

Client:

```ts
const info = await fetch('/api/shop-info').then(r => r.json());
```

## Deep Imports & Tree-Shaking

For optimal bundle size, import only what you need using subpath exports. The library ships ESM/CJS builds and declares `sideEffects: false` for better dead code elimination.

Examples:

```typescript
// ESM deep imports
import { configureRateLimit } from 'shop-client/rate-limit';
import { ProductOperations } from 'shop-client/products';

// CommonJS deep imports
const { configureRateLimit } = require('shop-client/rate-limit');
const { ProductOperations } = require('shop-client/products');

// Recommended: import specific functions you use
import { ShopClient } from 'shop-client';
import { fetchProducts } from 'shop-client/products';
```

Notes:
- ESM consumers (Vite/Rollup/esbuild) get tree-shaking out of the box.
- Webpack benefits from `sideEffects: false`; avoid importing wide barrels when possible.
- Rate limiter timer starts lazily on first use (no import-time side effects).

### Migration: Barrel → Subpath Imports

#### Package Rename: `shop-search` → `shop-client` (v3.8.2)
- Install: `npm i shop-client` (replaces `shop-search`)
- Update imports to `shop-client` (API unchanged)

TypeScript:
```ts
// Before (pre-rename: shop-search)
import { Store } from 'shop-search';
const store = new Store("your-store.myshopify.com");

// After (post-rename: shop-client v3.8.2+)
import { ShopClient } from 'shop-client';
const client = new ShopClient("your-store.myshopify.com");
```

You can keep using the root entry (`shop-client`), but for smaller bundles switch to deep imports. The API remains the same—only the import paths change.

Examples:

```typescript
// Before (barrel import)
import { ShopClient, configureRateLimit } from 'shop-client';

// After (deep imports for better tree-shaking)
import { ShopClient } from 'shop-client';
import { configureRateLimit } from 'shop-client/rate-limit';

// Feature-specific imports
import { fetchProducts } from 'shop-client/products';
import { createCheckoutOperations } from 'shop-client/checkout';
```

CommonJS:

```javascript
// Before
const { ShopClient, configureRateLimit } = require('shop-client');

// After
const { ShopClient } = require('shop-client');
const { configureRateLimit } = require('shop-client/rate-limit');
```

Notes:
- No bundler changes required; deep imports are exposed via `exports`.
- The root entry continues to work; prefer deep imports for production apps.

## API Docs

- TypeDoc builds automatically on pushes to `main` and publishes to GitHub Pages.
- Visit: `https://peppyhop.github.io/shop-client/` (after the first successful workflow run).

## Rate Limiting

`shop-client` ships with an opt-in, global rate limiter that transparently throttles all internal HTTP requests (products, collections, store info, enrichment). This helps avoid `429 Too Many Requests` responses and keeps crawling stable.

- Default: disabled
- When enabled: defaults to `5` requests per `1000ms` with max concurrency `5`
- Configure globally via `configureRateLimit`

```typescript
import { ShopClient, configureRateLimit } from 'shop-client';

// Enable and configure the global rate limiter
configureRateLimit({
  enabled: true,
  maxRequestsPerInterval: 60, // 60 requests
  intervalMs: 60_000,         // per minute
  maxConcurrency: 4,          // up to 4 in parallel
});

const shop = new ShopClient("your-store-domain.com");

// All subsequent library calls use the limiter automatically
const products = await shop.products.all();
```

Notes:
- The limiter is global to the process. Call `configureRateLimit` once at startup.
- If you are crawling multiple stores, prefer lower concurrency and a longer interval to reduce pressure.
- When disabled, the library uses native `fetch` without throttling.

### Advanced: Per-Host and Per-Class Limits

You can set different buckets by host (including wildcards) or by logical class:

```typescript
import { configureRateLimit } from 'shop-client';

configureRateLimit({
  enabled: true,
  // Default fallback
  maxRequestsPerInterval: 10,
  intervalMs: 1000,
  maxConcurrency: 5,

  // Host-specific buckets (exact host or wildcard suffix '*.example.com')
  perHost: {
    'openrouter.ai': { maxRequestsPerInterval: 2, intervalMs: 1000, maxConcurrency: 1 },
    '*.myshopify.com': { maxRequestsPerInterval: 5, intervalMs: 1000, maxConcurrency: 3 },
    'your-store-domain.com': { maxRequestsPerInterval: 8, intervalMs: 1000, maxConcurrency: 4 },
  },

  // Class-specific buckets (use by passing `rateLimitClass` in RequestInit)
  perClass: {
    openrouter: { maxRequestsPerInterval: 2, intervalMs: 1000, maxConcurrency: 1 },
    shopify: { maxRequestsPerInterval: 6, intervalMs: 1000, maxConcurrency: 3 },
  },
});

// If you make custom fetches, you can tag them with a class:
// await rateLimitedFetch(url, { rateLimitClass: 'openrouter' });
```

Resolution order:
- If `rateLimitClass` is present, that bucket is used.
- Else, a matching `perHost` bucket is used (exact match first, then wildcard suffix).
- Else, the global default bucket is used.

Tip: You can deep import the limiter configuration surface:

```typescript
import { configureRateLimit } from 'shop-client/rate-limit';
```

## 📚 API Reference

### Store Information

#### `getInfo()`

Fetches comprehensive store metadata including branding, social links, and featured content.

```typescript
const storeInfo = await shop.getInfo();
```

**Returns:** `StoreInfo` object containing:
- `name`: Store name from meta tags
- `title`: Store title
- `description`: Store description
- `domain`: Store domain
- `slug`: Generated store slug
- `logoUrl`: Store logo URL
- `socialLinks`: Social media URLs (Facebook, Instagram, etc.)
- `contactLinks`: Contact information (phone, email, contact page)
- `headerLinks`: Navigation menu links
- `showcase`: Featured products and collections
- `jsonLdData`: Structured data from the store

### Products

#### `products.all()`

Fetches all products from the store with automatic pagination handling.

```typescript
const allProducts = await shop.products.all();
```

**Returns:** `Product[]` - Array of all products in the store

#### `products.paginated(options)`

Fetches products with manual pagination control.

```typescript
const products = await shop.products.paginated({
  page: 1,
  limit: 25,
  // Optional currency override aligned with Intl.NumberFormat
  currency: "EUR",
});
```

**Parameters:**
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Products per page (default: 250, max: 250)
 - `currency` (CurrencyCode, optional): ISO 4217 code aligned with `Intl.NumberFormatOptions['currency']` (e.g., `"USD"`, `"EUR"`, `"JPY"`)

**Returns:** `Product[]` - Array of products for the specified page

#### `products.find(handle)`

Finds a specific product by its handle.

```typescript
const product = await shop.products.find("product-handle");

// With currency override
const productEur = await shop.products.find("product-handle", { currency: "EUR" });
```

**Parameters:**
- `handle` (string): The product handle/slug
 - `options` (object, optional): Additional options
   - `currency` (CurrencyCode, optional): ISO 4217 code aligned with `Intl.NumberFormatOptions['currency']`

**Returns:** `Product | null` - Product object or null if not found

#### `products.showcased()`

Fetches products featured on the store's homepage.

```typescript
const showcasedProducts = await shop.products.showcased();
```

**Returns:** `Product[]` - Array of featured products

#### `products.filter()`

Creates a map of variant options and their distinct values from all products in the store. This is useful for building filter interfaces, search facets, and product option selectors.

```typescript
const filters = await shop.products.filter();
console.log('Available filters:', filters);

// Example output:
// {
//   "size": ["small", "medium", "large", "xl"],
//   "color": ["black", "blue", "red", "white"],
//   "material": ["cotton", "polyester", "wool"]
// }

// Use filters for UI components
Object.entries(filters || {}).forEach(([optionName, values]) => {
  console.log(`${optionName}: ${values.join(', ')}`);
});
```

**Returns:** `Record<string, string[]> | null` - Object mapping option names to arrays of their unique values (all lowercase), or null if error occurs

**Features:**
- Processes all products across all pages automatically
- Returns lowercase, unique values for consistency
- Handles products with multiple variant options
- Returns empty object `{}` if no products have variants

### Collections

#### `collections.all()`

Fetches all collections from the store.

```typescript
const collections = await shop.collections.all();
```

**Returns:** `Collection[]` - Array of all collections

#### `collections.find(handle)`

Finds a specific collection by its handle.

```typescript
const collection = await shop.collections.find("collection-handle");
```

**Parameters:**
- `handle` (string): The collection handle/slug

**Returns:** `Collection | null` - Collection object or null if not found

#### `collections.showcased()`

Fetches collections featured on the store's homepage.

```typescript
const showcasedCollections = await shop.collections.showcased();
```

**Returns:** `Collection[]` - Array of featured collections

#### `collections.paginated(options)`

Fetches collections with manual pagination control.

```typescript
const collectionsPage = await shop.collections.paginated({
  page: 1,
  limit: 10,
});
```

**Parameters:**
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Collections per page (default: 10, max: 250)

**Returns:** `Collection[]` - Array of collections for the specified page

### Collection Products

#### `collections.products.all(handle)`

Fetches all products from a specific collection.

```typescript
const products = await shop.collections.products.all("collection-handle");
```

**Parameters:**
- `handle` (string): The collection handle

**Returns:** `Product[] | null` - Array of products in the collection

#### `collections.products.paginated(handle, options)`

Fetches products from a collection with pagination.

```typescript
const products = await shop.collections.products.paginated("collection-handle", {
  page: 1,
  limit: 25,
  currency: "GBP",
});
```

**Parameters:**
- `handle` (string): The collection handle
- `options` (object): Pagination options
  - `page` (number, optional): Page number (default: 1)
  - `limit` (number, optional): Products per page (default: 250)
  - `currency` (CurrencyCode, optional): ISO 4217 code aligned with `Intl.NumberFormatOptions['currency']`

**Returns:** `Product[]` - Array of products for the specified page

#### Currency Override

By default, pricing is formatted using the store’s detected currency.
You can override the currency for product and collection queries by passing a `currency` option.
This override updates `Product.currency` and `Product.localizedPricing.currency` (and related formatted strings) only.

```typescript
// Products
await shop.products.paginated({ page: 1, limit: 25, currency: "EUR" });
await shop.products.all({ currency: "JPY" });
await shop.products.find("product-handle", { currency: "GBP" });

// Collection products
await shop.collections.products.paginated("collection-handle", { page: 1, limit: 25, currency: "CAD" });
await shop.collections.products.all("collection-handle", { currency: "AUD" });
```

Type: `CurrencyCode` is defined as `NonNullable<Intl.NumberFormatOptions['currency']>`.
This ensures compatibility with `Intl.NumberFormat` and avoids maintaining a hardcoded list.

### Checkout

#### `checkout.createUrl(params)`

Generates a Shopify checkout URL with pre-filled customer information and cart items.

```typescript
const checkoutUrl = shop.checkout.createUrl({
  email: "customer@example.com",
  items: [
    { productVariantId: "variant-id-1", quantity: "2" },
    { productVariantId: "variant-id-2", quantity: "1" }
  ],
  address: {
    firstName: "John",
    lastName: "Doe",
    address1: "123 Main St",
    city: "Anytown",
    zip: "12345",
    country: "USA",
    province: "CA",
    phone: "123-456-7890"
  }
});
```

**Parameters:**
- `email` (string): Customer's email address
- `items` (array): Cart items with `productVariantId` and `quantity`
- `address` (object): Shipping address details

**Returns:** `string` - Complete checkout URL

### Utilities

Helper utilities exported for common normalization and parsing tasks.

```typescript
import { sanitizeDomain, safeParseDate } from 'shop-client';

// Normalize domains safely
sanitizeDomain('https://www.example.com');            // "example.com"
sanitizeDomain('www.example.com', { stripWWW: false }); // "www.example.com"
sanitizeDomain('http://example.com/path');            // "example.com"

// Errors on invalid input (e.g., bare hostname without suffix)
try {
  sanitizeDomain('example'); // throws
} catch (e) {
  console.error('Invalid domain');
}

// Safely parse dates (avoids Invalid Date)
safeParseDate('2024-10-31T12:34:56Z');  // Date
safeParseDate('');                      // undefined
safeParseDate('not-a-date');            // undefined
```

Notes:
- `sanitizeDomain` trims protocols, paths, and optional `www.` depending on `stripWWW`.
- Throws for invalid inputs: empty strings or hostnames missing a public suffix (e.g., `example`).
- `safeParseDate` returns `undefined` for invalid inputs; product `publishedAt` may be `null` when unavailable.

#### Release and Publishing

- Releases are automated via `semantic-release` and npm Trusted Publishing.
- The release workflow uses Node.js `22.14.0` to satisfy `semantic-release` requirements.
- npm publishes use OIDC with provenance; no `NPM_TOKEN` secret is required.
- Ensure your npm package settings add this GitHub repo as a trusted publisher and set the environment name to `npm-publish`.

### Additional Utilities

```typescript
import {
  calculateDiscount,
  extractDomainWithoutSuffix,
  generateStoreSlug,
  genProductSlug,
  detectStoreCountry,
} from 'shop-client';

// Discount calculation (percentage, rounded to nearest integer)
calculateDiscount(8000, 10000); // 20

// Extract base domain without public suffix
extractDomainWithoutSuffix('www.example.co.uk'); // 'example'

// Create an SEO-friendly store slug
generateStoreSlug('https://shop.example.com'); // 'shop-example-com'

// Create a product slug from product data
genProductSlug({
  title: 'Summer Dress',
  handle: 'summer-dress',
  vendor: 'Acme',
}); // 'acme-summer-dress'

// Detect Shopify store country with confidence score
const result = await detectStoreCountry('anuki.in');
// result.country → 'IN', result.confidence → 0.9
```

Notes:
- `calculateDiscount` expects prices in the same unit (e.g., cents) and returns an integer percentage.
- `extractDomainWithoutSuffix` removes known TLDs/suffixes, leaving the registrable label.
- `generateStoreSlug` preserves domain components and replaces separators with hyphens.
- `genProductSlug` builds a stable, vendor-prefixed slug using product fields.
- `detectStoreCountry` combines multiple signals to infer store country and confidence.

### Store Type Classification

Determine the store’s primary verticals and target audiences using showcased products. Classification uses only each product’s `body_html` content and aggregates per-product results, optionally pruned by store-level signals.

```typescript
import { ShopClient } from 'shop-client';

const shop = new ShopClient('your-store-domain.com');

const breakdown = await shop.determineStoreType({
  // Optional: provide an OpenRouter API key for online classification
  // Offline mode falls back to regex heuristics if no key is set
  apiKey: process.env.OPENROUTER_API_KEY,
  // Optional: model name when using online classification
  model: 'openai/gpt-4o-mini',
  // Optional: limit the number of showcased products sampled (default 10, max 50)
  maxShowcaseProducts: 12,
  // Note: showcased collections are not used for classification
  maxShowcaseCollections: 0,
});

// Example breakdown shape
// {
//   generic: { accessories: ['general'] },
//   adult_female: { clothing: ['dresses', 'tops'] }
// }
```

Details:
- Uses only `product.bodyHtml` for classification (no images or external text).
- Samples up to `maxShowcaseProducts` from `getInfo().showcase.products`.
- Aggregates per-product audience/vertical into a multi-audience breakdown.
- If `OPENROUTER_API_KEY` is absent or `OPENROUTER_OFFLINE=1`, uses offline regex heuristics.
- Applies store-level pruning based on title/description to improve consistency.

### AI Enrichment

```typescript
import { classifyProduct, generateSEOContent } from 'shop-client';

// Classify a single product (offline or via OpenRouter when configured)
const classification = await classifyProduct({
  title: 'Organic Cotton T-Shirt',
  bodyHtml: '<p>Soft, breathable cotton tee</p>',
  tags: ['organic', 'cotton', 'unisex'],
});
// classification → { adult_unisex: { clothing: ['t-shirts'] } }

// Generate basic SEO content for a product
const seo = await generateSEOContent({
  title: 'Organic Cotton T-Shirt',
  description: 'Soft, breathable tee for everyday wear',
  tags: ['organic', 'cotton', 'unisex'],
});
// seo.metaTitle, seo.metaDescription, seo.keywords
```

Notes:
- `classifyProduct` mirrors the store-level classification logic but operates on a single product.
- `generateSEOContent` produces lightweight, deterministic metadata suitable for catalogs and PDPs.

## 🏗️ Type Definitions

### StoreInfo

```typescript
type StoreInfo = {
  name: string;
  domain: string;
  slug: string;
  title: string | null;
  description: string | null;
  shopifyWalletId: string | null;
  myShopifySubdomain: string | null;
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
  jsonLdData: any[] | null;
};
```

### Product

```typescript
type Product = {
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
  // Keys formatted as name#value parts joined by '##' (alphabetically sorted), e.g., "color#blue##size#xl"
  variantOptionsMap: Record<string, string>;
};

#### Date Handling

- `createdAt` and `updatedAt` are parsed using a safe parser and may be `undefined` when source values are empty or invalid.
- `publishedAt` is `Date | null` and will be `null` when unavailable or invalid.

#### Variant Options Map

- Each product includes `variantOptionsMap: Record<string, string>` when variants are present.
- Keys are composed of normalized option name/value pairs in the form `name#value`, joined by `##` and sorted alphabetically for stability.
- Example: `{ "color#blue##size#xl": "123", "color#red##size#m": "456" }`.
- Normalization uses `normalizeKey` (lowercases; spaces → `_`; non-space separators like `-` remain intact).
```

### ProductVariant

```typescript
type ProductVariant = {
  id: string;
  platformId: string;
  name?: string;
  title: string;
  option1: string | null;
  option2: string | null;
  option3: string | null;
  options?: string[];
  sku: string | null;
  requiresShipping: boolean;
  taxable: boolean;
  featuredImage: ProductVariantImage | null;
  available: boolean;
  price: number;
  weightInGrams?: number;
  compareAtPrice: number;
  position: number;
  productId: number;
  createdAt?: string;
  updatedAt?: string;
};
```

### ProductVariantImage

```typescript
type ProductVariantImage = {
  id: number;
  src: string;
  position: number;
  productId: number;
  aspectRatio: number;
  variantIds: unknown[];
  createdAt: string;
  updatedAt: string;
  alt: string | null;
  width: number;
  height: number;
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
  createdAt?: string;
  updatedAt?: string;
  width: number;
  height: number;
  aspect_ratio?: number;
};
```

### ProductOption

```typescript
type ProductOption = {
  key: string;
  data: string[];
  name: string;
  position: number;
  values: string[];
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

### MetaTag

```typescript
type MetaTag =
  | { name: string; content: string }
  | { property: string; content: string }
  | { itemprop: string; content: string };
```

## 💡 Use Cases

### E-commerce Applications
- Build product catalogs and search functionality
- Create comparison shopping tools
- Develop inventory management systems

### Data Analysis
- Analyze product pricing trends
- Monitor competitor stores
- Generate market research reports

### Marketing Tools
- Create automated product feeds
- Build recommendation engines
- Generate SEO-optimized product pages

### Integration Examples
- Sync products with external databases
- Create custom checkout flows
- Build headless commerce solutions

## 🔍 Advanced Examples

### Building a Product Search

```typescript
async function searchProducts(shop: ShopClient, query: string) {
  const allProducts = await shop.products.all();
  return allProducts.filter(product => 
    product.title.toLowerCase().includes(query.toLowerCase()) ||
    product.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
  );
}
```

### Price Monitoring

```typescript
async function monitorPrices(shop: ShopClient) {
  const products = await shop.products.all();
  return products.map(product => ({
    handle: product.handle,
    title: product.title,
    currentPrice: product.price,
    originalPrice: product.compareAtPrice,
    discount: product.discount,
    onSale: product.compareAtPrice > product.price
  }));
}
```

### Collection Analysis

```typescript
async function analyzeCollections(shop: ShopClient) {
  const collections = await shop.collections.all();
  const analysis = [];
  
  for (const collection of collections) {
    const products = await shop.collections.products.all(collection.handle);
    if (products) {
      analysis.push({
        name: collection.title,
        productCount: products.length,
        averagePrice: products.reduce((sum, p) => sum + p.price, 0) / products.length,
        priceRange: {
          min: Math.min(...products.map(p => p.price)),
          max: Math.max(...products.map(p => p.price))
        }
      });
    }
  }
  
  return analysis;
}
```

## 🤖 LLM Integration

This package is designed to be LLM-friendly with comprehensive documentation and structured APIs:

### For AI Code Generation
- **Complete Type Safety**: Full TypeScript definitions enable accurate code completion and generation
- **Predictable API Patterns**: Consistent method naming and return types across all operations
- **Comprehensive Examples**: Real-world usage patterns in `/examples` directory
- **Detailed Documentation**: Technical context in `/.llm` directory for AI understanding

### For E-commerce AI Applications
- **Rich Product Data**: Complete product information including variants, pricing, and metadata
- **Structured Store Information**: Organized store data perfect for AI analysis and recommendations
- **Search-Ready Data**: Product tags, descriptions, and categories optimized for semantic search
- **Batch Operations**: Efficient data fetching for large-scale AI processing

### LLM-Friendly Resources
- [`llm.txt`](./llm.txt) - Complete repository overview and API surface
- [`/.llm/context.md`](./.llm/context.md) - Technical architecture and implementation details
- [`/.llm/api-reference.md`](./.llm/api-reference.md) - Comprehensive API documentation with examples
- [`/.llm/examples.md`](./.llm/examples.md) - Code patterns and usage examples
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) - System design and extension points
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) - Development guidelines and best practices

### AI Use Cases
- **Product Recommendation Systems**: Rich product data with relationships and metadata
- **Price Monitoring**: Automated price tracking and comparison tools
- **Inventory Analysis**: Stock level monitoring and trend analysis
- **Content Generation**: Product descriptions and marketing content creation
- **Market Research**: Competitive analysis and market trend identification

### Keywords for LLM Discovery
`shopify`, `ecommerce`, `product-data`, `store-scraping`, `typescript`, `nodejs`, `api-client`, `product-catalog`, `checkout`, `collections`, `variants`, `pricing`, `inventory`, `headless-commerce`, `ai-ready`, `llm-friendly`, `semantic-search`, `product-recommendations`, `price-monitoring`

## 🛠️ Error Handling

The library includes comprehensive error handling:

```typescript
try {
  const product = await shop.products.find("non-existent-handle");
  // Returns null for not found
} catch (error) {
  // Handles network errors, invalid domains, etc.
  console.error('Error fetching product:', error.message);
}
```

## 🔐 Security and Dependency Overrides

- This project pins vulnerable transitive dependencies using npm `overrides` to keep CI/security scans green.
- We currently force `glob` to `11.1.0` to avoid the CLI command injection vulnerability affecting `glob@10.3.7–11.0.3`.
- The library does not use the `glob` CLI; pinning removes audit warnings without impacting functionality.
- If scanners flag new CVEs, update `package.json` `overrides` and reinstall dependencies.

## ✅ Parsing Reliability Notes

- Contact link parsing is hardened to correctly detect:
  - `tel:` phone links
  - `mailto:` email links
  - `contactPage` URLs (e.g., `/pages/contact`)
- Tests cover protocol-relative social links normalization and contact page detection to prevent regressions.

## 📄 License

MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📞 Support

For questions and support, please open an issue on the GitHub repository.
