/**
 * Basic Usage Example - Shop Client Library
 *
 * This example demonstrates the basic functionality of the shop-client library
 * using the anuki.in Shopify store.
 */
import { configureRateLimit, ShopClient } from "../src/index";
import type { Product, ProductVariant } from "../src/types";

async function basicUsageExample() {
  // Optional: enable a conservative global rate limiter to avoid 429s
  configureRateLimit({
    enabled: true,
    maxRequestsPerInterval: 10,
    intervalMs: 1000,
    maxConcurrency: 3,
  });
  // Initialize the shop client with anuki.in domain
  const shop = new ShopClient("https://anuki.in");

  try {
    console.log("🏪 Fetching store information...");

    // Get store information
    const storeInfo = await shop.getInfo();
    console.log(`Store Name: ${storeInfo.name}`);
    console.log(`Store Domain: ${storeInfo.domain}`);
    console.log(
      `Store Description: ${storeInfo.description || "No description available"}`
    );
    console.log(`Store Country: ${storeInfo.country || "Not detected"}`);

    if (storeInfo.logoUrl) {
      console.log(`Store Logo: ${storeInfo.logoUrl}`);
    }

    console.log("\n📱 Social Links:");
    Object.entries(storeInfo.socialLinks).forEach(([platform, url]) => {
      console.log(`  ${platform}: ${url}`);
    });

    console.log("\n📞 Contact Information:");
    if (storeInfo.contactLinks.email) {
      console.log(`  Email: ${storeInfo.contactLinks.email}`);
    }
    if (storeInfo.contactLinks.tel) {
      console.log(`  Phone: ${storeInfo.contactLinks.tel}`);
    }

    console.log("\n🛍️ Fetching products...");

    // Get all products
    const products = (await shop.products.all({ minimal: false })) as Product[];
    console.log(`Total products found: ${products?.length || 0}`);

    if (products && products.length > 0) {
      const firstProduct = products[0];
      console.log(`\nFirst product: ${firstProduct.title}`);
      console.log(`Price: $${firstProduct.price}`);
      console.log(`Available: ${firstProduct.available}`);

      if (firstProduct.variants && firstProduct.variants.length > 0) {
        console.log(`Variants: ${firstProduct.variants.length}`);
      }
    }

    console.log("\n📦 Fetching collections...");

    // Get all collections
    const collections = await shop.collections.all();
    console.log(`Total collections found: ${collections.length}`);

    if (collections.length > 0) {
      const firstCollection = collections[0];
      console.log(`\nFirst collection: ${firstCollection.title}`);
      console.log(`Handle: ${firstCollection.handle}`);
      console.log(`Products count: ${firstCollection.productsCount}`);
    }

    const minimalProducts = await shop.products.minimal.all();
    console.log(`Minimal products found: ${minimalProducts?.length || 0}`);
    if (collections.length > 0) {
      const minimalInFirst =
        await shop.collections.products.minimal.all(collections[0].handle);
      console.log(
        `Minimal products in first collection: ${minimalInFirst?.length || 0}`
      );
    }

    console.log("\n🔍 Finding a specific product...");

    // Try to find a specific product (using the first product's handle if available)
    if (products && products.length > 0) {
      const productHandle = products[0].handle;
      const foundProduct = (await shop.products.find(productHandle, {
        minimal: false,
      })) as Product | null;

      if (foundProduct) {
        console.log(`Found product: ${foundProduct.title}`);
        console.log(`Product URL: ${foundProduct.url}`);

        if (foundProduct.variants && foundProduct.variants.length > 0) {
          console.log(`Available variants: ${foundProduct.variants.length}`);
          foundProduct.variants.forEach((variant: ProductVariant, index: number) => {
            console.log(
              `  Variant ${index + 1}: ${variant.title} - $${variant.price}`
            );
          });
        }
      }
    }
  } catch (error) {
    console.error("Error occurred:", error);
  }
}

// Run the example
basicUsageExample().catch(console.error);
