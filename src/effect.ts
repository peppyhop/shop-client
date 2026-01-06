import { Context, Data, Effect, Layer, Schedule } from "effect";
import { classifyProduct, generateSEOContent } from "./ai/enrich";
import type {
  CheckoutOperations,
  CollectionOperations,
  OpenGraphMeta,
  ProductOperations,
  ShopClientOptions,
  ShopInfo,
  ShopOperations,
  StoreTypeBreakdown,
} from "./index";
import { ShopClient } from "./index";
import { detectShopCountry } from "./utils/detect-country";
import { configureRateLimit } from "./utils/rate-limit";

export class ShopClientMakeError extends Data.TaggedError(
  "ShopClientMakeError"
)<{ input: string; cause: unknown }> {}

export class ShopClientOperationError extends Data.TaggedError(
  "ShopClientOperationError"
)<{ operation: string; cause: unknown }> {}

export type ShopClientError = ShopClientMakeError | ShopClientOperationError;

export type ShopClientEffect = {
  readonly products: ProductOperationsEffect;
  readonly collections: CollectionOperationsEffect;
  readonly checkout: CheckoutOperationsEffect;
  readonly shopOperations: ShopOperationsEffect;
  readonly getInfo: (
    options?: Parameters<ShopClient["getInfo"]>[0]
  ) => Effect.Effect<ShopInfo, ShopClientOperationError>;
  readonly getMetaData: (
    options?: Parameters<ShopClient["getMetaData"]>[0]
  ) => Effect.Effect<OpenGraphMeta, ShopClientOperationError>;
  readonly clearInfoCache: () => Effect.Effect<void, never>;
  readonly determineStoreType: (
    options?: Parameters<ShopClient["determineStoreType"]>[0]
  ) => Effect.Effect<StoreTypeBreakdown, ShopClientOperationError>;
};

export class ShopClientTag extends Context.Tag("ShopClient")<
  ShopClientTag,
  ShopClientEffect
>() {}

export function makeShopClient(
  urlPath: string,
  options?: ShopClientOptions
): Effect.Effect<ShopClientEffect, ShopClientMakeError> {
  return Effect.try({
    try: () => new ShopClient(urlPath, options),
    catch: (cause: unknown) =>
      new ShopClientMakeError({ input: urlPath, cause }),
  }).pipe(Effect.map(wrapShopClient));
}

export function shopClientLayer(
  urlPath: string,
  options?: ShopClientOptions
): Layer.Layer<ShopClientTag, ShopClientMakeError> {
  return Layer.effect(ShopClientTag, makeShopClient(urlPath, options));
}

export type ShopClientCallOptions = {
  readonly timeoutMs?: number;
  readonly retry?: {
    readonly maxRetries?: number;
    readonly baseDelayMs?: number;
  };
};

function withPolicy<A, R>(
  operation: string,
  effect: Effect.Effect<A, ShopClientOperationError, R>,
  options?: ShopClientCallOptions
): Effect.Effect<A, ShopClientOperationError, R> {
  const timeoutMs =
    typeof options?.timeoutMs === "number" && options.timeoutMs > 0
      ? options.timeoutMs
      : undefined;

  const withTimeout =
    typeof timeoutMs === "number"
      ? effect.pipe(
          Effect.timeoutFail({
            duration: timeoutMs,
            onTimeout: () =>
              new ShopClientOperationError({
                operation: `${operation}.timeout`,
                cause: { timeoutMs },
              }),
          })
        )
      : effect;

  const maxRetries = Math.max(0, options?.retry?.maxRetries ?? 0);
  if (maxRetries === 0) return withTimeout;

  const baseDelayMs = Math.max(0, options?.retry?.baseDelayMs ?? 200);
  const schedule = Schedule.exponential(baseDelayMs).pipe(
    Schedule.jittered,
    Schedule.intersect(Schedule.recurs(maxRetries))
  );
  return withTimeout.pipe(Effect.retry(schedule));
}

function toOperationEffect<A>(
  operation: string,
  f: () => Promise<A>,
  policy?: ShopClientCallOptions
): Effect.Effect<A, ShopClientOperationError> {
  return withPolicy(
    operation,
    Effect.tryPromise({
      try: () => f(),
      catch: (cause: unknown) =>
        new ShopClientOperationError({ operation, cause }),
    }),
    policy
  );
}

export function configureRateLimitEffect(
  options: Parameters<typeof configureRateLimit>[0]
): Effect.Effect<void, never> {
  return Effect.sync(() => configureRateLimit(options));
}

