import type {
  MinimalProduct,
  Product,
  ProductColumnsConfig,
  ProductColumnsMode,
  ProductImagesMode,
  ProductOptionsMode,
  ProductResult,
  ShopifyProduct,
  ShopifyProductVariant,
  ShopifySingleProduct,
  ShopifySingleProductVariant,
} from "../types";
import {
  buildVariantOptionsMap,
  calculateDiscount,
  genProductSlug,
  normalizeKey,
  safeParseDate,
} from "../utils/func";

type Ctx = {
  storeDomain: string;
  storeSlug: string;
  currency: string;
  normalizeImageUrl: (url: string | null | undefined) => string;
  formatPrice: (amountInCents: number) => string;
};

function resolveColumnsConfig<
  C extends ProductColumnsMode,
  I extends ProductImagesMode,
  O extends ProductOptionsMode,
>(
  columns: ProductColumnsConfig<C, I, O> | undefined
): Required<ProductColumnsConfig<C, I, O>> {
  return {
    mode: (columns?.mode ?? "minimal") as C,
    images: (columns?.images ?? "minimal") as I,
    options: (columns?.options ?? "minimal") as O,
  };
}

function mapVariants(
  product: ShopifyProduct | ShopifySingleProduct
): NonNullable<Product["variants"]> {
  const toCents = (value: unknown): number => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const n = Number.parseFloat(value);
      return Number.isFinite(n) ? Math.round(n * 100) : 0;
    }
    return 0;
  };

  const variants = product.variants ?? [];
  return (
    variants as Array<ShopifyProductVariant | ShopifySingleProductVariant>
  ).map((variant) => {
    const featuredImage = variant.featured_image
      ? {
          id: variant.featured_image.id,
          src: variant.featured_image.src,
          width: variant.featured_image.width,
          height: variant.featured_image.height,
          position: variant.featured_image.position,
          productId: variant.featured_image.product_id,
          aspectRatio: variant.featured_image.aspect_ratio ?? 0,
          variantIds: variant.featured_image.variant_ids ?? [],
          createdAt: variant.featured_image.created_at,
          updatedAt: variant.featured_image.updated_at,
          alt: variant.featured_image.alt,
        }
      : null;

    return {
      id: variant.id.toString(),
      platformId: variant.id.toString(),
      name: "name" in variant ? variant.name : undefined,
      title: variant.title,
      option1: variant.option1 || null,
      option2: variant.option2 || null,
      option3: variant.option3 || null,
      options: [variant.option1, variant.option2, variant.option3].filter(
        (v): v is string => Boolean(v)
      ),
      sku: variant.sku || null,
      requiresShipping: variant.requires_shipping,
      taxable: variant.taxable,
      featuredImage,
      available:
        typeof variant.available === "boolean" ? variant.available : true,
      price: toCents(variant.price),
      weightInGrams:
        "weightInGrams" in variant
          ? variant.weightInGrams
          : (variant.grams ?? undefined),
      compareAtPrice: toCents(variant.compare_at_price),
      position: variant.position,
      productId: variant.product_id,
      createdAt: variant.created_at,
      updatedAt: variant.updated_at,
      compareAtPriceVaries: false,
      priceVaries: false,
    };
  });
}

function buildVariantImagesMap(
  product: ShopifyProduct | ShopifySingleProduct,
  ctx: Ctx
): Record<string, string[]> {
  const map = new Map<string, Set<string>>();

  const add = (variantId: unknown, src: unknown) => {
    if (variantId == null) return;
    if (typeof src !== "string" || !src.trim()) return;
    const key = String(variantId);
    const normalized = ctx.normalizeImageUrl(src);
    if (!normalized) return;
    const existing = map.get(key) ?? new Set<string>();
    existing.add(normalized);
    map.set(key, existing);
  };

  const variants = product.variants ?? [];
  for (const variant of variants as Array<
    ShopifyProductVariant | ShopifySingleProductVariant
  >) {
    const featured = variant.featured_image as any;
    if (featured && typeof featured === "object") {
      add(variant.id, featured.src);
    }
  }

  if ("images" in product && Array.isArray(product.images)) {
    const images = product.images as unknown[];
    for (const img of images) {
      if (!img || typeof img !== "object") continue;
      const o = img as Record<string, unknown>;
      const src = o.src;
      const variantIds = o.variant_ids;
      if (!Array.isArray(variantIds)) continue;
      for (const variantId of variantIds) {
        add(variantId, src);
      }
    }
  }

  const out: Record<string, string[]> = {};
  for (const [variantId, urls] of map.entries()) {
    out[variantId] = Array.from(urls);
  }
  return out;
}

export function mapProductsDto<
  C extends ProductColumnsMode = "minimal",
  I extends ProductImagesMode = "minimal",
  O extends ProductOptionsMode = "minimal",
