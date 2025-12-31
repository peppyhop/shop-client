import { configureRateLimit, ShopClient } from "../src/index";
import type { Product, ProductVariant } from "../src/types";

async function advancedUsageExample() {
  // Enable and configure global rate limiting for all internal requests
  configureRateLimit({
    enabled: true,
    maxRequestsPerInterval: 30, // 30 requests
    intervalMs: 1000, // per second
    maxConcurrency: 6, // up to 6 in parallel
  });

  // Initialize the shop client with anuki.in domain
  const shop = new ShopClient("https://anuki.in", {
    openRouter: { apiKey: "YOUR_OPENROUTER_API_KEY", model: "openai/gpt-4o-mini" },
  });

  try {
    console.log("🚀 Advanced Shop Client Library Example");
    console.log("==========================================\n");

    // 1. Comprehensive Store Analysis
    console.log("📊 Comprehensive Store Analysis...");
    const storeInfo = await shop.getInfo();

    console.log(`\n🏪 Store Details:`);
    console.log(`  Name: ${storeInfo.name}`);
    console.log(`  Domain: ${storeInfo.domain}`);
    console.log(`  Slug: ${storeInfo.slug}`);
    console.log(`  Country: ${storeInfo.country || "Not detected"}`);
    console.log(`  Tech Provider: ${storeInfo.techProvider.name}`);

    if (storeInfo.techProvider.subDomain) {
      console.log(`  Shopify Subdomain: ${storeInfo.techProvider.subDomain}`);
    }

    console.log(`\n🎨 Branding & Assets:`);
    console.log(`  Title: ${storeInfo.title || "Not set"}`);
    console.log(`  Description: ${storeInfo.description || "Not set"}`);
    console.log(`  Logo URL: ${storeInfo.logoUrl || "Not available"}`);

    console.log(`\n🌐 Social Presence:`);
    const socialCount = Object.keys(storeInfo.socialLinks).length;
    console.log(`  Social platforms: ${socialCount}`);
    Object.entries(storeInfo.socialLinks).forEach(([platform, url]) => {
      console.log(`    ${platform}: ${url}`);
    });

    console.log(`\n📞 Contact Information:`);
    console.log(`  Email: ${storeInfo.contactLinks.email || "Not provided"}`);
    console.log(`  Phone: ${storeInfo.contactLinks.tel || "Not provided"}`);
    console.log(
      `  Contact Page: ${storeInfo.contactLinks.contactPage || "Not available"}`
    );

    console.log(`\n🧭 Navigation:`);
    console.log(`  Header links: ${storeInfo.headerLinks.length}`);
    storeInfo.headerLinks.forEach((link, index) => {
      console.log(`    ${index + 1}. ${link}`);
    });

    console.log(`\n⭐ Showcase Content:`);
    console.log(`  Featured products: ${storeInfo.showcase.products.length}`);
    console.log(
      `  Featured collections: ${storeInfo.showcase.collections.length}`
    );

    // 2. Advanced Product Operations
    console.log("\n🛍️ Advanced Product Operations...");

    // Get showcased products first
    const showcasedProducts = (await shop.products.showcased()) as Product[];
    console.log(`\n🌟 Showcased Products: ${showcasedProducts.length}`);

    showcasedProducts.slice(0, 3).forEach((product: Product, index: number) => {
      console.log(`  ${index + 1}. ${product.title}`);
      console.log(`     Price: $${(product.price / 100).toFixed(2)}`);
      console.log(`     Available: ${product.available ? "Yes" : "No"}`);
      console.log(`     Variants: ${product.variants?.length || 0}`);
      console.log(
        `     Tags: ${product.tags.slice(0, 3).join(", ")}${product.tags.length > 3 ? "..." : ""}`
      );
    });

    // Get paginated products for analysis
    console.log("\n📄 Paginated Product Analysis...");
    const firstPage = (await shop.products.paginated({
      page: 1,
      limit: 10,
      minimal: false,
    })) as Product[];

    if (firstPage && firstPage.length > 0) {
      console.log(`  First page: ${firstPage.length} products`);

      // Analyze pricing
      const prices = firstPage.map((p: Product) => p.price / 100);
      const avgPrice =
        prices.reduce((a: number, b: number) => a + b, 0) / prices.length;
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);

      console.log(`  Price Analysis:`);
      console.log(`    Average: $${avgPrice.toFixed(2)}`);
      console.log(
        `    Range: $${minPrice.toFixed(2)} - $${maxPrice.toFixed(2)}`
      );

      // Analyze availability
      const availableCount = firstPage.filter((p: Product) => p.available).length;
      console.log(
        `  Availability: ${availableCount}/${firstPage.length} products available`
      );

      // Analyze vendors
      const vendors = [...new Set(firstPage.map((p: Product) => p.vendor))];
      console.log(`  Vendors: ${vendors.length} unique vendors`);
      vendors.slice(0, 3).forEach((vendor) => {
        const count = firstPage.filter((p) => p.vendor === vendor).length;
        console.log(`    ${vendor}: ${count} products`);
      });
    }

    // 3. Product Filtering and Search
    console.log("\n🔍 Product Filtering and Search...");

    const filters = await shop.products.filter();
    if (filters && Object.keys(filters).length > 0) {
      console.log(`\n🏷️ Available Filters:`);
      Object.entries(filters).forEach(([filterName, values]) => {
        console.log(`  ${filterName}: ${values.length} options`);
        console.log(
          `    Values: ${values.slice(0, 5).join(", ")}${values.length > 5 ? "..." : ""}`
        );
      });
    } else {
      console.log("  No product filters available");
    }

    // Find a specific product for detailed analysis
    if (showcasedProducts.length > 0) {
      const productHandle = showcasedProducts[0].handle;
      console.log(`\n🔎 Detailed Product Analysis: ${productHandle}`);

      const detailedProduct = (await shop.products.find(productHandle, {
        minimal: false,
      })) as Product | null;
      if (detailedProduct) {
        console.log(`  Title: ${detailedProduct.title}`);
        console.log(
          `  Type: ${detailedProduct.productType || "Not specified"}`
        );
        console.log(`  Vendor: ${detailedProduct.vendor}`);
        console.log(`  URL: ${detailedProduct.url}`);
        console.log(
          `  Created: ${detailedProduct.createdAt?.toLocaleDateString() || "Unknown"}`
        );
        console.log(
          `  Published: ${detailedProduct.publishedAt?.toLocaleDateString() || "Unknown"}`
        );

        if (detailedProduct.variants && detailedProduct.variants.length > 0) {
          console.log(`  Variants Analysis:`);
          console.log(`    Total variants: ${detailedProduct.variants.length}`);

          const variantPrices = detailedProduct.variants.map(
            (v: ProductVariant) => v.price / 100
          );
          const variantAvgPrice =
            variantPrices.reduce(
              (a: number, b: number) => a + b,
              0
            ) / variantPrices.length;
          console.log(
            `    Average variant price: $${variantAvgPrice.toFixed(2)}`
          );

          const availableVariants = detailedProduct.variants.filter(
            (v: ProductVariant) => v.available
          ).length;
          console.log(
            `    Available variants: ${availableVariants}/${detailedProduct.variants.length}`
          );

          // Show first few variants
          detailedProduct.variants
            .slice(0, 3)
            .forEach((variant: ProductVariant, index: number) => {
            console.log(`    Variant ${index + 1}: ${variant.title}`);
            console.log(`      Price: $${(variant.price / 100).toFixed(2)}`);
            console.log(`      Available: ${variant.available ? "Yes" : "No"}`);
            console.log(`      SKU: ${variant.sku || "Not set"}`);
          });
        }

        if (detailedProduct.images.length > 0) {
          console.log(`  Images: ${detailedProduct.images.length} total`);
          console.log(
            `    Featured image: ${detailedProduct.featuredImage || "Not set"}`
          );
        }

        if (detailedProduct.options.length > 0) {
          console.log(`  Product Options:`);
          detailedProduct.options.forEach((option) => {
            console.log(`    ${option.name}: ${option.values.join(", ")}`);
          });
        }
      }

      const enriched = await shop.products.enriched(productHandle, {
        inputType: "markdown",
      });
      console.log(
        `  Enriched content preview: ${enriched?.enriched_content?.slice(0, 200) || ""}`
      );
    }

    // 4. Collection Operations
    console.log("\n📦 Advanced Collection Operations...");

    const allCollections = await shop.collections.all();
    console.log(`\n📚 All Collections: ${allCollections.length}`);

    if (allCollections.length > 0) {
      // Analyze collections
      const totalProducts = allCollections.reduce(
        (sum, col) => sum + col.productsCount,
        0
      );
      const avgProductsPerCollection = totalProducts / allCollections.length;

      console.log(`  Total products across collections: ${totalProducts}`);
      console.log(
        `  Average products per collection: ${avgProductsPerCollection.toFixed(1)}`
      );

      // Show top collections by product count
      const sortedCollections = [...allCollections].sort(
        (a, b) => b.productsCount - a.productsCount
      );
      console.log(`\n🏆 Top Collections by Product Count:`);
      sortedCollections.slice(0, 5).forEach((collection, index) => {
        console.log(
          `  ${index + 1}. ${collection.title} (${collection.productsCount} products)`
        );
        console.log(`     Handle: ${collection.handle}`);
        console.log(
          `     Description: ${collection.description || "No description"}`
        );
      });
    }

    // Get showcased collections
    const showcasedCollections = await shop.collections.showcased();
    console.log(`\n⭐ Showcased Collections: ${showcasedCollections.length}`);

    showcasedCollections.forEach((collection, index) => {
      console.log(`  ${index + 1}. ${collection.title}`);
      console.log(`     Products: ${collection.productsCount}`);
      console.log(`     Handle: ${collection.handle}`);
    });

    // Analyze a specific collection's products
    if (allCollections.length > 0) {
      const targetCollection = allCollections[0];
      console.log(
        `\n🔍 Collection Product Analysis: ${targetCollection.title}`
      );

      const collectionProducts = (await shop.collections.products.all(
        targetCollection.handle,
        { minimal: false }
      )) as Product[] | null;
      if (collectionProducts && collectionProducts.length > 0) {
        console.log(`  Products in collection: ${collectionProducts.length}`);

        // Analyze collection products
        const collectionPrices = collectionProducts.map(
          (p: Product) => p.price / 100
        );
        const collectionAvgPrice =
          collectionPrices.reduce((a, b) => a + b, 0) / collectionPrices.length;
        const collectionMinPrice = Math.min(...collectionPrices);
        const collectionMaxPrice = Math.max(...collectionPrices);

        console.log(
          `  Price range: $${collectionMinPrice.toFixed(2)} - $${collectionMaxPrice.toFixed(2)}`
        );
        console.log(`  Average price: $${collectionAvgPrice.toFixed(2)}`);

        const collectionAvailable = collectionProducts.filter(
          (p: Product) => p.available
        ).length;
        console.log(
          `  Available products: ${collectionAvailable}/${collectionProducts.length}`
        );

        // Show sample products
        console.log(`  Sample products:`);
        collectionProducts.slice(0, 3).forEach((product: Product, index: number) => {
          console.log(
            `    ${index + 1}. ${product.title} - $${(product.price / 100).toFixed(2)}`
          );
        });
      }
    }

    const minimalAllProducts = await shop.products.minimal.all();
    console.log(`\n🧪 Minimal products: ${(minimalAllProducts || []).length}`);
    if (allCollections.length > 0) {
      const minimalCollectionProducts =
        await shop.collections.products.minimal.all(allCollections[0].handle);
      console.log(
        `Minimal products in first collection: ${minimalCollectionProducts?.length || 0}`
      );
    }
    const minimalShowcased = await shop.products.showcase.minimal();
    console.log(`Minimal showcased products: ${(minimalShowcased || []).length}`);
    console.log("\n✅ Advanced analysis completed successfully!");
    console.log("==========================================");
  } catch (error) {
    console.error("❌ Error in advanced example:", error);

    if (error instanceof Error) {
      console.error("Error details:", {
        message: error.message,
        name: error.name,
        stack: error.stack?.split("\n").slice(0, 3).join("\n"),
      });
    }
  }
}

// Run the advanced example
advancedUsageExample().catch(console.error);
