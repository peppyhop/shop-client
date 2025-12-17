# Contributing to Shop Client

Thank you for your interest in contributing to the `shop-client` library! This document provides guidelines and information for contributors.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Code Style](#code-style)
- [Testing](#testing)
- [Pull Request Process](#pull-request-process)
- [Issue Reporting](#issue-reporting)
- [Architecture Guidelines](#architecture-guidelines)
- [Release Process](#release-process)

## Getting Started

### Prerequisites

- Node.js 22+ and npm (release workflow uses Node `22.14.0`)
- TypeScript knowledge
- Familiarity with Shopify's API structure
- Git for version control

### Development Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/your-username/shop-client.git
   cd shop-client
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Build the Project**
   ```bash
   npm run build
   ```

4. **Run Tests**
   ```bash
   npm test
   ```

5. **Start Development**
   ```bash
   npm run dev
   ```

### Project Structure

```
shop-client/
├── src/
│   ├── index.ts           # Main entry point
│   ├── client.ts          # ShopClient class
│   ├── products.ts        # Product operations
│   ├── collections.ts     # Collection operations
│   ├── checkout.ts        # Checkout operations
│   ├── types.ts           # Type definitions
│   └── utils.ts           # Utility functions
├── tests/
│   ├── __mocks__/         # Test mocks
│   ├── client.test.ts     # Client tests
│   ├── products.test.ts   # Product tests
│   └── collections.test.ts # Collection tests
├── examples/
│   ├── basic-usage.ts     # Basic usage examples
│   ├── advanced-usage.ts  # Advanced examples
│   └── README.md          # Example documentation
├── .llm/                  # LLM-friendly documentation
│   ├── context.md         # Technical context
│   ├── api-reference.md   # API documentation
│   └── examples.md        # Code examples
├── dist/                  # Built files
├── docs/                  # Additional documentation
└── README.md              # Main documentation
```

## Code Style

### TypeScript Guidelines

1. **Strict Type Safety**
   ```typescript
   // ✅ Good - Explicit types and null handling
   async function getProduct(handle: string): Promise<Product | null> {
     try {
       const response = await fetch(`/products/${handle}.json`);
       if (!response.ok) return null;
       return await response.json();
     } catch {
       return null;
     }
   }
   
   // ❌ Bad - Any types and missing error handling
   async function getProduct(handle: any): Promise<any> {
     const response = await fetch(`/products/${handle}.json`);
     return response.json();
   }
   ```

4. **Type-only Imports**
   Prefer type-only imports to reduce runtime overhead and clarify intent.
   ```typescript
   // ✅ Good
   import type { Product, StoreInfo } from './types';
   import { createProductOperations } from './products';

   // ❌ Mixed when only types are needed
   import { Product, StoreInfo } from './types';
   ```

5. **Regex Hygiene**
   Avoid complex inline regex with heavy escaping inside string literals. Use `new RegExp(String.raw...)` or break patterns into focused sub-regexes.
   ```typescript
   // ✅ Focused extraction without excessive escaping
   for (const m of html.matchAll(/href=["']tel:([^"']+)["']/g)) {
     contactLinks.tel = m[1].trim();
   }
   for (const m of html.matchAll(/href=["']mailto:([^"']+)["']/g)) {
     contactLinks.email = m[1].trim();
   }
   for (const m of html.matchAll(/href=["']([^"']*(?:\/contact|\/pages\/contact)[^"']*)["']/g)) {
     contactLinks.contactPage = m[1];
   }

   // ✅ Or use String.raw for longer patterns
   const pattern = new RegExp(String.raw`<meta[^>]*name=["']description["'][^>]*content=["'](.*?)["']`, 'i');
   const description = html.match(pattern)?.[1] ?? null;
   ```

### Linting

- Run `npm run lint:fix` before committing to automatically enforce formatting and import style.
- Configure consistent type imports via ESLint or Biome (e.g., `@typescript-eslint/consistent-type-imports`).

2. **Interface Design**
   ```typescript
   // ✅ Good - Clear, specific interfaces
   interface ProductVariant {
     id: number;
     title: string;
     price: number;
     available: boolean;
     option1?: string;
     option2?: string;
     option3?: string;
   }
   
   // ❌ Bad - Vague or overly broad interfaces
   interface Variant {
     [key: string]: any;
   }
   ```

3. **Error Handling**
   ```typescript
   // ✅ Good - Graceful error handling
   async function fetchData<T>(url: string): Promise<T | null> {
     try {
       const response = await fetch(url);
       if (!response.ok) {
         console.warn(`Failed to fetch ${url}: ${response.status}`);
         return null;
       }
       return await response.json();
     } catch (error) {
       console.error(`Network error fetching ${url}:`, error);
       return null;
     }
   }
   ```

### Naming Conventions

- **Classes**: PascalCase (`ShopClient`, `ProductOperations`)
- **Methods**: camelCase (`getInfo`, `findProduct`)
- **Variables**: camelCase (`productHandle`, `storeInfo`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRIES`, `DEFAULT_TIMEOUT`)
- **Types/Interfaces**: PascalCase (`Product`, `StoreInfo`)

### Code Organization

1. **Single Responsibility**: Each class/function should have one clear purpose
2. **Dependency Injection**: Avoid hard dependencies, use constructor injection
3. **Immutability**: Prefer immutable operations where possible
4. **Pure Functions**: Minimize side effects in utility functions

## Testing

### Testing Strategy

1. **Unit Tests**: Test individual functions and classes in isolation
2. **Integration Tests**: Test API interactions with mock responses
3. **Type Tests**: Verify TypeScript type correctness
4. **Example Tests**: Ensure example code works correctly

### Writing Tests

```typescript
// Example test structure
describe('ProductOperations', () => {
  let mockFetch: jest.MockedFunction<typeof fetch>;
  let operations: ProductOperations;
  
  beforeEach(() => {
    mockFetch = jest.fn();
    global.fetch = mockFetch;
    operations = new ProductOperations('test.myshopify.com');
  });
  
  afterEach(() => {
    jest.resetAllMocks();
  });
  
  describe('all()', () => {
    it('should return products when API responds successfully', async () => {
      const mockProducts = [
        { id: 1, title: 'Test Product', handle: 'test-product' }
      ];
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ products: mockProducts })
      } as Response);
      
      const result = await operations.all();
      
      expect(result).toEqual(mockProducts);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.myshopify.com/products.json'
      );
    });
    
    it('should return null when API fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      
      const result = await operations.all();
      
      expect(result).toBeNull();
    });
  });
});
```

### Test Commands

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- products.test.ts
```

### Utilities Usage Guidelines

- Use `sanitizeDomain` for any domain normalization in code; avoid manual string parsing for domains.
- Do not construct dates with `new Date(str)` directly in DTOs or mappers; use `safeParseDate(str)` and handle `undefined`/`null` appropriately.
- When mapping product dates:
  - `createdAt` / `updatedAt` should be `undefined` if source values are invalid or empty.
  - `publishedAt` should be `null` when unavailable or invalid.
- Normalize social/contact URLs to absolute `https://` URLs when parsing store info, supporting protocol-relative (`//...`) and relative (`/...`) inputs.

## Pull Request Process

### Before Submitting

1. **Code Quality**
   - [ ] All tests pass (`npm test`)
   - [ ] Code builds successfully (`npm run build`)
   - [ ] TypeScript types are correct (`npm run type-check`)
   - [ ] Code follows style guidelines
   - [ ] No console.log statements in production code

2. **Documentation**
   - [ ] Update README.md if adding new features
   - [ ] Add JSDoc comments for new public methods
   - [ ] Update examples if API changes
   - [ ] Update type definitions if needed

3. **Testing**
   - [ ] Add tests for new functionality
   - [ ] Update existing tests if behavior changes
   - [ ] Ensure test coverage remains high
   - [ ] Test with real Shopify stores when possible

### PR Guidelines

1. **Title**: Use clear, descriptive titles
   - ✅ "Add pagination support to product operations"
   - ❌ "Fix stuff"

2. **Description**: Include:
   - What changes were made
   - Why the changes were necessary
   - How to test the changes
   - Any breaking changes

3. **Size**: Keep PRs focused and reasonably sized
   - Prefer multiple small PRs over one large PR
   - Separate refactoring from feature additions

### PR Template

```markdown
## Description
Brief description of changes made.

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] Tests pass locally
```

## Issue Reporting

### Bug Reports

When reporting bugs, please include:

1. **Environment Information**
   - Node.js version
   - Library version
   - Operating system
   - Browser (if applicable)

2. **Reproduction Steps**
   ```markdown
   1. Initialize client with domain 'example.myshopify.com'
   2. Call `client.products.all()`
   3. Observe error in console
   ```

3. **Expected vs Actual Behavior**
   - What you expected to happen
   - What actually happened
   - Error messages or logs

4. **Code Sample**
   ```typescript
   const client = new ShopClient('example.myshopify.com');
   const products = await client.products.all(); // Fails here
   ```

### Feature Requests

For feature requests, please include:

1. **Use Case**: Describe the problem you're trying to solve
2. **Proposed Solution**: How you envision the feature working
3. **Alternatives**: Other solutions you've considered
4. **Examples**: Code examples of how the feature would be used

## Architecture Guidelines

### Adding New Operations

When adding new operation classes:

1. **Follow Existing Patterns**
   ```typescript
   export class NewOperations {
     constructor(private domain: string) {}
     
     async someMethod(): Promise<SomeType | null> {
       try {
         // Implementation
       } catch (error) {
         console.error('Error in someMethod:', error);
         return null;
       }
     }
   }
   ```

2. **Update ShopClient**
   ```typescript
   export class ShopClient {
     public newOps: NewOperations;
     
     constructor(domain: string) {
       // ... existing code
       this.newOps = new NewOperations(this.domain);
     }
   }
   ```

3. **Add Type Definitions**
   ```typescript
   export interface SomeType {
     id: number;
     // ... other properties
   }
   ```

### API Design Principles

1. **Consistency**: Follow existing method naming and return patterns
2. **Null Safety**: Always return `null` for failures, never throw
3. **Type Safety**: Provide complete TypeScript definitions
4. **Documentation**: Include JSDoc comments for all public methods

### Performance Considerations

1. **Caching**: Consider caching for expensive operations
2. **Pagination**: Support pagination for large datasets
3. **Rate Limiting**: Respect Shopify's API rate limits
4. **Error Recovery**: Implement retry logic where appropriate

### Utility Usage and Normalization

- Use `sanitizeDomain` to normalize domains when presenting store info or building canonical links.
- Use `safeParseDate` for parsing incoming date strings; prefer `undefined` for invalid values and cast to `null` in DTOs where required.
- Use `normalizeKey`, `buildVariantOptionsMap`, and `buildVariantKey` to generate stable variant keys for filters and lookups.

## Release Process

### Version Numbering

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Release Checklist

1. **Pre-release**
   - [ ] All tests pass
   - [ ] Documentation updated
   - [ ] CHANGELOG.md updated
   - [ ] Version bumped in package.json

2. **Release (Automated)**
   - [ ] Push to `main` or `beta` with conventional commits
   - [ ] GitHub Actions runs tests and `semantic-release`
   - [ ] npm publish via Trusted Publishing (OIDC) with provenance
   - [ ] GitHub release notes generated automatically

3. **Post-release**
   - [ ] Verify npm package
   - [ ] Update documentation site
   - [ ] Announce in relevant channels

## Getting Help

- **Documentation**: Check README.md and examples/
- **Issues**: Search existing issues before creating new ones
- **Discussions**: Use GitHub Discussions for questions
- **Code Review**: Request reviews from maintainers

## Code of Conduct

Please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms:

- Be respectful and inclusive
- Focus on constructive feedback
- Help others learn and grow
- Maintain a professional environment

Thank you for contributing to `shop-client`! Your efforts help make e-commerce development easier for everyone.
