import * as z from "zod/mini";
import type * as Types from "./types";

type Assert<T extends true> = T;
type IsEqual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

export const openRouterConfigSchema = z.object({
  apiKey: z.optional(z.string()),
  model: z.optional(z.string()),
  fallbackModels: z.optional(z.array(z.string())),
  baseUrl: z.optional(z.string()),
  siteUrl: z.optional(z.string()),
  appTitle: z.optional(z.string()),
  offline: z.optional(z.boolean()),
});
export type OpenRouterConfig = z.infer<typeof openRouterConfigSchema>;
type _OpenRouterConfigMatches = Assert<
  IsEqual<OpenRouterConfig, Types.OpenRouterConfig>
>;

export const systemUserPromptSchema = z.object({
  system: z.string(),
  user: z.string(),
});
export type SystemUserPrompt = z.infer<typeof systemUserPromptSchema>;
type _SystemUserPromptMatches = Assert<
  IsEqual<SystemUserPrompt, Types.SystemUserPrompt>
>;

export const audienceSchema = z.enum([
  "adult_male",
  "adult_female",
  "kid_male",
  "kid_female",
  "adult_unisex",
  "kid_unisex",
]);
export type Audience = z.infer<typeof audienceSchema>;
type _AudienceMatches = Assert<IsEqual<Audience, Types.Audience>>;

export const categorySchema = z.object({
  clothing: z.optional(z.array(z.string())),
  jewellery: z.optional(z.array(z.string())),
  accessories: z.optional(z.array(z.string())),
});
export type Category = z.infer<typeof categorySchema>;
type _CategoryMatches = Assert<IsEqual<Category, Types.Category>>;

const categoryAtLeastOneSchema = z.union([
  z.object({
    clothing: z.array(z.string()),
    jewellery: z.optional(z.array(z.string())),
    accessories: z.optional(z.array(z.string())),
  }),
  z.object({
    clothing: z.optional(z.array(z.string())),
    jewellery: z.array(z.string()),
    accessories: z.optional(z.array(z.string())),
  }),
  z.object({
    clothing: z.optional(z.array(z.string())),
    jewellery: z.optional(z.array(z.string())),
    accessories: z.array(z.string()),
  }),
]);
type CategoryAtLeastOne = z.infer<typeof categoryAtLeastOneSchema>;

export const noneCategorySchema = z.object({
  home_decor: z.array(z.string()),
  accessories: z.array(z.string()),
});
export type NoneCategory = z.infer<typeof noneCategorySchema>;
type _NoneCategoryMatches = Assert<IsEqual<NoneCategory, Types.NoneCategory>>;

const noneCategoryAtLeastOneSchema = z.union([
  z.object({
    home_decor: z.array(z.string()),
    accessories: z.optional(z.array(z.string())),
  }),
  z.object({
    home_decor: z.optional(z.array(z.string())),
    accessories: z.array(z.string()),
  }),
]);

export const storeCatalogSchema = z.union([
  z.object({
    adult_male: categoryAtLeastOneSchema,
    adult_female: z.optional(categoryAtLeastOneSchema),
    kid_male: z.optional(categoryAtLeastOneSchema),
    kid_female: z.optional(categoryAtLeastOneSchema),
    adult_unisex: z.optional(categoryAtLeastOneSchema),
    kid_unisex: z.optional(categoryAtLeastOneSchema),
    none: noneCategoryAtLeastOneSchema,
  }),
  z.object({
    adult_male: z.optional(categoryAtLeastOneSchema),
    adult_female: categoryAtLeastOneSchema,
    kid_male: z.optional(categoryAtLeastOneSchema),
    kid_female: z.optional(categoryAtLeastOneSchema),
    adult_unisex: z.optional(categoryAtLeastOneSchema),
    kid_unisex: z.optional(categoryAtLeastOneSchema),
    none: noneCategoryAtLeastOneSchema,
  }),
  z.object({
    adult_male: z.optional(categoryAtLeastOneSchema),
    adult_female: z.optional(categoryAtLeastOneSchema),
    kid_male: categoryAtLeastOneSchema,
    kid_female: z.optional(categoryAtLeastOneSchema),
    adult_unisex: z.optional(categoryAtLeastOneSchema),
    kid_unisex: z.optional(categoryAtLeastOneSchema),
    none: noneCategoryAtLeastOneSchema,
  }),
  z.object({
    adult_male: z.optional(categoryAtLeastOneSchema),
    adult_female: z.optional(categoryAtLeastOneSchema),
    kid_male: z.optional(categoryAtLeastOneSchema),
    kid_female: categoryAtLeastOneSchema,
    adult_unisex: z.optional(categoryAtLeastOneSchema),
    kid_unisex: z.optional(categoryAtLeastOneSchema),
    none: noneCategoryAtLeastOneSchema,
  }),
  z.object({
    adult_male: z.optional(categoryAtLeastOneSchema),
    adult_female: z.optional(categoryAtLeastOneSchema),
    kid_male: z.optional(categoryAtLeastOneSchema),
    kid_female: z.optional(categoryAtLeastOneSchema),
    adult_unisex: categoryAtLeastOneSchema,
    kid_unisex: z.optional(categoryAtLeastOneSchema),
    none: noneCategoryAtLeastOneSchema,
  }),
  z.object({
    adult_male: z.optional(categoryAtLeastOneSchema),
    adult_female: z.optional(categoryAtLeastOneSchema),
    kid_male: z.optional(categoryAtLeastOneSchema),
    kid_female: z.optional(categoryAtLeastOneSchema),
    adult_unisex: z.optional(categoryAtLeastOneSchema),
    kid_unisex: categoryAtLeastOneSchema,
    none: noneCategoryAtLeastOneSchema,
  }),
]);
export type StoreCatalog = z.infer<typeof storeCatalogSchema>;
type _StoreCatalogMatches = Assert<IsEqual<StoreCatalog, Types.StoreCatalog>>;

