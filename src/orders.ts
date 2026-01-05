import type {
  AdminOrderCreateInput,
  AdminOrderTracking,
  CurrencyCode,
} from "./types";
import { rateLimitedFetch } from "./utils/rate-limit";

export interface OrderOperations {
  create(
    order: AdminOrderCreateInput,
    options: { apiKey: string; apiVersion?: string }
  ): Promise<unknown>;

  cancel(
    orderId: number,
    options: {
      apiKey: string;
      apiVersion?: string;
      reason?: string;
      email?: boolean;
      restock?: boolean;
      refund?: boolean;
    }
  ): Promise<unknown>;

  track(
    orderId: number,
    options: { apiKey: string; apiVersion?: string; currency?: CurrencyCode }
  ): Promise<AdminOrderTracking | null>;
}

export function createOrderOperations(context: {
  storeDomain: string;
  defaultApiVersion: string;
}): OrderOperations {
  type RestClient = {
    get: (path: string, options?: Record<string, unknown>) => Promise<Response>;
    post: (path: string, options: Record<string, unknown>) => Promise<Response>;
  };

  const restClients = new Map<string, RestClient>();

  const getStoreHost = (): string => {
    try {
      if (
        context.storeDomain.startsWith("http://") ||
        context.storeDomain.startsWith("https://")
      ) {
        return new URL(context.storeDomain).hostname;
      }
      return context.storeDomain.replace(/^\/+|\/+$/g, "");
    } catch {
      return context.storeDomain
        .replace(/^https?:\/\//, "")
        .replace(/^\/+|\/+$/g, "");
    }
  };

  const customFetchApi = (url: string, init?: RequestInit) => {
    return rateLimitedFetch(url, { ...(init ?? {}), rateLimitClass: "admin" });
  };

  const getRestClient = async (
    apiKey: string,
    apiVersion: string
  ): Promise<RestClient> => {
    const cacheKey = `${apiKey}::${apiVersion}`;
    const existing = restClients.get(cacheKey);
    if (existing) return existing;

    const mod = await import("@shopify/admin-api-client");
    const storeDomain = getStoreHost();
    const client = (mod as any).createAdminRestApiClient({
      storeDomain,
      apiVersion,
      accessToken: apiKey,
      customFetchApi,
      retries: 2,
    });
    restClients.set(cacheKey, client);
    return client;
  };

  const requireApiKey = (apiKey: string) => {
    if (!apiKey || typeof apiKey !== "string" || !apiKey.trim()) {
      throw new Error("apiKey is required");
    }
  };

  const parseOrderFromRestResponse = async (
    resp: Response
  ): Promise<unknown> => {
    const body = await resp.json().catch(() => null);
    if (body && typeof body === "object" && "order" in body) {
      return (body as any).order;
    }
    return body;
  };

  const assertOk = (resp: Response, action: string) => {
    if (resp.ok) return;
    const status = resp.status || 0;
    const statusText = resp.statusText || "Request failed";
    throw new Error(`${action} failed: ${status} ${statusText}`.trim());
  };

  return {
    async create(order, options) {
      requireApiKey(options.apiKey);
      const apiVersion = options.apiVersion ?? context.defaultApiVersion;
      const client = await getRestClient(options.apiKey, apiVersion);
      const resp = await client.post("orders", { data: { order } });
      assertOk(resp, "orders.create");
      return await parseOrderFromRestResponse(resp);
    },

    async cancel(orderId, options) {
      requireApiKey(options.apiKey);
      if (!Number.isFinite(orderId) || orderId <= 0) {
        throw new Error("Valid orderId is required");
      }

      const apiVersion = options.apiVersion ?? context.defaultApiVersion;
      const client = await getRestClient(options.apiKey, apiVersion);
      const data: Record<string, unknown> = {};
      if (typeof options.reason === "string" && options.reason.trim()) {
        data.reason = options.reason.trim();
      }
      if (typeof options.email === "boolean") data.email = options.email;
      if (typeof options.restock === "boolean") data.restock = options.restock;
      if (typeof options.refund === "boolean") data.refund = options.refund;

      const resp = await client.post(`orders/${orderId}/cancel`, {
        data: Object.keys(data).length ? data : {},
      });
      assertOk(resp, "orders.cancel");
      return await parseOrderFromRestResponse(resp);
    },

    async track(orderId, options) {
      requireApiKey(options.apiKey);
      if (!Number.isFinite(orderId) || orderId <= 0) {
        throw new Error("Valid orderId is required");
      }

      const apiVersion = options.apiVersion ?? context.defaultApiVersion;
      const client = await getRestClient(options.apiKey, apiVersion);
      const resp = await client.get(`orders/${orderId}`, {
        searchParams: {
          fields:
            "id,name,created_at,updated_at,cancelled_at,financial_status,fulfillment_status,order_status_url,fulfillments",
        },
      });
      if (!resp.ok) return null;
      const order = (await parseOrderFromRestResponse(resp)) as any;
      if (!order || typeof order !== "object") return null;

      const fulfillments = Array.isArray(order.fulfillments)
        ? (order.fulfillments as any[])
        : [];

      const normalized: AdminOrderTracking = {
        id: typeof order.id === "number" ? order.id : orderId,
        name: typeof order.name === "string" ? order.name : undefined,
        financialStatus:
          typeof order.financial_status === "string"
            ? order.financial_status
            : undefined,
        fulfillmentStatus:
          typeof order.fulfillment_status === "string"
            ? order.fulfillment_status
            : undefined,
        cancelledAt:
          typeof order.cancelled_at === "string" ? order.cancelled_at : null,
        orderStatusUrl:
          typeof order.order_status_url === "string"
            ? order.order_status_url
            : null,
        fulfillments: fulfillments.map((f) => {
          const trackingNumbers = Array.isArray(f.tracking_numbers)
            ? f.tracking_numbers
            : typeof f.tracking_number === "string" && f.tracking_number
              ? [f.tracking_number]
              : [];
          const trackingUrls = Array.isArray(f.tracking_urls)
            ? f.tracking_urls
            : typeof f.tracking_url === "string" && f.tracking_url
              ? [f.tracking_url]
              : [];
          return {
            id: typeof f.id === "number" ? f.id : undefined,
            status: typeof f.status === "string" ? f.status : undefined,
            trackingCompany:
              typeof f.tracking_company === "string"
                ? f.tracking_company
                : undefined,
            trackingNumbers: trackingNumbers.filter(
              (v: unknown) => typeof v === "string"
            ),
            trackingUrls: trackingUrls.filter(
              (v: unknown) => typeof v === "string"
            ),
          };
        }),
      };

      return normalized;
    },
  };
}
