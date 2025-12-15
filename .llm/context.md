# Shop Client - Technical Context

## Architecture Overview

The `shop-client` library is built with a modular, type-safe architecture designed for extracting and transforming Shopify store data. The library follows clean architecture principles with clear separation of concerns.

### Core Design Principles

1. **Type Safety First**: Full TypeScript implementation with comprehensive type definitions
2. **Modular Architecture**: Each feature is encapsulated in its own module
3. **Error Resilience**: Graceful handling of network failures and malformed data
4. **Performance Optimized**: Efficient data fetching with automatic pagination
5. **Developer Experience**: Intuitive API with consistent patterns

## Module Breakdown

### 1. ShopClient (`src/index.ts`)
The main orchestrator class that provides a unified interface to all library functionality.

**Key Responsibilities:**
- Domain validation and normalization
- Initialization of operation modules
- Centralized error handling
- Public API surface management

**Implementation Details:**
- Validates and normalizes store domains on instantiation
- Lazy-loads operation modules for better performance
- Provides consistent error handling across all operations

**Caching & Concurrency:**
- `getInfo()` results are cached per instance with a configurable TTL via `ShopClientOptions.cacheTTL`.
- Concurrent `getInfo()` calls deduplicate by sharing the same in-flight request.
- Manual invalidation is available with `shop.clearInfoCache()`.

**Store Type Classification:**
- Method: `determineStoreType(options?)`
- Classifies showcased products using only `product.bodyHtml` (no images or external text).
- Aggregates per-product results into a multi-audience breakdown of verticals.
- Online mode requires `OPENROUTER_API_KEY`; otherwise falls back to regex heuristics.
- Applies pruning based on store-level signals (title and description) for consistency.

### 2. ProductOperations (`src/products.ts`)
Handles all product-related operations with support for various retrieval patterns.

**Key Features:**
- **Pagination Support**: Both automatic (`all()`) and manual (`paginated()`)
- **Product Search**: Find products by handle with error handling
- **Filtering**: Extract variant options for building filter UIs
- **Featured Products**: Access store's showcased products

**Data Flow:**
1. Fetch raw Shopify product data via HTTP requests
2. Transform Shopify's nested structure to flat, normalized objects
3. Apply type safety and validation
4. Return consistent Product objects

### 3. CollectionOperations (`src/collections.ts`)
Manages collection data and collection-product relationships.

**Key Features:**
- **Collection Metadata**: Fetch collection information and counts
- **Collection Products**: Access products within specific collections
- **Nested Operations**: Support for `collections.products.all()` pattern
- **Showcase Support**: Featured collections functionality

**Architecture Pattern:**
Uses composition to provide nested operation interfaces while maintaining type safety.

### 4. Store Operations (`src/store.ts`)
Extracts comprehensive store metadata and configuration.

**Data Sources:**
- HTML meta tags and structured data
- Shopify's public JSON endpoints
- Social media and contact information
- Store configuration and branding

**Output Structure:**
Provides normalized `StoreInfo` object with consistent property names regardless of source variations.

### 5. CheckoutOperations (`src/checkout.ts`)
Generates pre-filled Shopify checkout URLs with proper parameter encoding.

**Features:**
- Product variant selection
- Quantity specification
- Customer information pre-filling
- Shipping address integration
- Discount code application

### 6. Utility Functions (`src/utils/`)
Shared functionality used across modules.

**detect-country.ts:**
- TLD-based country detection
- Fallback mechanisms for edge cases
- Support for custom domains

**func.ts:**
- `sanitizeDomain(input, opts?)`: Normalizes domains by stripping protocol, paths, query, fragment, and ports; lowercases; strips `www.` by default (configurable).
- `safeParseDate(input?)`: Safely parses date strings, returning `undefined` when invalid. Use `|| null` where nullability is expected.
- Variant helpers: `normalizeKey`, `buildVariantOptionsMap`, `buildVariantKey` create stable variant option keys (`name#value` parts sorted and joined with `##`).