export const shopifyTimestampsSchema = z.object({
  created_at: z.string(),
  updated_at: z.string(),
});
export type ShopifyTimestamps = z.infer<typeof shopifyTimestampsSchema>;
type _ShopifyTimestampsMatches = Assert<
  IsEqual<ShopifyTimestamps, Types.ShopifyTimestamps>
>;

export const shopifyBasicInfoSchema = z.object({
  id: z.number(),
  title: z.string(),
  handle: z.string(),
});
export type ShopifyBasicInfo = z.infer<typeof shopifyBasicInfoSchema>;
type _ShopifyBasicInfoMatches = Assert<
  IsEqual<ShopifyBasicInfo, Types.ShopifyBasicInfo>
>;

export const shopifyImageDimensionsSchema = z.object({
  width: z.number(),
  height: z.number(),
  aspect_ratio: z.optional(z.number()),
});
export type ShopifyImageDimensions = z.infer<
  typeof shopifyImageDimensionsSchema
>;
type _ShopifyImageDimensionsMatches = Assert<
  IsEqual<ShopifyImageDimensions, Types.ShopifyImageDimensions>
>;

export const shopifyImageSchema = z.object({
  id: z.number(),
  title: z.string(),
  handle: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  width: z.number(),
  height: z.number(),
  aspect_ratio: z.optional(z.number()),
  src: z.string(),
  position: z.number(),
  product_id: z.number(),
  variant_ids: z.array(z.string()),
});
export type ShopifyImage = z.infer<typeof shopifyImageSchema>;
type _ShopifyImageMatches = Assert<IsEqual<ShopifyImage, Types.ShopifyImage>>;

export const shopifyVariantImageSchema = z.object({
  id: z.number(),
  title: z.string(),
  handle: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  width: z.number(),
  height: z.number(),
  aspect_ratio: z.optional(z.number()),
  src: z.string(),
  position: z.number(),
  product_id: z.number(),
  variant_ids: z.array(z.number()),
  alt: z.nullable(z.string()),
});
export type ShopifyVariantImage = z.infer<typeof shopifyVariantImageSchema>;
type _ShopifyVariantImageMatches = Assert<
  IsEqual<ShopifyVariantImage, Types.ShopifyVariantImage>
>;

export const shopifyFeaturedMediaSchema = z.object({
  alt: z.nullable(z.string()),
  id: z.number(),
  position: z.number(),
  preview_image: z.object({
    aspect_ratio: z.number(),
    height: z.number(),
    width: z.number(),
    src: z.string(),
  }),
});
export type ShopifyFeaturedMedia = z.infer<typeof shopifyFeaturedMediaSchema>;
type _ShopifyFeaturedMediaMatches = Assert<
  IsEqual<ShopifyFeaturedMedia, Types.ShopifyFeaturedMedia>
>;

export const shopifyMediaSchema = z.object({
  alt: z.nullable(z.string()),
  id: z.number(),
  position: z.number(),
  preview_image: z.object({
    aspect_ratio: z.number(),
    height: z.number(),
    width: z.number(),
    src: z.string(),
  }),
  width: z.number(),
  height: z.number(),
  aspect_ratio: z.optional(z.number()),
  media_type: z.enum(["image", "video"]),
  src: z.string(),
});
export type ShopifyMedia = z.infer<typeof shopifyMediaSchema>;
type _ShopifyMediaMatches = Assert<IsEqual<ShopifyMedia, Types.ShopifyMedia>>;

export const shopifyOptionSchema = z.object({
  name: z.string(),
  position: z.number(),
  values: z.array(z.string()),
});
export type ShopifyOption = z.infer<typeof shopifyOptionSchema>;
type _ShopifyOptionMatches = Assert<
  IsEqual<ShopifyOption, Types.ShopifyOption>
>;

export const shopifyBaseVariantSchema = z.object({
  id: z.number(),
  title: z.string(),
  handle: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  option1: z.nullable(z.string()),
  option2: z.nullable(z.string()),
  option3: z.nullable(z.string()),
  sku: z.nullable(z.string()),
  requires_shipping: z.boolean(),
  taxable: z.boolean(),
  position: z.number(),
  product_id: z.number(),
});
export type ShopifyBaseVariant = z.infer<typeof shopifyBaseVariantSchema>;
type _ShopifyBaseVariantMatches = Assert<
  IsEqual<ShopifyBaseVariant, Types.ShopifyBaseVariant>
>;