>(
  products: ShopifyProduct[] | null,
  ctx: Ctx,
  options?: { columns?: ProductColumnsConfig<C, I, O> }
): ProductResult<C, I, O>[] | null {
  if (!products || products.length === 0) return null;

  const columns = resolveColumnsConfig<C, I, O>(options?.columns);

  const mapOne = (product: ShopifyProduct) => {
    const optionNames = product.options.map((o) => o.name);
    const variantOptionsMap = buildVariantOptionsMap(
      optionNames,
      product.variants
    );
    const mappedVariants = mapVariants(product);

    const priceValues = mappedVariants
      .map((v) => v.price)
      .filter((p) => typeof p === "number" && !Number.isNaN(p));
    const compareAtValues = mappedVariants
      .map((v) => v.compareAtPrice || 0)
      .filter((p) => typeof p === "number" && !Number.isNaN(p));

    const priceMin = priceValues.length ? Math.min(...priceValues) : 0;
    const priceMax = priceValues.length ? Math.max(...priceValues) : 0;
    const priceVaries = mappedVariants.length > 1 && priceMin !== priceMax;

    const compareAtMin = compareAtValues.length
      ? Math.min(...compareAtValues)
      : 0;
    const compareAtMax = compareAtValues.length
      ? Math.max(...compareAtValues)
      : 0;
    const compareAtVaries =
      mappedVariants.length > 1 && compareAtMin !== compareAtMax;

    const slug = genProductSlug({
      handle: product.handle,
      storeDomain: ctx.storeDomain,
    });
    const url = `${ctx.storeDomain}/products/${product.handle}`;
    const discount = calculateDiscount(priceMin, compareAtMin);
    const variantImages = buildVariantImagesMap(product, ctx);

    const imagesMinimal = product.images.map((img) => ({
      src: ctx.normalizeImageUrl(img.src),
    }));
    const imagesFull = product.images.map((image) => ({
      id: image.id,
      productId: image.product_id,
      alt: null,
      position: image.position,
      src: ctx.normalizeImageUrl(image.src),
      width: image.width,
      height: image.height,
      mediaType: "image" as const,
      variantIds: image.variant_ids || [],
      createdAt: image.created_at,
      updatedAt: image.updated_at,
    }));
    const images = columns.images === "full" ? imagesFull : imagesMinimal;

    const optionsMinimal = product.options.map((option) => ({
      key: normalizeKey(option.name),
      name: option.name,
      values: option.values,
    }));
    const optionsFull = product.options.map((option) => ({
      key: normalizeKey(option.name),
      data: option.values,
      name: option.name,
      position: option.position,
      values: option.values,
    }));
    const mappedOptions =
      columns.options === "full" ? optionsFull : optionsMinimal;

    const featuredImage = product.images?.[0]?.src
      ? ctx.normalizeImageUrl(product.images[0].src)
      : null;

    if (columns.mode === "minimal") {
      const minimalBase: Omit<MinimalProduct, "images" | "options"> = {
        title: product.title,
        bodyHtml: product.body_html || null,
        price: priceMin,
        compareAtPrice: compareAtMin,
        discount,
        featuredImage,
        variantImages,
        available: mappedVariants.some((v) => v.available),
        localizedPricing: {
          priceFormatted: ctx.formatPrice(priceMin),
          compareAtPriceFormatted: ctx.formatPrice(compareAtMin),
        },
        variantOptionsMap,
        url,
        slug,
        platformId: product.id.toString(),
      };
      return {
        ...minimalBase,
        images,
        options: mappedOptions,
      } as ProductResult<C, I, O>;
    }

    const fullBase: Omit<Product, "images" | "options"> = {
      slug,
      handle: product.handle,
      platformId: product.id.toString(),
      title: product.title,
      available: mappedVariants.some((v) => v.available),
      price: priceMin,
      priceMin: priceMin,
      priceMax: priceMax,
      priceVaries,
      compareAtPrice: compareAtMin,
      compareAtPriceMin: compareAtMin,
      compareAtPriceMax: compareAtMax,
      compareAtPriceVaries: compareAtVaries,
      discount,
      currency: ctx.currency,
      localizedPricing: {
        currency: ctx.currency,
        priceFormatted: ctx.formatPrice(priceMin),
        priceMinFormatted: ctx.formatPrice(priceMin),
        priceMaxFormatted: ctx.formatPrice(priceMax),
        compareAtPriceFormatted: ctx.formatPrice(compareAtMin),
      },
      variantOptionsMap,
      bodyHtml: product.body_html || null,
      active: true,
      productType: product.product_type || null,
      tags: Array.isArray(product.tags) ? product.tags : [],
      vendor: product.vendor,
      featuredImage,
      isProxyFeaturedImage: false,
      createdAt: safeParseDate(product.created_at),
      updatedAt: safeParseDate(product.updated_at),
      variants: mappedVariants,
      variantImages,
      publishedAt: safeParseDate(product.published_at) ?? null,
      seo: null,
      metaTags: null,
      displayScore: undefined,
      deletedAt: null,
      storeSlug: ctx.storeSlug,
      storeDomain: ctx.storeDomain,
      url,
      embedding: undefined,
      requiresSellingPlan: undefined,
      sellingPlanGroups: undefined,
      enriched_content: undefined,
    };
    return {
      ...fullBase,
      images,
      options: mappedOptions,
    } as ProductResult<C, I, O>;
  };

  return products.map(mapOne) as ProductResult<C, I, O>[];
}