export function detectShopCountryEffect(
  domain: Parameters<typeof detectShopCountry>[0],
  policy?: ShopClientCallOptions
): Effect.Effect<
  Awaited<ReturnType<typeof detectShopCountry>>,
  ShopClientOperationError
> {
  return toOperationEffect(
    "detectShopCountry",
    () => detectShopCountry(domain),
    policy
  );
}

export function classifyProductEffect(
  content: Parameters<typeof classifyProduct>[0],
  options?: Parameters<typeof classifyProduct>[1],
  policy?: ShopClientCallOptions
): Effect.Effect<
  Awaited<ReturnType<typeof classifyProduct>>,
  ShopClientOperationError
> {
  return toOperationEffect(
    "classifyProduct",
    () => classifyProduct(content, options),
    policy
  );
}

export function generateSEOContentEffect(
  productHandle: Parameters<typeof generateSEOContent>[0],
  options?: Parameters<typeof generateSEOContent>[1],
  policy?: ShopClientCallOptions
): Effect.Effect<
  Awaited<ReturnType<typeof generateSEOContent>>,
  ShopClientOperationError
> {
  return toOperationEffect(
    "generateSEOContent",
    () => generateSEOContent(productHandle, options),
    policy
  );
}

type ProductOperationsEffect = {
  readonly all: (
    options?: Parameters<ProductOperations["all"]>[0],
    policy?: ShopClientCallOptions
  ) => Effect.Effect<
    Awaited<ReturnType<ProductOperations["all"]>>,
    ShopClientOperationError
  >;
  readonly paginated: (
    options?: Parameters<ProductOperations["paginated"]>[0],
    policy?: ShopClientCallOptions
  ) => Effect.Effect<
    Awaited<ReturnType<ProductOperations["paginated"]>>,
    ShopClientOperationError
  >;
  readonly find: (
    productHandle: Parameters<ProductOperations["find"]>[0],
    options?: Parameters<ProductOperations["find"]>[1],
    policy?: ShopClientCallOptions
  ) => Effect.Effect<
    Awaited<ReturnType<ProductOperations["find"]>>,
    ShopClientOperationError
  >;
  readonly findEnhanced: (
    productHandle: Parameters<ProductOperations["findEnhanced"]>[0],
    options: Parameters<ProductOperations["findEnhanced"]>[1],
    policy?: ShopClientCallOptions
  ) => Effect.Effect<
    Awaited<ReturnType<ProductOperations["findEnhanced"]>>,
    ShopClientOperationError
  >;
  readonly enriched: (
    productHandle: Parameters<ProductOperations["enriched"]>[0],
    options?: Parameters<ProductOperations["enriched"]>[1],
    policy?: ShopClientCallOptions
  ) => Effect.Effect<
    Awaited<ReturnType<ProductOperations["enriched"]>>,
    ShopClientOperationError
  >;
  readonly enrichedPrompts: (
    productHandle: Parameters<ProductOperations["enrichedPrompts"]>[0],
    options?: Parameters<ProductOperations["enrichedPrompts"]>[1],
    policy?: ShopClientCallOptions
  ) => Effect.Effect<
    Awaited<ReturnType<ProductOperations["enrichedPrompts"]>>,
    ShopClientOperationError
  >;
  readonly classify: (
    productHandle: Parameters<ProductOperations["classify"]>[0],
    options?: Parameters<ProductOperations["classify"]>[1],
    policy?: ShopClientCallOptions
  ) => Effect.Effect<
    Awaited<ReturnType<ProductOperations["classify"]>>,
    ShopClientOperationError
  >;
  readonly classifyPrompts: (
    productHandle: Parameters<ProductOperations["classifyPrompts"]>[0],
    options?: Parameters<ProductOperations["classifyPrompts"]>[1],
    policy?: ShopClientCallOptions
  ) => Effect.Effect<
    Awaited<ReturnType<ProductOperations["classifyPrompts"]>>,
    ShopClientOperationError
  >;
  readonly generateSEOContent: (
    productHandle: Parameters<ProductOperations["generateSEOContent"]>[0],
    options?: Parameters<ProductOperations["generateSEOContent"]>[1],
    policy?: ShopClientCallOptions
  ) => Effect.Effect<
    Awaited<ReturnType<ProductOperations["generateSEOContent"]>>,
    ShopClientOperationError
  >;
  readonly infoHtml: (
    productHandle: Parameters<ProductOperations["infoHtml"]>[0],
    content?: Parameters<ProductOperations["infoHtml"]>[1],
    policy?: ShopClientCallOptions
  ) => Effect.Effect<
    Awaited<ReturnType<ProductOperations["infoHtml"]>>,
    ShopClientOperationError
  >;
  readonly showcased: (
    options?: Parameters<ProductOperations["showcased"]>[0],
    policy?: ShopClientCallOptions
  ) => Effect.Effect<
    Awaited<ReturnType<ProductOperations["showcased"]>>,
    ShopClientOperationError
  >;
  readonly filter: (
    policy?: ShopClientCallOptions
  ) => Effect.Effect<
    Awaited<ReturnType<ProductOperations["filter"]>>,
    ShopClientOperationError
  >;
  readonly predictiveSearch: (
    query: Parameters<ProductOperations["predictiveSearch"]>[0],
    options?: Parameters<ProductOperations["predictiveSearch"]>[1],
    policy?: ShopClientCallOptions
  ) => Effect.Effect<
    Awaited<ReturnType<ProductOperations["predictiveSearch"]>>,
    ShopClientOperationError
  >;
  readonly recommendations: (
    productId: Parameters<ProductOperations["recommendations"]>[0],
    options?: Parameters<ProductOperations["recommendations"]>[1],
    policy?: ShopClientCallOptions
  ) => Effect.Effect<
    Awaited<ReturnType<ProductOperations["recommendations"]>>,
    ShopClientOperationError
  >;
};

