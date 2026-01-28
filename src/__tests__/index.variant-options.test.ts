import { ShopClient } from "../index";
import type {
    ShopifyImage,
    ShopifyProduct,
    ShopifyProductVariant,
    ShopifySingleProduct,
    ShopifySingleProductVariant,
} from "../types";

describe("variantOptionsMap in product DTOs", () => {
  test("productsDto includes variantOptionsMap with normalized keys", () => {
    const shop = new ShopClient("https://example.com");

    const variants: ShopifyProductVariant[] = [
      {
        id: 1,
        title: "v1",
        handle: "v1",
        created_at: "2020-01-01T00:00:00Z",
        updated_at: "2020-01-01T00:00:00Z",
        option1: "XL",
        option2: "Blue",
        option3: null,
        sku: "SKU-XL-BLUE",
        requires_shipping: false,
        taxable: true,
        position: 1,
        product_id: 1,
        featured_image: null,
        available: false,
        price: "100",
        weightInGrams: undefined,
        compare_at_price: undefined,
      },
      {
        id: 2,
        title: "v2",
        handle: "v2",
        created_at: "2020-01-01T00:00:00Z",
        updated_at: "2020-01-01T00:00:00Z",
        option1: "XL",
        option2: "Red",
        option3: null,
        sku: "SKU-XL-RED",
        requires_shipping: false,
        taxable: true,
        position: 2,
        product_id: 1,
        featured_image: null,
        available: true,
        price: "110",
        weightInGrams: undefined,
        compare_at_price: undefined,
      },
    ];

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
      variant_ids: ["1"],
    };

    const product: ShopifyProduct = {
      id: 1,
      title: "Test Product",
      handle: "test-product",
      created_at: "2020-01-01T00:00:00Z",
      updated_at: "2020-01-01T00:00:00Z",
      vendor: "Vendor",
      tags: [],
      options: [
        { name: "Size", position: 1, values: ["XL", "L"] },
        { name: "Color", position: 2, values: ["Blue", "Red"] },
      ],
      body_html: "<p>body</p>",
      body: undefined,
      published_at: "2020-01-01T00:00:00Z",
      product_type: "type",
      variants,
      images: [image],
    };

    const mappedList = shop.productsDto([product]);
    expect(mappedList).not.toBeNull();
    const mapped = mappedList![0];

    expect(mapped.variantOptionsMap).toEqual({
      "color__blue____size__xl": "1",
      "color__red____size__xl": "2",
    });
    expect(mapped.variantPriceMap).toEqual({
      "color__blue____size__xl": 10000,
      "color__red____size__xl": 11000,
    });
    expect(mapped.variantSkuMap).toEqual({
      "color__blue____size__xl": "SKU-XL-BLUE",
      "color__red____size__xl": "SKU-XL-RED",
    });
    expect(mapped.variantAvailabilityMap).toEqual({
      "color__blue____size__xl": false,
      "color__red____size__xl": true,
    });
    expect(mapped.variantImages).toEqual({
      "1": ["https://example.com/img.jpg"],
    });
  });

  test("productDto includes variantOptionsMap with three options when present", () => {
    const shop = new ShopClient("https://example.com");

    const variants: ShopifySingleProductVariant[] = [
      {
        id: 101,
        title: "v1",
        handle: "v1",
        created_at: "2020-01-01T00:00:00Z",
        updated_at: "2020-01-01T00:00:00Z",
        option1: "M",
        option2: "Blue",
        option3: "Cotton",
        sku: "SKU-M-BLUE-COTTON",
        requires_shipping: false,
        taxable: true,
        position: 1,
        product_id: 99,
        featured_image: {
          id: 10,
          title: "variant",
          handle: "variant",
          src: "https://example.com/variant.jpg",
          width: 0,
          height: 0,
          aspect_ratio: 1,
          position: 1,
          product_id: 99,
          variant_ids: [101],
          created_at: "2020-01-01T00:00:00Z",
          updated_at: "2020-01-01T00:00:00Z",
          alt: null,
        },
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
      },
    ];

    const product: ShopifySingleProduct = {
      id: 99,
      title: "Single Product",
      handle: "single-product",
      created_at: "2020-01-01T00:00:00Z",
      updated_at: "2020-01-01T00:00:00Z",
      vendor: "Vendor",
      tags: [],
      options: [
        { name: "Size", position: 1, values: ["M"] },
        { name: "Color", position: 2, values: ["Blue"] },
        { name: "Material", position: 3, values: ["Cotton"] },
      ],
      description: "desc",
      published_at: "2020-01-01T00:00:00Z",
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
      variants,
      images: [],
      featured_image: null,
      url: undefined,
      media: undefined,
      requires_selling_plan: undefined,
      selling_plan_groups: undefined,
    };

    const mapped = shop.productDto(product);
    expect(mapped.variantOptionsMap).toEqual({
      "color__blue____material__cotton____size__m": "101",
    });
    expect(mapped.variantPriceMap).toEqual({
      "color__blue____material__cotton____size__m": 10000,
    });
    expect(mapped.variantSkuMap).toEqual({
      "color__blue____material__cotton____size__m": "SKU-M-BLUE-COTTON",
    });
    expect(mapped.variantAvailabilityMap).toEqual({
      "color__blue____material__cotton____size__m": true,
    });
    expect(mapped.variantImages).toEqual({
      "101": ["https://example.com/variant.jpg"],
    });
  });
});