export const shopifyProductVariantSchema = z.object({
  id: z.number(),
  title: z.string(),
  handle: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  option1: z.nullable(z.string()),
  option2: z.nullable(z.string()),
  option3: z.nullable(z.string()),
  sku: z.nullable(z.string()),
  requires_shipping: z.boolean(),
  taxable: z.boolean(),
  position: z.number(),
  product_id: z.number(),
  name: z.optional(z.string()),
  options: z.optional(z.array(z.string())),
  featured_image: z.nullable(
    z.object({
      id: z.number(),
      src: z.string(),
      width: z.number(),
      height: z.number(),
      position: z.number(),
      product_id: z.number(),
      aspect_ratio: z.number(),
      variant_ids: z.array(z.unknown()),
      created_at: z.string(),
      updated_at: z.string(),
      alt: z.nullable(z.string()),
    })
  ),
  available: z.boolean(),
  price: z.union([z.string(), z.number()]),
  grams: z.optional(z.number()),
  weightInGrams: z.optional(z.number()),
  compare_at_price: z.optional(z.union([z.string(), z.number()])),
});
export type ShopifyProductVariant = z.infer<typeof shopifyProductVariantSchema>;
type _ShopifyProductVariantMatches = Assert<
  IsEqual<ShopifyProductVariant, Types.ShopifyProductVariant>
>;

export const shopifySingleProductVariantSchema = z.object({
  id: z.number(),
  title: z.string(),
  handle: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  option1: z.nullable(z.string()),
  option2: z.nullable(z.string()),
  option3: z.nullable(z.string()),
  sku: z.nullable(z.string()),
  requires_shipping: z.boolean(),
  taxable: z.boolean(),
  position: z.number(),
  product_id: z.number(),
  featured_image: z.nullable(shopifyVariantImageSchema),
  featured_media: z.nullable(shopifyFeaturedMediaSchema),
  available: z.optional(z.boolean()),
  price: z.string(),
  compare_at_price: z.nullable(z.string()),
  inventory_quantity: z.optional(z.number()),
  inventory_management: z.nullable(z.string()),
  inventory_policy: z.optional(z.string()),
  fulfillment_service: z.optional(z.string()),
  barcode: z.optional(z.nullable(z.string())),
  grams: z.optional(z.number()),
  weight: z.optional(z.number()),
  weight_unit: z.optional(z.string()),
  requires_selling_plan: z.optional(z.boolean()),
  selling_plan_allocations: z.optional(z.array(z.unknown())),
});
export type ShopifySingleProductVariant = z.infer<
  typeof shopifySingleProductVariantSchema
>;
type _ShopifySingleProductVariantMatches = Assert<
  IsEqual<ShopifySingleProductVariant, Types.ShopifySingleProductVariant>
>;

export const shopifyBaseProductSchema = z.object({
  id: z.number(),
  title: z.string(),
  handle: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  vendor: z.string(),
  tags: z.array(z.string()),
  options: z.array(shopifyOptionSchema),
});
export type ShopifyBaseProduct = z.infer<typeof shopifyBaseProductSchema>;
type _ShopifyBaseProductMatches = Assert<
  IsEqual<ShopifyBaseProduct, Types.ShopifyBaseProduct>
>;

export const shopifyProductSchema = z.object({
  id: z.number(),
  title: z.string(),
  handle: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  vendor: z.string(),
  tags: z.array(z.string()),
  options: z.array(shopifyOptionSchema),
  body_html: z.string(),
  body: z.optional(z.string()),
  published_at: z.string(),
  product_type: z.string(),
  variants: z.array(shopifyProductVariantSchema),
  images: z.array(shopifyImageSchema),
});
export type ShopifyProduct = z.infer<typeof shopifyProductSchema>;
type _ShopifyProductMatches = Assert<
  IsEqual<ShopifyProduct, Types.ShopifyProduct>
>;

export const shopifyProductAndStoreSchema = shopifyProductSchema;
export type ShopifyProductAndStore = z.infer<
  typeof shopifyProductAndStoreSchema
>;
type _ShopifyProductAndStoreMatches = Assert<
  IsEqual<ShopifyProductAndStore, Types.ShopifyProductAndStore>
>;

export const shopifySingleProductSchema = z.object({
  id: z.number(),
  title: z.string(),
  handle: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  vendor: z.string(),
  tags: z.array(z.string()),
  options: z.array(shopifyOptionSchema),
  description: z.string(),
  published_at: z.string(),
  type: z.string(),
  price: z.number(),
  price_min: z.number(),
  price_max: z.number(),
  available: z.boolean(),
  price_varies: z.boolean(),
  compare_at_price: z.nullable(z.number()),
  compare_at_price_min: z.number(),
  compare_at_price_max: z.number(),
  compare_at_price_varies: z.boolean(),
  variants: z.array(shopifySingleProductVariantSchema),
  images: z.array(z.string()),
  featured_image: z.nullable(z.string()),
  url: z.optional(z.string()),
  media: z.optional(z.array(shopifyMediaSchema)),
  requires_selling_plan: z.optional(z.boolean()),
  selling_plan_groups: z.optional(z.array(z.string())),
});
export type ShopifySingleProduct = z.infer<typeof shopifySingleProductSchema>;
type _ShopifySingleProductMatches = Assert<
  IsEqual<ShopifySingleProduct, Types.ShopifySingleProduct>
>;