type CollectionOperationsEffect = {
  readonly all: (
    policy?: ShopClientCallOptions
  ) => Effect.Effect<
    Awaited<ReturnType<CollectionOperations["all"]>>,
    ShopClientOperationError
  >;
  readonly paginated: (
    options?: Parameters<CollectionOperations["paginated"]>[0],
    policy?: ShopClientCallOptions
  ) => Effect.Effect<
    Awaited<ReturnType<CollectionOperations["paginated"]>>,
    ShopClientOperationError
  >;
  readonly find: (
    collectionHandle: Parameters<CollectionOperations["find"]>[0],
    policy?: ShopClientCallOptions
  ) => Effect.Effect<
    Awaited<ReturnType<CollectionOperations["find"]>>,
    ShopClientOperationError
  >;
  readonly showcased: (
    policy?: ShopClientCallOptions
  ) => Effect.Effect<
    Awaited<ReturnType<CollectionOperations["showcased"]>>,
    ShopClientOperationError
  >;
  readonly products: {
    readonly paginated: (
      collectionHandle: Parameters<
        CollectionOperations["products"]["paginated"]
      >[0],
      options?: Parameters<CollectionOperations["products"]["paginated"]>[1],
      policy?: ShopClientCallOptions
    ) => Effect.Effect<
      Awaited<ReturnType<CollectionOperations["products"]["paginated"]>>,
      ShopClientOperationError
    >;
    readonly all: (
      collectionHandle: Parameters<CollectionOperations["products"]["all"]>[0],
      options?: Parameters<CollectionOperations["products"]["all"]>[1],
      policy?: ShopClientCallOptions
    ) => Effect.Effect<
      Awaited<ReturnType<CollectionOperations["products"]["all"]>>,
      ShopClientOperationError
    >;
    readonly slugs: (
      collectionHandle: Parameters<
        CollectionOperations["products"]["slugs"]
      >[0],
      policy?: ShopClientCallOptions
    ) => Effect.Effect<
      Awaited<ReturnType<CollectionOperations["products"]["slugs"]>>,
      ShopClientOperationError
    >;
  };
};

type CheckoutOperationsEffect = {
  readonly createUrl: (
    params: Parameters<CheckoutOperations["createUrl"]>[0]
  ) => Effect.Effect<ReturnType<CheckoutOperations["createUrl"]>, never>;
};

type ShopOperationsEffect = {
  readonly info: (
    policy?: ShopClientCallOptions
  ) => Effect.Effect<
    Awaited<ReturnType<ShopOperations["info"]>>,
    ShopClientOperationError
  >;
  readonly getMetaData: (
    policy?: ShopClientCallOptions
  ) => Effect.Effect<
    Awaited<ReturnType<ShopOperations["getMetaData"]>>,
    ShopClientOperationError
  >;
  readonly getJsonLd: (
    policy?: ShopClientCallOptions
  ) => Effect.Effect<
    Awaited<ReturnType<ShopOperations["getJsonLd"]>>,
    ShopClientOperationError
  >;
  readonly getHeaderLinks: (
    policy?: ShopClientCallOptions
  ) => Effect.Effect<
    Awaited<ReturnType<ShopOperations["getHeaderLinks"]>>,
    ShopClientOperationError
  >;
};

