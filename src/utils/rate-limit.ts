export interface RateLimitOptions {
  maxRequestsPerInterval: number; // tokens refilled every interval
  intervalMs: number; // refill period
  maxConcurrency: number; // simultaneous in-flight requests
}

type Task<T> = {
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

class RateLimiter {
  private options: RateLimitOptions;
  private queue: Task<unknown>[] = [];
  private tokens: number;
  private inFlight = 0;
  private refillTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options: RateLimitOptions) {
    this.options = options;
    this.tokens = options.maxRequestsPerInterval;
  }

  private startRefill() {
    if (this.refillTimer) return;
    this.refillTimer = setInterval(() => {
      this.tokens = this.options.maxRequestsPerInterval;
      this.tryRun();
    }, this.options.intervalMs);
    // In some runtimes, timers keep process alive; make it best-effort
    const t = this.refillTimer as unknown;
    if (t && typeof t === "object") {
      const rec = t as Record<string, unknown>;
      if (typeof rec.unref === "function") {
        (rec.unref as () => void)();
      }
    }
  }

  private ensureRefillStarted() {
    if (!this.refillTimer) {
      this.startRefill();
    }
  }

  configure(next: Partial<RateLimitOptions>) {
    this.options = { ...this.options, ...next };
    // Clamp to sensible minimums
    this.options.maxRequestsPerInterval = Math.max(
      1,
      this.options.maxRequestsPerInterval
    );
    this.options.intervalMs = Math.max(10, this.options.intervalMs);
    this.options.maxConcurrency = Math.max(1, this.options.maxConcurrency);
  }

  schedule<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      // Start the timer lazily on first schedule/use
      this.ensureRefillStarted();
      this.queue.push({
        fn: fn as () => Promise<unknown>,
        resolve: resolve as (value: unknown) => void,
        reject: reject as (reason?: unknown) => void,
      });
      this.tryRun();
    });
  }

  private tryRun() {
    while (
      this.queue.length > 0 &&
      this.inFlight < this.options.maxConcurrency &&
      this.tokens > 0
    ) {
      const task = this.queue.shift()!;
      this.tokens -= 1;
      this.inFlight += 1;

      // Execute task and release slot when done
      Promise.resolve()
        .then(task.fn)
        .then((result) => task.resolve(result))
        .catch((err) => task.reject(err))
        .finally(() => {
          this.inFlight -= 1;
          // Yield to event loop, then continue draining
          setTimeout(() => this.tryRun(), 0);
        });
    }
  }
}

let enabled = true;
const defaultOptions: RateLimitOptions = {
  maxRequestsPerInterval: 5, // 5 requests
  intervalMs: 1000, // per second
  maxConcurrency: 5, // up to 5 in parallel
};

const limiter = new RateLimiter(defaultOptions);
const hostLimiters = new Map<string, RateLimiter>();
const classLimiters = new Map<string, RateLimiter>();

export type RateLimitedRequestInit = RequestInit & {
  rateLimitClass?: string;
  retry?: {
    maxRetries?: number; // total attempts minus one
    baseDelayMs?: number; // initial backoff delay
    retryOnStatuses?: number[]; // HTTP statuses to retry (defaults: 429, 503)
  };
  timeoutMs?: number;
};

function getHost(input: RequestInfo | URL): string | undefined {
  try {
    if (typeof input === "string") {
      return new URL(input).host;
    }
    if (input instanceof URL) {
      return input.host;
    }
    // Request object or similar
    const rec = input as unknown as Record<string, unknown>;
    const url = typeof rec.url === "string" ? rec.url : undefined;
    if (url) {
      return new URL(url).host;
    }
  } catch {
    // ignore parsing errors
  }
  return undefined;
}

function getHostLimiter(host?: string): RateLimiter | undefined {
  if (!host) return undefined;
  // Exact match first
  const exact = hostLimiters.get(host);
  if (exact) return exact;
  // Wildcard suffix match: keys of the form '*.example.com'
  for (const [key, lim] of hostLimiters.entries()) {
    if (key.startsWith("*.") && host.endsWith(key.slice(2))) {
      return lim;
    }
  }
  return undefined;
}

