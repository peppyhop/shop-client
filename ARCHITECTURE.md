# Architecture Overview

## Introduction

The `shop-client` library is a TypeScript-based SDK designed to interact with Shopify stores through their public APIs. It provides a clean, type-safe interface for accessing store information, products, collections, and checkout functionality.

## Core Design Principles

### 1. Type Safety
- Full TypeScript support with comprehensive type definitions
- Strict typing for all API responses and method parameters
- Generic types for flexible yet safe data handling

### 2. Modular Architecture
- Separation of concerns through dedicated operation classes
- Clean interfaces between different functional areas
- Easy to extend and maintain

### 3. Error Resilience
- Graceful handling of network failures and API errors
- Null-safe operations with proper fallbacks
- Comprehensive error reporting

### 4. Performance Optimization
- Efficient data fetching with minimal API calls
- Smart caching strategies where applicable
- Optimized data transformation pipelines

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        ShopClient                           │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐│
│  │  ProductOps     │ │ CollectionOps   │ │  CheckoutOps    ││
│  │                 │ │                 │ │                 ││
│  │ • all()         │ │ • all()         │ │ • createUrl()   ││
│  │ • paginated()   │ │ • find()        │ │                 ││
│  │ • find()        │ │ • showcased()   │ │                 ││
│  │ • showcased()   │ │ • products.*    │ │                 ││
│  │ • filter()      │ │                 │ │                 ││
│  │ • showcase.minimal() │ │                 │ │                 ││
│  └─────────────────┘ └─────────────────┘ └─────────────────┘│
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                Store Operations                         ││
│  │ • getInfo() - Store metadata and configuration         ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                    Data Layer                               │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐│
│  │   HTTP Client   │ │  URL Builder    │ │ Data Transform  ││
│  │                 │ │                 │ │                 ││
│  │ • fetch()       │ │ • buildUrl()    │ │ • normalize()   ││
│  │ • retry logic   │ │ • params()      │ │ • validate()    ││
│  │ • error handle  │ │ • endpoints     │ │ • sanitize()    ││
│  └─────────────────┘ └─────────────────┘ └─────────────────┘│
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                  Shopify APIs                               │
│  • /products.json                                          │
│  • /collections.json                                       │
│  • /collections/{handle}/products.json                     │
│  • /cart/{variant_id}:{quantity}                           │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### ShopClient

The main entry point that orchestrates all operations:

```typescript
class ShopClient {
  private domain: string;
  public products: ProductOperations;
  public collections: CollectionOperations;
  public checkout: CheckoutOperations;
  
  constructor(domain: string) {
    // Initialize domain and operation classes
  }
  
  async getInfo(): Promise<StoreInfo | null> {
    // Fetch store metadata
  }
}
```

**Responsibilities:**
- Domain validation and normalization
- Operation class initialization
- Store information retrieval
- Error boundary management

#### Caching Strategy

- Purpose: reduce redundant network calls for relatively static store metadata.
- Scope: `getInfo()` caches the latest successful result and timestamp per `ShopClient` instance.
- TTL: configurable via constructor option `cacheTTL` (milliseconds). Defaults to 5 minutes unless overridden.
- In-flight deduplication: concurrent `getInfo()` calls share the same ongoing request to avoid bursts.
- Manual invalidation: `clearInfoCache()` resets the cached value and timestamp, forcing a refetch on next `getInfo()`.
- Instance isolation: cache is stored on the `ShopClient` instance; separate instances have independent caches.

### Utilities

Shared utility functions support consistent normalization and parsing across modules:

- `sanitizeDomain(domain, options)`: Normalizes domains by removing protocols/paths and optionally preserving `www.`. Use this for any domain handling at entry points and when rendering store metadata.
- `safeParseDate(input)`: Safely parses date strings; returns `undefined` for invalid/empty inputs. All DTOs and mappers should use this to avoid `Invalid Date` values in responses.

#### Rate Limiting

All internal HTTP requests are funneled through a global, opt-in rate limiter:

- API: `configureRateLimit({ enabled, maxRequestsPerInterval, intervalMs, maxConcurrency, perHost, perClass })`
- Mechanism: token-bucket refill per interval plus concurrency gating
- Scope: products, collections, store info, and enrichment use `rateLimitedFetch`
- Defaults (when enabled): 5 requests per 1000ms, max concurrency 5
- Disabled by default; enable once at application startup

Buckets:
- Per-host buckets via `perHost` support exact hosts and wildcard suffix (e.g., `*.myshopify.com`).
- Per-class buckets via `perClass` are chosen when `rateLimitClass` is set in RequestInit.

Resolution order: class → host → default.

Example:

```typescript
import { configureRateLimit } from 'shop-client';

configureRateLimit({
  enabled: true,
  maxRequestsPerInterval: 60,
  intervalMs: 60_000,
  maxConcurrency: 4,
});
```

Tree-Shaking & Subpath Exports
- The rate limiter’s timer starts lazily on first use; there are no import-time side effects.
- The package declares `sideEffects: false` and provides subpath exports for deep imports:
  - `shop-client/products`, `shop-client/collections`, `shop-client/checkout`, `shop-client/store`, `shop-client/rate-limit`
- Prefer deep imports for smaller bundles and faster builds.

Date handling policy:
- Product `createdAt` / `updatedAt` use safe parsing and may be `undefined` when the source is invalid.
- Product `publishedAt` is `Date | null` and defaults to `null` when unavailable or invalid.
- Collection `publishedAt` / `updatedAt` remain strings reflecting Shopify API, and should be parsed only at the consumption layer if needed.

### ProductOperations

Handles all product-related functionality:

```typescript
class ProductOperations {
  async all(): Promise<Product[] | null>
  async paginated(options: PaginationOptions): Promise<Product[] | null>
  async find(handle: string): Promise<Product | null>
  async showcased(): Promise<Product[] | null>
  async filter(): Promise<FilterOptions | null>
}
```

**Key Features:**
- Complete product catalog access
- Pagination support for large inventories
- Individual product lookup by handle
- Featured/showcased product filtering
- Dynamic filter option discovery

### CollectionOperations

Manages collection and collection-product relationships:

```typescript
class CollectionOperations {
  async all(): Promise<Collection[] | null>
  async find(handle: string): Promise<Collection | null>
  async showcased(): Promise<Collection[] | null>
  
  products: {
    async all(collectionHandle: string): Promise<Product[] | null>
    async paginated(collectionHandle: string, options: PaginationOptions): Promise<Product[] | null>
  }
}
```

**Key Features:**
- Collection metadata retrieval
- Collection-specific product fetching
- Nested product operations within collections
- Showcase collection identification

### CheckoutOperations

Handles checkout URL generation:

```typescript
class CheckoutOperations {
  createUrl(options: CheckoutOptions): string
}
```

**Key Features:**
- Cart URL generation with line items
- Customer information pre-population
- Discount code application
- Checkout attribute customization

### Store Type Classification

Determines the store’s audiences and verticals using showcased products.

**Design:**
- Input source: `StoreInfo.showcase.products` (handles → products via `products.find`).
- Text basis: strictly `product.bodyHtml` for each showcased product.
- Sampling: random sample up to `maxShowcaseProducts` (default 10, max 50).
- Online mode: calls classification via an LLM when an OpenRouter API key is provided (via `ShopClient` options or per-call `apiKey`).
- Offline mode: regex heuristics when `openRouter.offline` is enabled.
- Aggregation: per-product audience/vertical merged into `StoreTypeBreakdown`.
- Pruning: `pruneBreakdownForSignals` applies store-level signals (title/description) to reduce noise.

**Output:**
`StoreTypeBreakdown` → `{ [audience]: { [vertical]: string[] } }`.

## Data Flow

### 1. Request Initialization
```
User Request → ShopClient → Operation Class → HTTP Layer
```

### 2. Data Fetching
```
HTTP Request → Shopify API → Raw JSON Response → Data Transformation
```

### 3. Response Processing
```
Raw Data → Type Validation → Data Normalization → Typed Response
```

### 4. Error Handling
```
API Error → Error Classification → Graceful Fallback → User Notification
```

## Type System

### Core Data Types

#### Product
```typescript
interface Product {
  id: number;
  title: string;
  handle: string;
  description: string;
  price: number;           // In cents
  compareAtPrice?: number; // In cents
  available: boolean;
  currency: string;
  vendor: string;
  productType: string;
  tags: string[];
  images: ProductImage[];
  variants: ProductVariant[];
  options: ProductOption[];
  metaTags: MetaTag[];
}
```

#### Collection
```typescript
interface Collection {
  id: number;
  title: string;
  handle: string;
  description?: string;
  productsCount: number;
  image?: string;
}
```

#### StoreInfo
```typescript
interface StoreInfo {
  name: string;
  domain: string;
  description: string;
  country?: string;
  currency: string;
  socialLinks: Record<string, string>;
  showcase: {
    products: Product[];
    collections: Collection[];
  };
}
```

### Type Safety Features

1. **Strict Null Checks**: All API responses can be null, forcing proper error handling
2. **Generic Constraints**: Type parameters ensure compatibility across operations
3. **Discriminated Unions**: Clear type distinctions for different data states
4. **Branded Types**: Prevent mixing of different ID types