function wrapShopClient(shop: ShopClient): ShopClientEffect {
  const toEffect = <A>(
    operation: string,
    f: () => Promise<A>,
    policy?: ShopClientCallOptions
  ): Effect.Effect<A, ShopClientOperationError> =>
    withPolicy(
      operation,
      Effect.tryPromise({
        try: () => f(),
        catch: (cause: unknown) =>
          new ShopClientOperationError({ operation, cause }),
      }),
      policy
    );

  const products: ProductOperationsEffect = {
    all: (options, policy) =>
      toEffect("products.all", () => shop.products.all(options), policy),
    paginated: (options, policy) =>
      toEffect(
        "products.paginated",
        () => shop.products.paginated(options),
        policy
      ),
    find: (handle, options, policy) =>
      toEffect(
        "products.find",
        () => shop.products.find(handle, options),
        policy
      ),
    findEnhanced: (handle, options, policy) =>
      toEffect(
        "products.findEnhanced",
        () => shop.products.findEnhanced(handle, options),
        policy
      ),
    enriched: (handle, options, policy) =>
      toEffect(
        "products.enriched",
        () => shop.products.enriched(handle, options),
        policy
      ),
    enrichedPrompts: (handle, options, policy) =>
      toEffect(
        "products.enrichedPrompts",
        () => shop.products.enrichedPrompts(handle, options),
        policy
      ),
    classify: (handle, options, policy) =>
      toEffect(
        "products.classify",
        () => shop.products.classify(handle, options),
        policy
      ),
    classifyPrompts: (handle, options, policy) =>
      toEffect(
        "products.classifyPrompts",
        () => shop.products.classifyPrompts(handle, options),
        policy
      ),
    generateSEOContent: (handle, options, policy) =>
      toEffect(
        "products.generateSEOContent",
        () => shop.products.generateSEOContent(handle, options),
        policy
      ),
    infoHtml: (handle, content, policy) =>
      toEffect(
        "products.infoHtml",
        () => shop.products.infoHtml(handle, content),
        policy
      ),
    showcased: (options, policy) =>
      toEffect(
        "products.showcased",
        () => shop.products.showcased(options),
        policy
      ),
    filter: (policy) =>
      toEffect("products.filter", () => shop.products.filter(), policy),
    predictiveSearch: (query, options, policy) =>
      toEffect(
        "products.predictiveSearch",
        () => shop.products.predictiveSearch(query, options),
        policy
      ),
    recommendations: (productId, options, policy) =>
      toEffect(
        "products.recommendations",
        () => shop.products.recommendations(productId, options),
        policy
      ),
  };

  const collections: CollectionOperationsEffect = {
    all: (policy) =>
      toEffect("collections.all", () => shop.collections.all(), policy),
    paginated: (options, policy) =>
      toEffect(
        "collections.paginated",
        () => shop.collections.paginated(options),
        policy
      ),
    find: (handle, policy) =>
      toEffect("collections.find", () => shop.collections.find(handle), policy),
    showcased: (policy) =>
      toEffect(
        "collections.showcased",
        () => shop.collections.showcased(),
        policy
      ),
    products: {
      paginated: (handle, options, policy) =>
        toEffect(
          "collections.products.paginated",
          () => shop.collections.products.paginated(handle, options),
          policy
        ),
      all: (handle, options, policy) =>
        toEffect(
          "collections.products.all",
          () => shop.collections.products.all(handle, options),
          policy
        ),
      slugs: (handle, policy) =>
        toEffect(
          "collections.products.slugs",
          () => shop.collections.products.slugs(handle),
          policy
        ),
    },
  };

  const checkout: CheckoutOperationsEffect = {
    createUrl: (params) => Effect.sync(() => shop.checkout.createUrl(params)),
  };

  const shopOperations: ShopOperationsEffect = {
    info: (policy) =>
      toEffect("shopOperations.info", () => shop.shopOperations.info(), policy),
    getMetaData: (policy) =>
      toEffect(
        "shopOperations.getMetaData",
        () => shop.shopOperations.getMetaData(),
        policy
      ),
    getJsonLd: (policy) =>
      toEffect(
        "shopOperations.getJsonLd",
        () => shop.shopOperations.getJsonLd(),
        policy
      ),
    getHeaderLinks: (policy) =>
      toEffect(
        "shopOperations.getHeaderLinks",
        () => shop.shopOperations.getHeaderLinks(),
        policy
      ),
  };

  return {
    products,
    collections,
    checkout,
    shopOperations,
    getInfo: (options) => toEffect("getInfo", () => shop.getInfo(options)),
    getMetaData: (options) =>
      toEffect("getMetaData", () => shop.getMetaData(options)),
    clearInfoCache: () => Effect.sync(() => shop.clearInfoCache()),
    determineStoreType: (options) =>
      toEffect("determineStoreType", () => shop.determineStoreType(options)),
  };
}