export function mapProductDto<
  C extends ProductColumnsMode = "minimal",
  I extends ProductImagesMode = "minimal",
  O extends ProductOptionsMode = "minimal",
>(
  product: ShopifySingleProduct,
  ctx: Ctx,
  options?: { columns?: ProductColumnsConfig<C, I, O> }
): ProductResult<C, I, O> {
  const columns = resolveColumnsConfig<C, I, O>(options?.columns);
  const optionNames = product.options.map((o) => o.name);
  const variantOptionsMap = buildVariantOptionsMap(
    optionNames,
    product.variants
  );

  const slug = genProductSlug({
    handle: product.handle,
    storeDomain: ctx.storeDomain,
  });
  const url = product.url || `${ctx.storeDomain}/products/${product.handle}`;
  const discount = calculateDiscount(
    product.price,
    product.compare_at_price || 0
  );
  const variantImages = buildVariantImagesMap(product, ctx);

  const imagesMinimal = Array.isArray(product.images)
    ? product.images.map((imageSrc) => ({
        src: ctx.normalizeImageUrl(imageSrc),
      }))
    : [];
  const imagesFull = Array.isArray(product.images)
    ? product.images.map((imageSrc, index) => ({
        id: index + 1,
        productId: product.id,
        alt: null,
        position: index + 1,
        src: ctx.normalizeImageUrl(imageSrc),
        width: 0,
        height: 0,
        mediaType: "image" as const,
        variantIds: [],
        createdAt: product.created_at,
        updatedAt: product.updated_at,
      }))
    : [];
  const images = columns.images === "full" ? imagesFull : imagesMinimal;

  const optionsMinimal = product.options.map((option) => ({
    key: normalizeKey(option.name),
    name: option.name,
    values: option.values,
  }));
  const optionsFull = product.options.map((option) => ({
    key: normalizeKey(option.name),
    data: option.values,
    name: option.name,
    position: option.position,
    values: option.values,
  }));
  const mappedOptions =
    columns.options === "full" ? optionsFull : optionsMinimal;

  const featuredImage = ctx.normalizeImageUrl(product.featured_image);
  if (columns.mode === "minimal") {
    const minimalBase: Omit<MinimalProduct, "images" | "options"> = {
      title: product.title,
      bodyHtml: product.description || null,
      price: product.price,
      compareAtPrice: product.compare_at_price || 0,
      discount,
      featuredImage,
      variantImages,
      available: product.available,
      localizedPricing: {
        priceFormatted: ctx.formatPrice(product.price),
        compareAtPriceFormatted: ctx.formatPrice(product.compare_at_price || 0),
      },
      variantOptionsMap,
      url,
      slug,
      platformId: product.id.toString(),
    };
    return {
      ...minimalBase,
      images,
      options: mappedOptions,
    } as ProductResult<C, I, O>;
  }

  const fullBase: Omit<Product, "images" | "options"> = {
    slug,
    handle: product.handle,
    platformId: product.id.toString(),
    title: product.title,
    available: product.available,
    price: product.price,
    priceMin: product.price_min,
    priceMax: product.price_max,
    priceVaries: product.price_varies,
    compareAtPrice: product.compare_at_price || 0,
    compareAtPriceMin: product.compare_at_price_min,
    compareAtPriceMax: product.compare_at_price_max,
    compareAtPriceVaries: product.compare_at_price_varies,
    discount,
    currency: ctx.currency,
    localizedPricing: {
      currency: ctx.currency,
      priceFormatted: ctx.formatPrice(product.price),
      priceMinFormatted: ctx.formatPrice(product.price_min),
      priceMaxFormatted: ctx.formatPrice(product.price_max),
      compareAtPriceFormatted: ctx.formatPrice(product.compare_at_price || 0),
    },
    variantOptionsMap,
    bodyHtml: product.description || null,
    active: true,
    productType: product.type || null,
    tags: Array.isArray(product.tags)
      ? product.tags
      : typeof product.tags === "string"
        ? [product.tags]
        : [],
    vendor: product.vendor,
    featuredImage,
    isProxyFeaturedImage: false,
    createdAt: safeParseDate(product.created_at),
    updatedAt: safeParseDate(product.updated_at),
    variants: mapVariants(product),
    variantImages,
    publishedAt: safeParseDate(product.published_at) ?? null,
    seo: null,
    metaTags: null,
    displayScore: undefined,
    deletedAt: null,
    storeSlug: ctx.storeSlug,
    storeDomain: ctx.storeDomain,
    url,
    embedding: undefined,
    requiresSellingPlan: product.requires_selling_plan ?? null,
    sellingPlanGroups: product.selling_plan_groups ?? undefined,
    enriched_content: undefined,
  };
  return {
    ...fullBase,
    images,
    options: mappedOptions,
  } as ProductResult<C, I, O>;
}