export const shopifyPredictiveProductSearchSchema = z.object({
  resources: z.object({
    results: z.object({
      products: z.array(
        z.object({
          id: z.number(),
          title: z.string(),
          handle: z.string(),
          created_at: z.string(),
          updated_at: z.string(),
          vendor: z.string(),
          tags: z.array(z.string()),
          options: z.array(shopifyOptionSchema),
          published_at: z.string(),
          type: z.string(),
          price: z.number(),
          price_min: z.number(),
          price_max: z.number(),
          available: z.boolean(),
          price_varies: z.boolean(),
          compare_at_price: z.nullable(z.number()),
          compare_at_price_min: z.number(),
          compare_at_price_max: z.number(),
          compare_at_price_varies: z.boolean(),
          variants: z.array(shopifySingleProductVariantSchema),
          images: z.array(z.string()),
          featured_image: z.nullable(z.string()),
          url: z.optional(z.string()),
          media: z.optional(z.array(shopifyMediaSchema)),
          requires_selling_plan: z.optional(z.boolean()),
          selling_plan_groups: z.optional(z.array(z.string())),
          body: z.string(),
        })
      ),
    }),
  }),
});
export type ShopifyPredictiveProductSearch = z.infer<
  typeof shopifyPredictiveProductSearchSchema
>;
type _ShopifyPredictiveProductSearchMatches = Assert<
  IsEqual<ShopifyPredictiveProductSearch, Types.ShopifyPredictiveProductSearch>
>;

export const productPricingSchema = z.object({
  price: z.number(),
  priceMin: z.number(),
  priceMax: z.number(),
  priceVaries: z.boolean(),
  compareAtPrice: z.number(),
  compareAtPriceMin: z.number(),
  compareAtPriceMax: z.number(),
  compareAtPriceVaries: z.boolean(),
  discount: z.number(),
  currency: z.optional(z.string()),
});
export type ProductPricing = z.infer<typeof productPricingSchema>;
type _ProductPricingMatches = Assert<
  IsEqual<ProductPricing, Types.ProductPricing>
>;

export const localizedPricingSchema = z.object({
  currency: z.string(),
  priceFormatted: z.string(),
  priceMinFormatted: z.string(),
  priceMaxFormatted: z.string(),
  compareAtPriceFormatted: z.string(),
});
export type LocalizedPricing = z.infer<typeof localizedPricingSchema>;
type _LocalizedPricingMatches = Assert<
  IsEqual<LocalizedPricing, Types.LocalizedPricing>
>;

export const currencyCodeSchema = z.string();
export type CurrencyCode = z.infer<typeof currencyCodeSchema>;
type _CurrencyCodeMatches = Assert<IsEqual<CurrencyCode, Types.CurrencyCode>>;

export const productOptionSchema = z.object({
  key: z.string(),
  data: z.array(z.string()),
  name: z.string(),
  position: z.number(),
  values: z.array(z.string()),
});
export type ProductOption = z.infer<typeof productOptionSchema>;
type _ProductOptionMatches = Assert<
  IsEqual<ProductOption, Types.ProductOption>
>;

export const productVariantImageSchema = z.object({
  width: z.number(),
  height: z.number(),
  aspect_ratio: z.optional(z.number()),
  id: z.number(),
  src: z.string(),
  position: z.number(),
  productId: z.number(),
  aspectRatio: z.number(),
  variantIds: z.array(z.unknown()),
  createdAt: z.string(),
  updatedAt: z.string(),
  alt: z.nullable(z.string()),
});
export type ProductVariantImage = z.infer<typeof productVariantImageSchema>;
type _ProductVariantImageMatches = Assert<
  IsEqual<ProductVariantImage, Types.ProductVariantImage>
>;

export const productVariantSchema = z.object({
  id: z.string(),
  platformId: z.string(),
  name: z.optional(z.string()),
  title: z.string(),
  option1: z.nullable(z.string()),
  option2: z.nullable(z.string()),
  option3: z.nullable(z.string()),
  options: z.optional(z.array(z.string())),
  sku: z.nullable(z.string()),
  requiresShipping: z.boolean(),
  taxable: z.boolean(),
  featuredImage: z.nullable(productVariantImageSchema),
  available: z.boolean(),
  price: z.number(),
  weightInGrams: z.optional(z.number()),
  compareAtPrice: z.number(),
  position: z.number(),
  productId: z.number(),
  createdAt: z.optional(z.string()),
  updatedAt: z.optional(z.string()),
});
export type ProductVariant = z.infer<typeof productVariantSchema>;
type _ProductVariantMatches = Assert<
  IsEqual<ProductVariant, Types.ProductVariant>
>;

export const productImageSchema = z.object({
  width: z.number(),
  height: z.number(),
  aspect_ratio: z.optional(z.number()),
  id: z.number(),
  productId: z.number(),
  alt: z.nullable(z.string()),
  position: z.number(),
  src: z.string(),
  mediaType: z.enum(["image", "video"]),
  variantIds: z.array(z.unknown()),
  createdAt: z.optional(z.string()),
  updatedAt: z.optional(z.string()),
});
export type ProductImage = z.infer<typeof productImageSchema>;
type _ProductImageMatches = Assert<IsEqual<ProductImage, Types.ProductImage>>;

export const metaTagSchema = z.union([
  z.object({ name: z.string(), content: z.string() }),
  z.object({ property: z.string(), content: z.string() }),
  z.object({ itemprop: z.string(), content: z.string() }),
]);
export type MetaTag = z.infer<typeof metaTagSchema>;
type _MetaTagMatches = Assert<IsEqual<MetaTag, Types.MetaTag>>;

