import { ShopClient } from "../index";
import type {
  ShopifySingleProduct,
  ShopifyProduct,
  ShopifyProductVariant,
  ShopifyImage,
  ShopifySingleProductVariant,
} from "../types";

describe("Date sanitization in product mapping", () => {
  test("productDto sanitizes invalid created/updated/published dates", () => {
    const shop = new ShopClient("https://example.com");

    const variant: ShopifySingleProductVariant = {
      id: 1,
      title: "v1",
      handle: "v1",
      created_at: "2020-01-01T00:00:00Z",
      updated_at: "2020-01-01T00:00:00Z",
      option1: null,
      option2: null,
      option3: null,
      sku: null,
      requires_shipping: false,
      taxable: true,
      position: 1,
      product_id: 1,
      featured_image: null,
      featured_media: null,
      available: true,
      price: "100",
      compare_at_price: null,
      inventory_quantity: 0,
      inventory_management: null,
      inventory_policy: undefined,
      fulfillment_service: undefined,
      barcode: null,
      grams: undefined,
      weight: undefined,
      weight_unit: undefined,
      requires_selling_plan: undefined,
      selling_plan_allocations: undefined,
    };

    const product: ShopifySingleProduct = {
      id: 1,
      title: "Test Product",
      handle: "test-product",
      created_at: "not-a-date",
      updated_at: "not-a-date",
      vendor: "Vendor",
      tags: [],
      options: [{ name: "Size", position: 1, values: [] }],
      description: "desc",
      published_at: "not-a-date",
      type: "type",
      price: 100,
      price_min: 100,
      price_max: 100,
      available: true,
      price_varies: false,
      compare_at_price: null,
      compare_at_price_min: 0,
      compare_at_price_max: 0,
      compare_at_price_varies: false,
      variants: [variant],
      images: [],
      featured_image: null,
      url: undefined,
      media: undefined,
      requires_selling_plan: undefined,
      selling_plan_groups: undefined,
    };

    const mapped = shop.productDto(product, {
      columns: { mode: "full", images: "full", options: "full" },
    });
    const m = mapped as any;
    expect(m.createdAt).toBeUndefined();
    expect(m.updatedAt).toBeUndefined();
    expect(m.publishedAt).toBeNull();
  });

  test("productsDto sanitizes invalid created/updated/published dates", () => {
    const shop = new ShopClient("https://example.com");

    const variant: ShopifyProductVariant = {
      id: 1,
      title: "v1",
      handle: "v1",
      created_at: "2020-01-01T00:00:00Z",
      updated_at: "2020-01-01T00:00:00Z",
      option1: null,
      option2: null,
      option3: null,
      sku: null,
      requires_shipping: false,
      taxable: true,
      position: 1,
      product_id: 1,
      featured_image: null,
      available: true,
      price: "100",
      weightInGrams: undefined,
      compare_at_price: undefined,
    };

    const image: ShopifyImage = {
      id: 1,
      title: "img",
      handle: "img",
      created_at: "2020-01-01T00:00:00Z",
      updated_at: "2020-01-01T00:00:00Z",
      width: 0,
      height: 0,
      aspect_ratio: 1,
      src: "https://example.com/img.jpg",
      position: 1,
      product_id: 1,
      variant_ids: [],
    };

    const product: ShopifyProduct = {
      id: 1,
      title: "Test Product",
      handle: "test-product",
      created_at: "not-a-date",
      updated_at: "not-a-date",
      vendor: "Vendor",
      tags: [],
      options: [{ name: "Size", position: 1, values: [] }],
      body_html: "<p>body</p>",
      body: undefined,
      published_at: "not-a-date",
      product_type: "type",
      variants: [variant],
      images: [image],
    };

    const mappedList = shop.productsDto([product], {
      columns: { mode: "full", images: "full", options: "full" },
    });
    expect(mappedList).not.toBeNull();
    const mapped = mappedList![0] as any;
    expect(mapped.createdAt).toBeUndefined();
    expect(mapped.updatedAt).toBeUndefined();
    expect(mapped.publishedAt).toBeNull();
  });
});