Domain normalization policy:
- Store info uses `sanitizeDomain` to present a registrable domain without paths/ports.
- Image URLs preserve protocol-relative forms (normalized to `https:`) but do not alter host/path.

## Data Structures

### Product Type
```typescript
interface Product {
  id: string;           // Shopify product ID
  title: string;        // Product name
  handle: string;       // URL-friendly identifier
  description: string;  // HTML description
  price: number;        // Base price in cents
  compareAtPrice?: number; // Original price for sales
  available: boolean;   // Stock availability
  images: ProductImage[]; // Product images array
  variants: ProductVariant[]; // Size, color, etc. variants
  vendor: string;       // Brand/manufacturer
  productType: string;  // Category classification
  tags: string[];       // Searchable tags
  createdAt: string;    // ISO date string
  updatedAt: string;    // ISO date string
  currency: string;     // Currency code (USD, EUR, etc.)
}
```

### Collection Type
```typescript
interface Collection {
  id: string;           // Shopify collection ID
  title: string;        // Collection name
  handle: string;       // URL-friendly identifier
  description: string;  // Collection description
  image?: string;       // Featured image URL
  productsCount: number; // Total products in collection
}
```
- **Domain Types**: Business logic representations

Key type hierarchies:
- `ShopifyProduct` → `Product` (normalized)
- `ShopifyCollection` → `Collection` (normalized)
- `ShopifyVariant` → `ProductVariant` (normalized)

## Module Breakdown

### Products Module (`src/products.ts`)

**Interface:** `ProductOperations`

**Methods:**
- `all()`: Fetches all products with automatic pagination
- `paginated(options)`: Manual pagination control
- `find(handle)`: Single product lookup
- `showcased()`: Featured products from homepage
- `filter(criteria)`: Product filtering by various criteria

**Data Flow:**
1. HTTP request to `/products.json` endpoint
2. Response parsing and validation
3. Data transformation using `productsDto()`
4. Type-safe object return

**Key Features:**
- Automatic pagination handling
- Image URL optimization
- Variant processing
- SEO metadata extraction

### Collections Module (`src/collections.ts`)

**Interface:** `CollectionOperations`

**Methods:**
- `all()`: All collections with pagination
- `find(handle)`: Single collection lookup
- `showcased()`: Featured collections
- `products.all(handle)`: All products in collection
- `products.paginated(handle, options)`: Paginated collection products

**Data Flow:**
1. Collections endpoint requests
2. Product association resolution
3. Image fallback logic (collection → first product image)
4. Normalized collection objects

### Store Module (`src/store.ts`)

**Interface:** `StoreOperations`

**Core Function:** `getStoreInfo()`

**Data Sources:**
- HTML meta tags parsing
- JSON-LD structured data extraction
- Homepage content analysis
- Social media link detection

**Extracted Information:**
- Store branding (name, logo, description)
- Contact information (phone, email, address)
- Social media presence
- Navigation structure
- Featured content (products, collections)

**Normalization Notes:**
- `domain` in `StoreInfo` is normalized via `sanitizeDomain`.
- Dates (`createdAt`, `updatedAt`, `publishedAt`) are parsed with `safeParseDate`; invalid inputs become `undefined` or `null` per field.

### Checkout Module (`src/checkout.ts`)

**Interface:** `CheckoutOperations`

**Method:** `createUrl(params)`

**Functionality:**
- Generates pre-filled Shopify checkout URLs
- Supports customer information pre-population
- Cart item specification
- Shipping address pre-filling

### Utilities (`src/utils/`)

#### `func.ts` - Core Utilities

**Functions:**
- `extractDomainWithoutSuffix()`: Domain normalization
- `generateStoreSlug()`: SEO-friendly store identifiers
- `genProductSlug()`: Product URL slug generation
- `calculateDiscount()`: Price calculation utilities