export const productSchema = z.object({
  slug: z.string(),
  handle: z.string(),
  platformId: z.string(),
  title: z.string(),
  available: z.boolean(),
  price: z.number(),
  priceMin: z.number(),
  priceVaries: z.boolean(),
  compareAtPrice: z.number(),
  compareAtPriceMin: z.number(),
  priceMax: z.number(),
  compareAtPriceMax: z.number(),
  compareAtPriceVaries: z.boolean(),
  discount: z.number(),
  currency: z.optional(z.string()),
  localizedPricing: z.optional(localizedPricingSchema),
  options: z.array(productOptionSchema),
  bodyHtml: z.nullable(z.string()),
  active: z.optional(z.boolean()),
  productType: z.nullable(z.string()),
  tags: z.array(z.string()),
  vendor: z.string(),
  featuredImage: z.optional(z.nullable(z.string())),
  isProxyFeaturedImage: z.nullable(z.boolean()),
  createdAt: z.optional(z.date()),
  updatedAt: z.optional(z.date()),
  variants: z.nullable(z.array(productVariantSchema)),
  images: z.array(productImageSchema),
  variantImages: z.record(z.string(), z.array(z.string())),
  publishedAt: z.nullable(z.date()),
  seo: z.optional(z.nullable(z.array(metaTagSchema))),
  metaTags: z.optional(z.nullable(z.array(metaTagSchema))),
  displayScore: z.optional(z.number()),
  deletedAt: z.optional(z.nullable(z.date())),
  storeSlug: z.string(),
  storeDomain: z.string(),
  embedding: z.optional(z.nullable(z.array(z.number()))),
  url: z.string(),
  requiresSellingPlan: z.optional(z.nullable(z.boolean())),
  sellingPlanGroups: z.optional(z.unknown()),
  variantOptionsMap: z.record(z.string(), z.string()),
  variantPriceMap: z.record(z.string(), z.number()),
  variantSkuMap: z.record(z.string(), z.nullable(z.string())),
  variantAvailabilityMap: z.record(z.string(), z.boolean()),
  enriched_content: z.optional(z.string()),
});
export type Product = z.infer<typeof productSchema>;
type _ProductMatches = Assert<IsEqual<Product, Types.Product>>;

export const minimalProductSchema = z.object({
  title: z.string(),
  bodyHtml: z.nullable(z.string()),
  price: z.number(),
  compareAtPrice: z.number(),
  discount: z.number(),
  images: z.array(z.object({ src: z.string() })),
  featuredImage: z.nullable(z.string()),
  variantImages: z.record(z.string(), z.array(z.string())),
  available: z.boolean(),
  productType: z.nullable(z.string()),
  localizedPricing: z.object({
    priceFormatted: z.string(),
    compareAtPriceFormatted: z.string(),
  }),
  options: z.array(
    z.object({
      key: z.string(),
      name: z.string(),
      values: z.array(z.string()),
    })
  ),
  variantOptionsMap: z.record(z.string(), z.string()),
  variantPriceMap: z.record(z.string(), z.number()),
  variantSkuMap: z.record(z.string(), z.nullable(z.string())),
  variantAvailabilityMap: z.record(z.string(), z.boolean()),
  url: z.string(),
  slug: z.string(),
  platformId: z.string(),
});
export type MinimalProduct = z.infer<typeof minimalProductSchema>;
type _MinimalProductMatches = Assert<
  IsEqual<MinimalProduct, Types.MinimalProduct>
>;

export const productColumnsModeSchema = z.enum(["minimal", "full"]);
export type ProductColumnsMode = z.infer<typeof productColumnsModeSchema>;
type _ProductColumnsModeMatches = Assert<
  IsEqual<ProductColumnsMode, Types.ProductColumnsMode>
>;

export const productImagesModeSchema = z.enum(["minimal", "full"]);
export type ProductImagesMode = z.infer<typeof productImagesModeSchema>;
type _ProductImagesModeMatches = Assert<
  IsEqual<ProductImagesMode, Types.ProductImagesMode>
>;

export const productOptionsModeSchema = z.enum(["minimal", "full"]);
export type ProductOptionsMode = z.infer<typeof productOptionsModeSchema>;
type _ProductOptionsModeMatches = Assert<
  IsEqual<ProductOptionsMode, Types.ProductOptionsMode>
>;

export const productColumnsConfigSchema = z.object({
  mode: z.optional(productColumnsModeSchema),
  images: z.optional(productImagesModeSchema),
  options: z.optional(productOptionsModeSchema),
});
export type ProductColumnsConfig = z.infer<typeof productColumnsConfigSchema>;
type _ProductColumnsConfigMatches = Assert<
  IsEqual<ProductColumnsConfig, Types.ProductColumnsConfig>
>;

export const shopifyApiProductSchema = z.object({
  id: z.number(),
  title: z.string(),
  handle: z.string(),
  bodyHtml: z.string(),
  body: z.optional(z.string()),
  publishedAt: z.string(),
  createdAt: z.optional(z.string()),
  updatedAt: z.optional(z.string()),
  vendor: z.string(),
  productType: z.string(),
  tags: z.array(z.string()),
  variants: z.array(
    z.object({
      title: z.string(),
      handle: z.string(),
      created_at: z.string(),
      updated_at: z.string(),
      option1: z.nullable(z.string()),
      option2: z.nullable(z.string()),
      option3: z.nullable(z.string()),
      sku: z.nullable(z.string()),
      requires_shipping: z.boolean(),
      taxable: z.boolean(),
      position: z.number(),
      product_id: z.number(),
      id: z.number(),
      name: z.optional(z.string()),
      featuredImage: z.nullable(productVariantImageSchema),
      available: z.boolean(),
      price: z.number(),
      weightInGrams: z.optional(z.number()),
      compareAtPrice: z.number(),
      productId: z.number(),
      createdAt: z.optional(z.string()),
      updatedAt: z.optional(z.string()),
    })
  ),
  images: z.array(productImageSchema),
  options: z.array(shopifyOptionSchema),
});
export type ShopifyApiProduct = z.infer<typeof shopifyApiProductSchema>;
type _ShopifyApiProductMatches = Assert<
  IsEqual<ShopifyApiProduct, Types.ShopifyApiProduct>