## Error Handling Strategy

### Error Classification

1. **Network Errors**: Connection failures, timeouts
2. **API Errors**: Invalid responses, rate limiting
3. **Data Errors**: Malformed or unexpected data structures
4. **Validation Errors**: Invalid input parameters

### Error Recovery

```typescript
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3
): Promise<T | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries) {
        console.error('Operation failed after retries:', error);
        return null;
      }
      await delay(attempt * 1000); // Exponential backoff
    }
  }
  return null;
}
```

## Performance Considerations

### Caching Strategy

1. **Store Info**: Cached for session duration
2. **Product Catalogs**: Short-term caching with invalidation
3. **Collection Metadata**: Medium-term caching
4. **Filter Options**: Cached until product catalog changes

### Optimization Techniques

1. **Lazy Loading**: Operations only execute when called
2. **Batch Requests**: Multiple operations combined where possible
3. **Data Minimization**: Only fetch required fields
4. **Connection Pooling**: Reuse HTTP connections

## Security Considerations

### Data Sanitization

All user inputs are sanitized before API requests:

```typescript
function sanitizeDomain(domain: string): string {
  return domain
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
    .trim();
}
```

### API Rate Limiting

Built-in respect for Shopify's rate limits:

```typescript
class RateLimiter {
  private requests: number[] = [];
  private readonly maxRequests = 40;
  private readonly timeWindow = 60000; // 1 minute
  
  async throttle(): Promise<void> {
    // Implementation details
  }
}
```

## Extension Points

### Custom Operations

```typescript
class CustomShopClient extends ShopClient {
  public analytics: AnalyticsOperations;
  
  constructor(domain: string) {
    super(domain);
    this.analytics = new AnalyticsOperations(this.domain);
  }
}
```

### Data Transformers

```typescript
interface DataTransformer<T, U> {
  transform(input: T): U;
  validate(input: T): boolean;
}

class ProductTransformer implements DataTransformer<RawProduct, Product> {
  transform(raw: RawProduct): Product {
    // Custom transformation logic
  }
}
```

### Custom Error Handlers

```typescript
interface ErrorHandler {
  canHandle(error: Error): boolean;
  handle(error: Error): Promise<any>;
}

class NetworkErrorHandler implements ErrorHandler {
  canHandle(error: Error): boolean {
    return error.name === 'NetworkError';
  }
  
  async handle(error: Error): Promise<any> {
    // Custom recovery logic
  }
}
```

## Testing Architecture

### Unit Testing Strategy

1. **Operation Classes**: Mock HTTP layer, test business logic
2. **Data Transformers**: Test with various input scenarios
3. **Error Handlers**: Verify proper error classification and recovery
4. **Type Guards**: Ensure runtime type safety

### Integration Testing

1. **API Compatibility**: Test against real Shopify stores
2. **Error Scenarios**: Network failures, invalid responses
3. **Performance**: Load testing with large catalogs
4. **Cross-browser**: Ensure compatibility across environments

### Test Structure

```typescript
describe('ProductOperations', () => {
  let mockClient: jest.Mocked<HttpClient>;
  let operations: ProductOperations;
  
  beforeEach(() => {
    mockClient = createMockClient();
    operations = new ProductOperations('test.myshopify.com', mockClient);
  });
  
  describe('all()', () => {
    it('should fetch all products successfully', async () => {
      // Test implementation
    });
    
    it('should handle API errors gracefully', async () => {
      // Error scenario testing
    });
  });
});
```

## Build and Deployment

### Build Pipeline

1. **TypeScript Compilation**: Source to JavaScript with type checking
2. **Bundle Generation**: Multiple output formats (ESM, CJS, UMD)
3. **Type Declaration**: Generate .d.ts files for consumers
4. **Minification**: Optimize for production use

### Distribution Strategy

```json
{
  "main": "dist/index.js",
  "module": "dist/index.esm.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.esm.js",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  }
}
```

## Future Considerations

### Planned Enhancements

1. **GraphQL Support**: Migrate to Shopify's GraphQL API
2. **Real-time Updates**: WebSocket support for live data
3. **Advanced Caching**: Redis/memory cache integration
4. **Analytics**: Built-in usage analytics and performance monitoring
5. **Internationalization**: Multi-language and currency support

### Scalability Improvements

1. **Connection Pooling**: HTTP/2 multiplexing
2. **Request Batching**: Combine multiple operations
3. **Edge Caching**: CDN integration for static data
4. **Load Balancing**: Distribute requests across regions

This architecture provides a solid foundation for reliable, performant, and maintainable e-commerce integrations while remaining flexible enough to accommodate future requirements and extensions.
