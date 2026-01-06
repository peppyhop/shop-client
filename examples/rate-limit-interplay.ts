import { Effect } from 'effect';
import { ShopClientTag, shopClientLayer } from '../src/effect';
import { configureRateLimit } from '../src/index';

// Demonstrates interplay of caching and rate limiting:
// - Configure modest rate limit to show retries/backoff
// - Use cache to avoid unnecessary calls
// - Force refetch to show dedupe + single network hit under contention

configureRateLimit({
  maxRequestsPerInterval: 5,
  intervalMs: 1_000,
  maxConcurrency: 5,
});

const program = Effect.gen(function* () {
  console.log('--- Rate Limit + Cache Interplay Demo ---');

  const shop = yield* ShopClientTag;

  // 1) First call fetches; subsequent calls use cache, avoiding rate limiter
  const info1 = yield* shop.getInfo();
  console.log('First fetch:', info1?.name);

  const info2 = yield* shop.getInfo();
  console.log('Cached fetch:', info2?.name);

  // 2) Concurrent forced calls dedupe into a single network request
  const [a, b, c] = yield* Effect.all([
    shop.getInfo({ force: true }),
    shop.getInfo({ force: true }),
    shop.getInfo({ force: true }),
  ]);

  console.log('Concurrent forced result A:', a?.name);
  console.log('Concurrent forced result B:', b?.name);
  console.log('Concurrent forced result C:', c?.name);

  // 3) After force refresh, subsequent calls are cached again
  const info3 = yield* shop.getInfo();
  console.log('Post-refresh cached fetch:', info3?.name);
});

Effect.runPromise(
  program.pipe(
    Effect.provide(
      shopClientLayer('https://anuki.in', {
        cacheTTL: 30_000,
      })
    )
  )
).catch((err) => {
  console.error('Rate limit interplay demo failed:', err);
});