>;

export const catalogCategorySchema = z.object({
  clothing: z.optional(z.array(z.string())),
  jewellery: z.optional(z.array(z.string())),
  accessories: z.optional(z.array(z.string())),
});
export type CatalogCategory = z.infer<typeof catalogCategorySchema>;
type _CatalogCategoryMatches = Assert<
  IsEqual<CatalogCategory, Types.CatalogCategory>
>;

export const demographicsSchema = z.enum([
  "adult_male",
  "adult_female",
  "adult_unisex",
  "kid_male",
  "kid_female",
  "kid_unisex",
]);
export type Demographics = z.infer<typeof demographicsSchema>;
type _DemographicsMatches = Assert<IsEqual<Demographics, Types.Demographics>>;

export const validStoreCatalogSchema = z.object({
  adult_male: z.optional(catalogCategorySchema),
  adult_female: z.optional(catalogCategorySchema),
  adult_unisex: z.optional(catalogCategorySchema),
  kid_male: z.optional(catalogCategorySchema),
  kid_female: z.optional(catalogCategorySchema),
  kid_unisex: z.optional(catalogCategorySchema),
});
export type ValidStoreCatalog = z.infer<typeof validStoreCatalogSchema>;
type _ValidStoreCatalogMatches = Assert<
  IsEqual<ValidStoreCatalog, Types.ValidStoreCatalog>
>;

export const addressSchema = z.object({
  addressLine1: z.string(),
  addressLine2: z.optional(z.string()),
  city: z.string(),
  state: z.string(),
  code: z.string(),
  country: z.string(),
  label: z.optional(z.string()),
});
export type Address = z.infer<typeof addressSchema>;
type _AddressMatches = Assert<IsEqual<Address, Types.Address>>;

export const contactUrlsSchema = z.object({
  whatsapp: z.optional(z.string()),
  tel: z.optional(z.string()),
  email: z.optional(z.string()),
});
export type ContactUrls = z.infer<typeof contactUrlsSchema>;
type _ContactUrlsMatches = Assert<IsEqual<ContactUrls, Types.ContactUrls>>;

export const couponSchema = z.object({
  label: z.string(),
  description: z.optional(z.string()),
});
export type Coupon = z.infer<typeof couponSchema>;
type _CouponMatches = Assert<IsEqual<Coupon, Types.Coupon>>;

export const shopifyCollectionSchema = z.object({
  id: z.number(),
  title: z.string(),
  handle: z.string(),
  description: z.optional(z.string()),
  published_at: z.string(),
  updated_at: z.string(),
  image: z.optional(
    z.object({
      id: z.number(),
      created_at: z.string(),
      src: z.string(),
      alt: z.optional(z.string()),
    })
  ),
  products_count: z.number(),
});
export type ShopifyCollection = z.infer<typeof shopifyCollectionSchema>;
type _ShopifyCollectionMatches = Assert<
  IsEqual<ShopifyCollection, Types.ShopifyCollection>
>;

export const countryDetectionResultSchema = z.object({
  country: z.string(),
  confidence: z.number(),
  signals: z.array(z.string()),
  currencyCode: z.optional(z.string()),
});
export type CountryDetectionResult = z.infer<
  typeof countryDetectionResultSchema
>;
type _CountryDetectionResultMatches = Assert<
  IsEqual<CountryDetectionResult, Types.CountryDetectionResult>
>;

export const countryScoreSchema = z.object({
  score: z.number(),
  reasons: z.array(z.string()),
});
export type CountryScore = z.infer<typeof countryScoreSchema>;
type _CountryScoreMatches = Assert<IsEqual<CountryScore, Types.CountryScore>>;

export const countryScoresSchema = z.record(z.string(), countryScoreSchema);
export type CountryScores = z.infer<typeof countryScoresSchema>;
type _CountryScoresMatches = Assert<
  IsEqual<CountryScores, Types.CountryScores>
>;

export const shopifyFeaturesDataSchema = z.catchall(
  z.looseObject({
    country: z.optional(z.string()),
    locale: z.optional(z.string()),
    moneyFormat: z.optional(z.string()),
  }),
  z.unknown()
);
export type ShopifyFeaturesData = z.infer<typeof shopifyFeaturesDataSchema>;
type _ShopifyFeaturesDataMatches = Assert<
  IsEqual<ShopifyFeaturesData, Types.ShopifyFeaturesData>
>;

export const jsonLdEntrySchema = z.record(z.string(), z.unknown());
export type JsonLdEntry = z.infer<typeof jsonLdEntrySchema>;
type _JsonLdEntryMatches = Assert<IsEqual<JsonLdEntry, Types.JsonLdEntry>>;

