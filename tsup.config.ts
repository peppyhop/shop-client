import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/products.ts",
    "src/collections.ts",
    "src/checkout.ts",
    "src/store.ts",
    "src/utils/rate-limit.ts",
    "src/utils/func.ts",
    "src/utils/detect-country.ts",
    "src/ai/enrich.ts",
  ],
  outDir: "dist",
  format: ["esm"],
  dts: true,
  splitting: true,
  clean: true,
  sourcemap: false,
  minify: false,
});