export function configureRateLimit(
  options: Partial<RateLimitOptions & { enabled: boolean }> & {
    perHost?: Record<string, Partial<RateLimitOptions>>; // key: host (supports '*.example.com')
    perClass?: Record<string, Partial<RateLimitOptions>>; // key: arbitrary class name
  }
) {
  if (typeof options.enabled === "boolean") {
    enabled = options.enabled;
  }
  const { perHost, perClass } = options;
  const globalOpts: Partial<RateLimitOptions> = {};
  if (typeof options.maxRequestsPerInterval === "number") {
    globalOpts.maxRequestsPerInterval = options.maxRequestsPerInterval;
  }
  if (typeof options.intervalMs === "number") {
    globalOpts.intervalMs = options.intervalMs;
  }
  if (typeof options.maxConcurrency === "number") {
    globalOpts.maxConcurrency = options.maxConcurrency;
  }
  if (Object.keys(globalOpts).length) {
    limiter.configure(globalOpts);
  }
  if (perHost) {
    for (const host of Object.keys(perHost)) {
      const opts = perHost[host]!;
      const existing = hostLimiters.get(host);
      if (existing) {
        existing.configure(opts);
      } else {
        hostLimiters.set(
          host,
          new RateLimiter({
            maxRequestsPerInterval:
              opts.maxRequestsPerInterval ??
              defaultOptions.maxRequestsPerInterval,
            intervalMs: opts.intervalMs ?? defaultOptions.intervalMs,
            maxConcurrency:
              opts.maxConcurrency ?? defaultOptions.maxConcurrency,
          })
        );
      }
    }
  }
  if (perClass) {
    for (const klass of Object.keys(perClass)) {
      const opts = perClass[klass]!;
      const existing = classLimiters.get(klass);
      if (existing) {
        existing.configure(opts);
      } else {
        classLimiters.set(
          klass,
          new RateLimiter({
            maxRequestsPerInterval:
              opts.maxRequestsPerInterval ??
              defaultOptions.maxRequestsPerInterval,
            intervalMs: opts.intervalMs ?? defaultOptions.intervalMs,
            maxConcurrency:
              opts.maxConcurrency ?? defaultOptions.maxConcurrency,
          })
        );
      }
    }
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function rateLimitedFetch(
  input: RequestInfo | URL,
  init?: RateLimitedRequestInit
): Promise<Response> {
  const timeoutMs = Math.max(0, init?.timeoutMs ?? 0);
  let controller: AbortController | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const hasSignal = !!init?.signal;
  if (timeoutMs > 0 && !hasSignal) {
    controller = new AbortController();
    timer = setTimeout(() => controller?.abort(), timeoutMs);
  }
  const effInit: RateLimitedRequestInit = {
    ...init,
    signal: hasSignal ? init?.signal : controller?.signal,
  };
  const {
    rateLimitClass: _klass,
    retry: _retry,
    timeoutMs: _timeoutMs,
    ...fetchInit
  } = effInit;

  // Default redirect to "follow" if not specified
  if (fetchInit.redirect === undefined) {
    fetchInit.redirect = "follow";
  }

  const klass = init?.rateLimitClass;
  const byClass = klass ? classLimiters.get(klass) : undefined;
  const byHost = getHostLimiter(getHost(input));
  const eff = enabled ? (byClass ?? byHost ?? limiter) : undefined;

  const maxRetries = Math.max(0, init?.retry?.maxRetries ?? 2);
  const baseDelayMs = Math.max(0, init?.retry?.baseDelayMs ?? 200);
  const retryOnStatuses = init?.retry?.retryOnStatuses ?? [429, 503];

  let attempt = 0;
  let lastError: unknown = null;
  let response: Response | null = null;

  while (attempt <= maxRetries) {
    try {
      if (eff) {
        response = await eff.schedule(() => fetch(input, fetchInit));
      } else {
        response = await fetch(input, fetchInit);
      }
      // If OK or not a retriable status, return immediately
      if (
        !response ||
        response.ok ||
        !retryOnStatuses.includes(response.status)
      ) {
        if (timer) clearTimeout(timer);
        return response as Response;
      }
    } catch (err) {
      lastError = err;
      // Network errors: continue to retry
    }

    // If we got here, we will retry if attempts remain
    attempt += 1;
    if (attempt > maxRetries) break;
    let delay =
      baseDelayMs * 2 ** (attempt - 1) + Math.floor(Math.random() * 100);
    const retryAfter = response?.headers?.get("retry-after");
    if (retryAfter) {
      const asNumber = Number(retryAfter);
      if (!Number.isNaN(asNumber) && asNumber >= 0) {
        delay = Math.max(delay, Math.floor(asNumber * 1000));
      } else {
        const parsed = Date.parse(retryAfter);
        if (!Number.isNaN(parsed)) {
          const until = parsed - Date.now();
          if (until > 0) delay = Math.max(delay, until);
        }
      }
    }
    await sleep(delay);
  }

  // If we have a response (non-ok retriable status) return it; otherwise throw last error
  if (timer) clearTimeout(timer);
  if (response) return response;
  throw lastError ?? new Error("rateLimitedFetch failed without response");
}

export function getRateLimitStatus() {
  return {
    enabled,
    options: { ...defaultOptions },
  };
}