export const collectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  handle: z.string(),
  description: z.optional(z.string()),
  image: z.optional(
    z.object({
      id: z.number(),
      createdAt: z.string(),
      src: z.string(),
      alt: z.optional(z.string()),
    })
  ),
  productsCount: z.number(),
  publishedAt: z.string(),
  updatedAt: z.string(),
});
export type Collection = z.infer<typeof collectionSchema>;
type _CollectionMatches = Assert<IsEqual<Collection, Types.Collection>>;

export const productClassificationSchema = z.object({
  audience: z.enum([
    "adult_male",
    "adult_female",
    "kid_male",
    "kid_female",
    "generic",
  ]),
  vertical: z.enum([
    "clothing",
    "beauty",
    "accessories",
    "home-decor",
    "food-and-beverages",
  ]),
  category: z.optional(z.nullable(z.string())),
  subCategory: z.optional(z.nullable(z.string())),
});
export type ProductClassification = z.infer<typeof productClassificationSchema>;
type _ProductClassificationMatches = Assert<
  IsEqual<ProductClassification, Types.ProductClassification>
>;

export const seoContentSchema = z.object({
  metaTitle: z.string(),
  metaDescription: z.string(),
  shortDescription: z.string(),
  longDescription: z.string(),
  tags: z.array(z.string()),
  marketingCopy: z.string(),
});
export type SEOContent = z.infer<typeof seoContentSchema>;
type _SEOContentMatches = Assert<IsEqual<SEOContent, Types.SEOContent>>;

export const enhancedProductImageSchema = z.object({
  textContext: z.string(),
  url: z.string(),
  alt: z.string(),
});
export type EnhancedProductImage = z.infer<typeof enhancedProductImageSchema>;
type _EnhancedProductImageMatches = Assert<
  IsEqual<EnhancedProductImage, Types.EnhancedProductImage>
>;

export const enhancedProductCanonicalSchema = z.object({
  title: z.string(),
  summary: z.string(),
  highlights: z.array(z.string()),
  materials: z.unknown(),
  fit_and_size: z.unknown(),
  care: z.unknown(),
  what_makes_it_special: z.unknown(),
  missing_info: z.array(z.unknown()),
  images: z.array(enhancedProductImageSchema),
});
export type EnhancedProductCanonical = z.infer<
  typeof enhancedProductCanonicalSchema
>;
type _EnhancedProductCanonicalMatches = Assert<
  IsEqual<EnhancedProductCanonical, Types.EnhancedProductCanonical>
>;

export const enhancedProductSeoMetaSchema = z.object({
  charset: z.string(),
  "x-ua-compatible": z.string(),
  viewport: z.string(),
  description: z.string(),
  "og:site_name": z.string(),
  "og:url": z.string(),
  "og:title": z.string(),
  "og:type": z.string(),
  "og:description": z.string(),
  "og:image": z.string(),
  "og:image:secure_url": z.string(),
  "og:image:width": z.string(),
  "og:image:height": z.string(),
  "og:price:amount": z.string(),
  "og:price:currency": z.string(),
  "twitter:card": z.string(),
  "twitter:title": z.string(),
  "twitter:description": z.string(),
  "shopify-digital-wallet": z.string(),
});
export type EnhancedProductSeoMeta = z.infer<
  typeof enhancedProductSeoMetaSchema
>;
type _EnhancedProductSeoMetaMatches = Assert<
  IsEqual<EnhancedProductSeoMeta, Types.EnhancedProductSeoMeta>
>;

export const enhancedProductSeoOpenGraphSchema = z.object({
  "og:site_name": z.string(),
  "og:url": z.string(),
  "og:title": z.string(),
  "og:type": z.string(),
  "og:description": z.string(),
  "og:image": z.string(),
  "og:image:secure_url": z.string(),
  "og:image:width": z.string(),
  "og:image:height": z.string(),
  "og:price:amount": z.string(),
  "og:price:currency": z.string(),
});
export type EnhancedProductSeoOpenGraph = z.infer<
  typeof enhancedProductSeoOpenGraphSchema
>;
type _EnhancedProductSeoOpenGraphMatches = Assert<
  IsEqual<EnhancedProductSeoOpenGraph, Types.EnhancedProductSeoOpenGraph>
>;

export const enhancedProductSeoTwitterSchema = z.object({
  "twitter:card": z.string(),
  "twitter:title": z.string(),
  "twitter:description": z.string(),
});
export type EnhancedProductSeoTwitter = z.infer<
  typeof enhancedProductSeoTwitterSchema
>;
type _EnhancedProductSeoTwitterMatches = Assert<
  IsEqual<EnhancedProductSeoTwitter, Types.EnhancedProductSeoTwitter>
>;

export const enhancedProductSeoJsonLdBrandSchema = z.object({
  "@type": z.string(),
  name: z.string(),
});
export type EnhancedProductSeoJsonLdBrand = z.infer<
  typeof enhancedProductSeoJsonLdBrandSchema
>;
type _EnhancedProductSeoJsonLdBrandMatches = Assert<
  IsEqual<EnhancedProductSeoJsonLdBrand, Types.EnhancedProductSeoJsonLdBrand>
>;

export const enhancedProductSeoJsonLdOffersSchema = z.object({
  "@id": z.string(),
  "@type": z.string(),
  availability: z.string(),
  price: z.string(),
  priceCurrency: z.string(),
  url: z.string(),
});
export type EnhancedProductSeoJsonLdOffers = z.infer<
  typeof enhancedProductSeoJsonLdOffersSchema
