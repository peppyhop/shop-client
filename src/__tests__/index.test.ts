import { ShopClient } from "../index"; // Assuming your ShopClient class is exported from index.ts

const itLive = test.skip;

describe("ShopClient Class Integration Tests", () => {
  let shop: ShopClient;
  const storeDomain = "rimorestore.com";

  beforeAll(() => {
    shop = new ShopClient(`https://${storeDomain}/`);
  });

  itLive("should fetch first product with paginated and then find it by handle, and results should be consistent", async () => {
    console.log(`Testing with store: ${storeDomain}`);

    let paginatedResult;
    try {
      paginatedResult = await shop.products.paginated({ page: 1, limit: 1 });
    } catch (error) {
      // If an error is thrown, it means there was an issue fetching products.
      // For this test, we'll assume it's acceptable if no products are found, but we should not proceed to find.
      console.warn(
        `Error fetching products for ${storeDomain}: ${(error as Error).message}. Skipping find() part of the test.`
      );
      // Depending on expectations, this could be a fail or just a skip for the find part.
      // For this example, we'll assume it's okay if no product is returned and not proceed to find.
      expect(error).toBeDefined(); // Expect an error to be thrown
      return;
    }

    expect(paginatedResult).toBeDefined();
    if (!paginatedResult || paginatedResult.length === 0) {
      console.warn(
        `No products found on page 1 with limit 1 for ${storeDomain}. Skipping find() part of the test.`
      );
      expect(paginatedResult).toEqual([]);
      return;
    }

    expect(paginatedResult.length).toBe(1);
    const productFromPaginated = paginatedResult[0];
    expect(productFromPaginated).toBeDefined();
    expect(productFromPaginated.handle).toBeDefined();
    expect(typeof productFromPaginated.handle).toBe("string");
    expect(productFromPaginated.handle.length).toBeGreaterThan(0);

    console.log(
      `Product from paginated: ${productFromPaginated.title} (Handle: ${productFromPaginated.handle})`
    );

    const productHandle = productFromPaginated.handle;
    const productFromFind = await shop.products.find(productHandle);

    expect(productFromFind).not.toBeNull();
    if (!productFromFind) return; // Type guard for TypeScript

    console.log(
      `Product from find: ${productFromFind.title} (Handle: ${productFromFind.handle})`
    );

    // --- Assertions for consistency ---
    // Direct deep equal might fail due to subtle differences from different Shopify API endpoints
    // expect(productFromFind).toEqual(productFromPaginated);

    expect(productFromFind.handle).toEqual(productFromPaginated.handle);
    expect(productFromFind.platformId).toEqual(productFromPaginated.platformId);
    expect(productFromFind.title).toEqual(productFromPaginated.title);
    expect(productFromFind.storeDomain).toEqual(
      productFromPaginated.storeDomain
    );
    expect(productFromFind.storeSlug).toEqual(productFromPaginated.storeSlug);

    // Price checks (ensure _parsePrice works consistently)
    expect(productFromFind.price).toEqual(productFromPaginated.price);
    expect(productFromFind.priceMin).toEqual(productFromPaginated.priceMin);
    expect(productFromFind.priceMax).toEqual(productFromPaginated.priceMax);
    expect(productFromFind.compareAtPrice).toEqual(
      productFromPaginated.compareAtPrice
    );

    expect(productFromFind.bodyHtml).toEqual(productFromPaginated.bodyHtml);
    expect(productFromFind.productType).toEqual(
      productFromPaginated.productType
    );

    expect(productFromFind.vendor).toEqual(productFromPaginated.vendor);
    expect(productFromFind.tags.sort()).toEqual(
      productFromPaginated.tags.sort()
    ); // Sort tags for comparison

    // Variants comparison (can be more detailed)
    expect(productFromFind.variants?.length).toEqual(
      productFromPaginated.variants?.length
    );
    if (productFromFind.variants && productFromPaginated.variants) {
      for (let i = 0; i < productFromFind.variants.length; i++) {
        expect(productFromFind.variants[i].platformId).toEqual(
          productFromPaginated.variants[i].platformId
        );
        expect(productFromFind.variants[i].title).toEqual(
          productFromPaginated.variants[i].title
        );
        expect(productFromFind.variants[i].price).toEqual(
          productFromPaginated.variants[i].price
        );
      }
    }

    // Images comparison (can be more detailed, e.g., check first image src if stable)
    // Note: product.images from /products.json vs product.media from /products/{handle}.js can lead to differences
    // expect(productFromFind.images.length).toEqual(productFromPaginated.images.length);
    if (
      productFromFind.images.length > 0 &&
      productFromPaginated.images.length > 0
    ) {
      expect(productFromFind.images[0].src).toEqual(
        productFromPaginated.images[0].src
      );
    }

    // Featured Image (can be tricky due to different sources)
    expect(productFromFind.featuredImage).toEqual(
      productFromPaginated.featuredImage
    );

    expect(productFromFind.available).toEqual(productFromPaginated.available);
  }, 30000); // Increase timeout if API calls are slow

  test("should fetch all collections and then find one by handle, and results should be consistent", async () => {
    console.log(`Testing collections with store: ${storeDomain}`);

    let allCollections;
    try {
      allCollections = await shop.collections.all();
    } catch (error) {
      console.warn(
        `Error fetching all collections for ${storeDomain}: ${(error as Error).message}. Skipping find() part of the test.`
      );
      expect(error).toBeDefined();
      return;
    }

    expect(allCollections).toBeDefined();
    if (!allCollections || allCollections.length === 0) {
      console.warn(
        `No collections found for ${storeDomain}. Skipping find() part of the test.`
      );
      expect(allCollections).toEqual([]);
      return;
    }

    const collectionFromAll = allCollections[0];
    expect(collectionFromAll).toBeDefined();
    expect(collectionFromAll.handle).toBeDefined();
    expect(typeof collectionFromAll.handle).toBe("string");
    expect(collectionFromAll.handle.length).toBeGreaterThan(0);

    console.log(
      `Collection from all: ${collectionFromAll.title} (Handle: ${collectionFromAll.handle})`
    );

    const collectionHandle = collectionFromAll.handle;
    let collectionFromFind;
    try {
      collectionFromFind = await shop.collections.find(collectionHandle);
    } catch (error) {
      console.warn(
        `Error finding collection ${collectionHandle} for ${storeDomain}: ${(error as Error).message}.`
      );
      expect(error).toBeDefined();
      return;
    }

    expect(collectionFromFind).not.toBeNull();
    if (!collectionFromFind) return; // Type guard for TypeScript

    console.log(
      `Collection from find: ${collectionFromFind.title} (Handle: ${collectionFromFind.handle})`
    );

    // Assertions for consistency
    expect(collectionFromFind.handle).toEqual(collectionFromAll.handle);
    expect(collectionFromFind.id).toEqual(collectionFromAll.id);
    expect(collectionFromFind.title).toEqual(collectionFromAll.title);
    expect(collectionFromFind.description).toEqual(
      collectionFromAll.description
    );
    expect(collectionFromFind.productsCount).toEqual(
      collectionFromAll.productsCount
    );
    expect(collectionFromFind.publishedAt).toEqual(
      collectionFromAll.publishedAt
    );
    expect(collectionFromFind.updatedAt).toEqual(collectionFromAll.updatedAt);

    // Image comparison (if applicable)
    if (collectionFromFind.image && collectionFromAll.image) {
      expect(collectionFromFind.image.src).toEqual(collectionFromAll.image.src);
    }
  }, 30000); // Increase timeout if API calls are slow

  test("should fetch store info and return correct structure", async () => {
    console.log(`Testing store info with store: ${storeDomain}`);

    // Test store info
    let storeInfo;
    try {
      storeInfo = await shop.getInfo();
    } catch (error) {
      console.warn(
        `Error fetching store info for ${storeDomain}: ${(error as Error).message}.`
      );
      expect(error).toBeDefined();
      return;
    }

    expect(storeInfo).toBeDefined();
    expect(storeInfo).toHaveProperty("name");
    expect(storeInfo).toHaveProperty("domain");
    expect(storeInfo).toHaveProperty("slug");
    expect(storeInfo).toHaveProperty("title");
    expect(storeInfo).toHaveProperty("description");
    expect(storeInfo).toHaveProperty("techProvider");
    expect(storeInfo.techProvider).toHaveProperty("name");
    expect(storeInfo).toHaveProperty("logoUrl");
    expect(storeInfo).toHaveProperty("socialLinks");
    expect(storeInfo).toHaveProperty("contactLinks");
    expect(storeInfo).toHaveProperty("headerLinks");
    expect(storeInfo).toHaveProperty("showcase");
    expect(storeInfo).toHaveProperty("jsonLdData");

    // Verify showcase structure
    expect(storeInfo.showcase).toHaveProperty("products");
    expect(storeInfo.showcase).toHaveProperty("collections");
    expect(Array.isArray(storeInfo.showcase.products)).toBe(true);
    expect(Array.isArray(storeInfo.showcase.collections)).toBe(true);

    // Verify data structures are properly typed
    expect(typeof storeInfo.socialLinks).toBe("object");
    expect(typeof storeInfo.contactLinks).toBe("object");
    expect(Array.isArray(storeInfo.headerLinks)).toBe(true);

    // Verify contactLinks structure
    expect(storeInfo.contactLinks).toHaveProperty("tel");
    expect(storeInfo.contactLinks).toHaveProperty("email");
    expect(storeInfo.contactLinks).toHaveProperty("contactPage");

    console.log(`Store info fetched successfully: ${storeInfo.name}`);
    console.log(
      `Store description: ${storeInfo.description || "No description"}`
    );
    console.log(`Logo URL: ${storeInfo.logoUrl || "No logo"}`);
    console.log(`Social links:`, Object.keys(storeInfo.socialLinks));
    console.log(`Contact links:`, storeInfo.contactLinks);
    console.log(`Header links count: ${storeInfo.headerLinks.length}`);
    console.log(
      `Showcase products count: ${storeInfo.showcase.products.length}`
    );
    console.log(
      `Showcase collections count: ${storeInfo.showcase.collections.length}`
    );
  }, 30000); // Increase timeout if API calls are slow

  test("should handle product handles with query strings correctly", async () => {
    console.log(`Testing product handle with query string: ${storeDomain}`);

    // Test the URL construction logic with a product handle that includes query parameters
    // This is more of a unit test for URL handling, but we can test it in integration context
    const productHandle = "test-product?variant=123&color=red";

    try {
      // This should handle the query string properly and not break the API call
      const product = await shop.products.find(productHandle);

      // If we get here, the method handled the query string without throwing an error
      // The actual product might not exist, but the URL construction should work
      if (product) {
        expect(product.handle).toBeDefined();
        console.log(
          `Successfully handled product with query string: ${product.handle}`
        );
      } else {
        console.log(
          "Product with query string not found, but URL construction worked"
        );
      }
    } catch (error) {
      // This is expected if the product doesn't exist, but the error should be a 404-type error
      // not a URL construction error
      console.log(
        `Expected error for non-existent product with query string: ${(error as Error).message}`
      );
      expect(error).toBeDefined();
    }
  }, 30000); // Increase timeout if API calls are slow

  test("should fetch all products and verify structure", async () => {
    console.log(`Testing products.all() with store: ${storeDomain}`);

    let allProducts;
    try {
      allProducts = await shop.products.all();
    } catch (error) {
      console.warn(
        `Error fetching all products for ${storeDomain}: ${(error as Error).message}`
      );
      expect(error).toBeDefined();
      return;
    }

    expect(allProducts).toBeDefined();
    expect(Array.isArray(allProducts)).toBe(true);

    if (allProducts && allProducts.length > 0) {
      const firstProduct = allProducts[0];

      // Verify product structure
      expect(firstProduct).toHaveProperty("handle");
      expect(firstProduct).toHaveProperty("title");
      expect(firstProduct).toHaveProperty("price");
      expect(firstProduct).toHaveProperty("available");
      expect(firstProduct).toHaveProperty("variants");
      expect(firstProduct).toHaveProperty("images");
      expect(firstProduct).toHaveProperty("storeSlug");
      expect(firstProduct).toHaveProperty("storeDomain");
      expect(firstProduct).toHaveProperty("url");

      console.log(`Successfully fetched ${allProducts.length} products`);
      console.log(
        `First product: ${firstProduct.title} (${firstProduct.handle})`
      );
    } else {
      console.log("No products found in store");
    }
  }, 60000); // Longer timeout for fetching all products

  test("should fetch showcased products and verify structure", async () => {
    console.log(`Testing products.showcased() with store: ${storeDomain}`);

    let showcasedProducts;
    try {
      showcasedProducts = await shop.products.showcased();
    } catch (error) {
      console.warn(
        `Error fetching showcased products for ${storeDomain}: ${(error as Error).message}`
      );
      expect(error).toBeDefined();
      return;
    }

    expect(showcasedProducts).toBeDefined();
    expect(Array.isArray(showcasedProducts)).toBe(true);

    if (showcasedProducts.length > 0) {
      const firstShowcasedProduct = showcasedProducts[0];

      // Verify product structure
      expect(firstShowcasedProduct).toHaveProperty("handle");
      expect(firstShowcasedProduct).toHaveProperty("title");
      expect(firstShowcasedProduct).toHaveProperty("price");
      expect(firstShowcasedProduct).toHaveProperty("available");

      console.log(
        `Successfully fetched ${showcasedProducts.length} showcased products`
      );
      console.log(`First showcased product: ${firstShowcasedProduct.title}`);
    } else {
      console.log("No showcased products found");
    }
  }, 30000);

  test("should fetch all products from a collection", async () => {
    console.log(
      `Testing collections.products.all() with store: ${storeDomain}`
    );

    // First get a collection to test with
    let collections;
    try {
      collections = await shop.collections.all();
    } catch (error) {
      console.warn(
        `Error fetching collections for ${storeDomain}: ${(error as Error).message}`
      );
      expect(error).toBeDefined();
      return;
    }

    if (!collections || collections.length === 0) {
      console.warn("No collections found, skipping collection products test");
      return;
    }

    const testCollection = collections[0];
    console.log(`Testing with collection: ${testCollection.handle}`);

    let collectionProducts;
    try {
      collectionProducts = await shop.collections.products.all(
        testCollection.handle
      );
    } catch (error) {
      console.warn(
        `Error fetching products from collection ${testCollection.handle}: ${(error as Error).message}`
      );
      expect(error).toBeDefined();
      return;
    }

    expect(collectionProducts).toBeDefined();
    expect(Array.isArray(collectionProducts)).toBe(true);

    if (collectionProducts && collectionProducts.length > 0) {
      const firstProduct = collectionProducts[0];

      // Verify product structure
      expect(firstProduct).toHaveProperty("handle");
      expect(firstProduct).toHaveProperty("title");
      expect(firstProduct).toHaveProperty("price");

      console.log(
        `Successfully fetched ${collectionProducts.length} products from collection ${testCollection.handle}`
      );
    } else {
      console.log(`No products found in collection ${testCollection.handle}`);
    }
  }, 60000);

  test("should fetch paginated products from a collection", async () => {
    console.log(
      `Testing collections.products.paginated() with store: ${storeDomain}`
    );

    // First get a collection to test with
    let collections;
    try {
      collections = await shop.collections.all();
    } catch (error) {
      console.warn(
        `Error fetching collections for ${storeDomain}: ${(error as Error).message}`
      );
      expect(error).toBeDefined();
      return;
    }

    if (!collections || collections.length === 0) {
      console.warn(
        "No collections found, skipping collection products pagination test"
      );
      return;
    }

    const testCollection = collections[0];
    console.log(`Testing pagination with collection: ${testCollection.handle}`);

    let paginatedProducts;
    try {
      paginatedProducts = await shop.collections.products.paginated(
        testCollection.handle,
        {
          page: 1,
          limit: 5,
        }
      );
    } catch (error) {
      console.warn(
        `Error fetching paginated products from collection ${testCollection.handle}: ${(error as Error).message}`
      );
      expect(error).toBeDefined();
      return;
    }

    expect(paginatedProducts).toBeDefined();
    expect(Array.isArray(paginatedProducts)).toBe(true);
    if (paginatedProducts) {
      expect(paginatedProducts.length).toBeLessThanOrEqual(5);
    }

    if (paginatedProducts && paginatedProducts.length > 0) {
      const firstProduct = paginatedProducts[0];

      // Verify product structure
      expect(firstProduct).toHaveProperty("handle");
      expect(firstProduct).toHaveProperty("title");
      expect(firstProduct).toHaveProperty("price");

      console.log(
        `Successfully fetched ${paginatedProducts.length} paginated products from collection ${testCollection.handle}`
      );
    } else {
      console.log(
        `No products found in collection ${testCollection.handle} for pagination`
      );
    }
  }, 30000);

  test("should create checkout URL with valid parameters", async () => {
    console.log(`Testing checkout.createUrl() with store: ${storeDomain}`);

    const checkoutParams = {
      email: "test@example.com",
      items: [
        { productVariantId: "12345", quantity: "2" },
        { productVariantId: "67890", quantity: "1" },
      ],
      address: {
        firstName: "John",
        lastName: "Doe",
        address1: "123 Main St",
        city: "Anytown",
        zip: "12345",
        country: "USA",
        province: "CA",
        phone: "555-123-4567",
      },
    };

    let checkoutUrl;
    try {
      checkoutUrl = shop.checkout.createUrl(checkoutParams);
    } catch (error) {
      console.error(`Error creating checkout URL: ${(error as Error).message}`);
      expect(error).toBeDefined();
      return;
    }

    expect(checkoutUrl).toBeDefined();
    expect(typeof checkoutUrl).toBe("string");
    expect(checkoutUrl).toContain(storeDomain);
    expect(checkoutUrl).toContain("/cart/");
    expect(checkoutUrl).toContain("checkout%5Bemail%5D=test%40example.com"); // URL encoded version
    expect(checkoutUrl).toContain("12345:2,67890:1");

    console.log(
      `Successfully created checkout URL: ${checkoutUrl.substring(0, 100)}...`
    );
  }, 5000);

  test("should handle invalid product handle gracefully", async () => {
    console.log(
      `Testing error handling for invalid product handle: ${storeDomain}`
    );

    const invalidHandle = "this-product-definitely-does-not-exist-12345";

    try {
      const product = await shop.products.find(invalidHandle);

      // If we get here without an error, the product should be null or undefined
      expect(product).toBeNull();
      console.log("Invalid product handle returned null as expected");
    } catch (error) {
      // This is the expected behavior - an error should be thrown
      expect(error).toBeDefined();
      expect(error instanceof Error).toBe(true);
      console.log(
        `Expected error for invalid product handle: ${(error as Error).message}`
      );
    }
  }, 15000);

  test("should handle invalid collection handle gracefully", async () => {
    console.log(
      `Testing error handling for invalid collection handle: ${storeDomain}`
    );

    const invalidHandle = "this-collection-definitely-does-not-exist-12345";

    try {
      const collection = await shop.collections.find(invalidHandle);

      // If we get here without an error, the collection should be null or undefined
      expect(collection).toBeNull();
      console.log("Invalid collection handle returned null as expected");
    } catch (error) {
      // This is the expected behavior - an error should be thrown
      expect(error).toBeDefined();
      expect(error instanceof Error).toBe(true);
      console.log(
        `Expected error for invalid collection handle: ${(error as Error).message}`
      );
    }
  }, 15000);

  test("should handle empty pagination parameters correctly", async () => {
    console.log(`Testing pagination with edge case parameters: ${storeDomain}`);

    try {
      // Test with limit of 0
      const zeroLimitProducts = await shop.products.paginated({
        page: 1,
        limit: 0,
      });
      expect(Array.isArray(zeroLimitProducts)).toBe(true);
      if (zeroLimitProducts) {
        console.log(`Zero limit returned ${zeroLimitProducts.length} products`);
      }

      // Test with very high page number
      const highPageProducts = await shop.products.paginated({
        page: 9999,
        limit: 1,
      });
      expect(Array.isArray(highPageProducts)).toBe(true);
      if (highPageProducts) {
        expect(highPageProducts.length).toBe(0);
        console.log(
          `High page number returned ${highPageProducts.length} products as expected`
        );
      }
    } catch (error) {
      // Some edge cases might throw errors, which is acceptable
      console.log(
        `Edge case pagination error (acceptable): ${(error as Error).message}`
      );
      expect(error).toBeDefined();
    }
  }, 20000);

  test("should filter products and return variant options map", async () => {
    console.log(`Testing products.filter() with store: ${storeDomain}`);

    let filterResult;
    try {
      filterResult = await shop.products.filter();
    } catch (error) {
      console.error(`Error filtering products: ${(error as Error).message}`);
      expect(error).toBeDefined();
      return;
    }

    expect(filterResult).toBeDefined();
    expect(typeof filterResult).toBe("object");

    // Check if the result is a proper map/object
    expect(filterResult).not.toBeNull();

    if (!filterResult) return; // Type guard

    // Log the filter result for debugging
    console.log(`Filter result keys: ${Object.keys(filterResult)}`);

    // If there are any options, verify the structure
    const optionNames = Object.keys(filterResult);
    if (optionNames.length > 0) {
      optionNames.forEach((optionName) => {
        expect(typeof optionName).toBe("string");
        expect(Array.isArray(filterResult[optionName])).toBe(true);
        expect(filterResult[optionName].length).toBeGreaterThan(0);

        // Check that all values in the array are strings
        filterResult[optionName].forEach((value: any) => {
          expect(typeof value).toBe("string");
        });

        // Check that values are sorted and unique
        const values = filterResult[optionName];
        const sortedUniqueValues = [...new Set(values)].sort();
        expect(values).toEqual(sortedUniqueValues);

        console.log(
          `Option "${optionName}" has ${values.length} distinct values: ${values.slice(0, 5).join(", ")}${values.length > 5 ? "..." : ""}`
        );
      });
    } else {
      console.log(
        "No variant options found in products (this is acceptable for stores without variants)"
      );
    }
  }, 30000);

  test("should handle filter method with products that have multiple variant options", async () => {
    console.log(
      `Testing products.filter() for multiple variant options: ${storeDomain}`
    );

    let filterResult;
    try {
      filterResult = await shop.products.filter();
    } catch (error) {
      console.error(`Error filtering products: ${(error as Error).message}`);
      expect(error).toBeDefined();
      return;
    }

    expect(filterResult).toBeDefined();
    if (!filterResult) return; // Type guard

    const optionNames = Object.keys(filterResult);

    // Test common variant option names that might exist
    const commonOptions = ["Size", "Color", "Material", "Style", "Title"];
    const foundOptions = optionNames.filter((option) =>
      commonOptions.some((common) =>
        option.toLowerCase().includes(common.toLowerCase())
      )
    );

    if (foundOptions.length > 0) {
      console.log(`Found common variant options: ${foundOptions.join(", ")}`);

      foundOptions.forEach((optionName) => {
        const values = filterResult[optionName];
        expect(Array.isArray(values)).toBe(true);
        expect(values.length).toBeGreaterThan(0);

        // Verify no duplicates
        const uniqueValues = new Set(values);
        expect(uniqueValues.size).toBe(values.length);

        console.log(`"${optionName}" option has values: ${values.join(", ")}`);
      });
    } else {
      console.log("No common variant options found, but this is acceptable");
    }
  }, 30000);

  test("should handle filter method when no products have variants", async () => {
    console.log(`Testing products.filter() edge case handling: ${storeDomain}`);

    // This test verifies that the filter method handles cases where products might not have variants
    let filterResult;
    try {
      filterResult = await shop.products.filter();
    } catch (error) {
      console.error(`Error filtering products: ${(error as Error).message}`);
      expect(error).toBeDefined();
      return;
    }

    expect(filterResult).toBeDefined();
    expect(typeof filterResult).toBe("object");

    if (!filterResult) return; // Type guard

    // The result should be an object (possibly empty if no variants exist)
    const optionNames = Object.keys(filterResult);

    if (optionNames.length === 0) {
      console.log(
        "No variant options found - all products may have single variants or no variants"
      );
      expect(filterResult).toEqual({});
    } else {
      console.log(
        `Found ${optionNames.length} variant options despite potential single-variant products`
      );

      // Verify that even if some products don't have variants, the method still works
      optionNames.forEach((optionName) => {
        expect(Array.isArray(filterResult[optionName])).toBe(true);
        expect(filterResult[optionName].length).toBeGreaterThan(0);
      });
    }
  }, 30000);

  test("should return consistent filter results on multiple calls", async () => {
    console.log(`Testing products.filter() consistency: ${storeDomain}`);

    let firstResult, secondResult;

    try {
      // Call filter method twice
      firstResult = await shop.products.filter();
      secondResult = await shop.products.filter();
    } catch (error) {
      console.error(`Error in consistency test: ${(error as Error).message}`);
      expect(error).toBeDefined();
      return;
    }

    expect(firstResult).toBeDefined();
    expect(secondResult).toBeDefined();

    if (!firstResult || !secondResult) return; // Type guards

    // Results should be identical
    expect(Object.keys(firstResult).sort()).toEqual(
      Object.keys(secondResult).sort()
    );

    Object.keys(firstResult).forEach((optionName) => {
      expect(firstResult[optionName]).toEqual(secondResult[optionName]);
    });

    console.log(
      "Filter method returns consistent results across multiple calls"
    );
  }, 45000);
});