#### `detect-country.ts` - Country Detection

**Function:** `detectStoreCountry()`

**Algorithm:**
- Currency analysis from product prices
- Domain TLD examination
- Store metadata parsing
- Confidence scoring system

**Return:** `CountryDetectionResult` with confidence metrics

## Data Structures

### Product Structure

```typescript
type Product = {
  // Identifiers
  slug: string;
  handle: string;
  platformId: string | null;
  
  // Basic Info
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
  images: ProductImage[];
  
  // Variants & Options
  variants: ProductVariant[] | null;
  options: ProductOption[];
  
  // Metadata
  seo?: MetaTag[] | null;
  createdAt?: Date;
  updatedAt?: Date;
  publishedAt: Date | null;
  
  // Store Context
  storeSlug: string;
  storeDomain: string;
  url: string;
};
```

### Collection Structure

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

## Error Handling Strategy

### Error Types
1. **Network Errors**: Connection failures, timeouts
2. **API Errors**: 404s, rate limiting, server errors
3. **Validation Errors**: Invalid domains, malformed data
4. **Parsing Errors**: HTML/JSON parsing failures

### Error Handling Patterns
- **Graceful Degradation**: Return null for missing data
- **Context Preservation**: Include domain/operation context in errors
- **Retry Logic**: Automatic retries for transient failures
- **Logging**: Comprehensive error logging for debugging

## Performance Optimizations

### Request Optimization
- **Concurrent Requests**: Parallel fetching where safe
- **Request Deduplication**: Avoid duplicate API calls
- **Efficient Pagination**: Optimal page size selection

### Memory Management
- **Streaming Processing**: Large datasets processed in chunks
- **Garbage Collection**: Proper cleanup of large objects
- **Memory Pooling**: Reuse of common objects

### Caching Strategy
- **Store Metadata**: Cache store info for session duration
- **Product Images**: Optimize image URL generation
- **Collection Data**: Cache collection metadata

## Testing Strategy

### Integration Tests (`src/index.test.ts`)
- **Real Store Testing**: Tests against live Shopify stores
- **Cross-Store Validation**: Multiple store types and configurations
- **Error Scenario Testing**: Network failures, missing data

### Unit Tests (`src/utils/func.test.ts`)
- **Utility Function Testing**: Individual function validation
- **Edge Case Coverage**: Boundary conditions and error states
- **Type Safety Testing**: TypeScript compilation validation

## Build and Distribution

### Build Process (`tsup.config.ts`)
- **Dual Package**: CommonJS and ES module outputs
- **Type Generation**: Automatic .d.ts file creation
- **Tree Shaking**: Dead code elimination
- **Minification**: Production-ready output

### Package Structure
```
dist/
├── index.js          # CommonJS entry point
├── index.mjs         # ES module entry point
├── index.d.ts        # TypeScript definitions
└── [other modules]   # Individual module outputs
```

## Development Workflow

### Code Organization
- **Single Responsibility**: Each module has clear purpose
- **Interface Segregation**: Clean operation interfaces
- **Dependency Injection**: Testable, modular design

### Type Safety
- **Strict TypeScript**: No implicit any, strict null checks
- **Comprehensive Types**: Full API surface type coverage
- **Runtime Validation**: Type guards for external data

### Documentation
- **JSDoc Comments**: Comprehensive inline documentation
- **Usage Examples**: Real-world usage patterns
- **Type Examples**: TypeScript usage demonstrations

## Extension Points

### Custom Data Sources
- **Plugin Architecture**: Easy addition of new endpoints
- **Data Transformation**: Pluggable transformation pipeline
- **Custom Types**: Extensible type system

### Custom Operations
- **Operation Interfaces**: Standardized operation patterns
- **Middleware Support**: Request/response interception
- **Event Hooks**: Lifecycle event handling

This technical context provides the foundation for understanding and extending the shop-client library codebase.