>;
type _EnhancedProductSeoJsonLdOffersMatches = Assert<
  IsEqual<EnhancedProductSeoJsonLdOffers, Types.EnhancedProductSeoJsonLdOffers>
>;

export const enhancedProductSeoJsonLdHasVariantSchema = z.object({
  "@id": z.string(),
  "@type": z.string(),
  image: z.string(),
  name: z.string(),
  offers: enhancedProductSeoJsonLdOffersSchema,
});
export type EnhancedProductSeoJsonLdHasVariant = z.infer<
  typeof enhancedProductSeoJsonLdHasVariantSchema
>;
type _EnhancedProductSeoJsonLdHasVariantMatches = Assert<
  IsEqual<
    EnhancedProductSeoJsonLdHasVariant,
    Types.EnhancedProductSeoJsonLdHasVariant
  >
>;

export const enhancedProductSeoJsonLdSchema = z.object({
  "@context": z.string(),
  "@type": z.string(),
  name: z.string(),
  logo: z.optional(z.string()),
  sameAs: z.optional(z.array(z.string())),
  url: z.string(),
  "@id": z.optional(z.string()),
  brand: z.optional(enhancedProductSeoJsonLdBrandSchema),
  category: z.optional(z.string()),
  description: z.optional(z.string()),
  hasVariant: z.optional(z.array(enhancedProductSeoJsonLdHasVariantSchema)),
  productGroupID: z.optional(z.string()),
});
export type EnhancedProductSeoJsonLd = z.infer<
  typeof enhancedProductSeoJsonLdSchema
>;
type _EnhancedProductSeoJsonLdMatches = Assert<
  IsEqual<EnhancedProductSeoJsonLd, Types.EnhancedProductSeoJsonLd>
>;

export const enhancedProductSeoSchema = z.object({
  title: z.string(),
  description: z.string(),
  canonical: z.string(),
  meta: enhancedProductSeoMetaSchema,
  openGraph: enhancedProductSeoOpenGraphSchema,
  twitter: enhancedProductSeoTwitterSchema,
  jsonLd: z.array(enhancedProductSeoJsonLdSchema),
  jsonLdRaw: z.array(z.unknown()),
  productJsonLd: z.array(z.unknown()),
  missing: z.array(z.string()),
});
export type EnhancedProductSeo = z.infer<typeof enhancedProductSeoSchema>;
type _EnhancedProductSeoMatches = Assert<
  IsEqual<EnhancedProductSeo, Types.EnhancedProductSeo>
>;

export const enhancedProductEnrichmentSchema = z.object({
  canonical: enhancedProductCanonicalSchema,
  markdown: z.string(),
  seo: z.optional(enhancedProductSeoSchema),
});
export type EnhancedProductEnrichment = z.infer<
  typeof enhancedProductEnrichmentSchema
>;
type _EnhancedProductEnrichmentMatches = Assert<
  IsEqual<EnhancedProductEnrichment, Types.EnhancedProductEnrichment>
>;

export const enhancedProductResponseSchema = z.object({
  product: productSchema,
  enrichment: enhancedProductEnrichmentSchema,
  cache: z.string(),
});
export type EnhancedProductResponse = z.infer<
  typeof enhancedProductResponseSchema
>;
type _EnhancedProductResponseMatches = Assert<
  IsEqual<EnhancedProductResponse, Types.EnhancedProductResponse>
>;

export const enhancedProductWorkerResponseSchema = z.object({
  shopify: z.union([shopifyProductSchema, shopifySingleProductSchema]),
  enrichment: enhancedProductEnrichmentSchema,
  cache: z.string(),
});
export type EnhancedProductWorkerResponse = z.infer<
  typeof enhancedProductWorkerResponseSchema
>;
type _EnhancedProductWorkerResponseMatches = Assert<
  IsEqual<EnhancedProductWorkerResponse, Types.EnhancedProductWorkerResponse>
>;

export const storeTypeResultSchema = z.object({
  vertical: z.enum([
    "clothing",
    "beauty",
    "accessories",
    "home-decor",
    "food-and-beverages",
  ]),
  audience: z.enum([
    "adult_male",
    "adult_female",
    "kid_male",
    "kid_female",
    "generic",
  ]),
  reason: z.string(),
});
export type StoreTypeResult = z.infer<typeof storeTypeResultSchema>;
type _StoreTypeResultMatches = Assert<
  IsEqual<StoreTypeResult, Types.StoreTypeResult>
>;

const storeTypeBreakdownVerticalSchema = z.object({
  clothing: z.optional(z.array(z.string())),
  beauty: z.optional(z.array(z.string())),
  accessories: z.optional(z.array(z.string())),
  "home-decor": z.optional(z.array(z.string())),
  "food-and-beverages": z.optional(z.array(z.string())),
});

export const storeTypeBreakdownSchema = z.object({
  adult_male: z.optional(storeTypeBreakdownVerticalSchema),
  adult_female: z.optional(storeTypeBreakdownVerticalSchema),
  kid_male: z.optional(storeTypeBreakdownVerticalSchema),
  kid_female: z.optional(storeTypeBreakdownVerticalSchema),
  generic: z.optional(storeTypeBreakdownVerticalSchema),
});
export type StoreTypeBreakdown = z.infer<typeof storeTypeBreakdownSchema>;
type _StoreTypeBreakdownMatches = Assert<
  IsEqual<StoreTypeBreakdown, Types.StoreTypeBreakdown>
>;
