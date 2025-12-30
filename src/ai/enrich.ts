import TurndownService from "turndown";
import type {
  OpenRouterConfig,
  ProductClassification,
  SEOContent,
  ShopifySingleProduct,
  SystemUserPrompt,
} from "../types";
import { rateLimitedFetch } from "../utils/rate-limit";

const DEFAULT_OPENROUTER_MODEL = "openai/gpt-4o-mini";
const DEFAULT_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_OPENROUTER_APP_TITLE = "Shop Client";
const SHOPIFY_PRODUCT_IMAGE_PATTERNS = [
  "cdn.shopify.com",
  "/products/",
  "%2Fproducts%2F",
  "_large",
  "_grande",
  "_1024x1024",
  "_2048x",
];
const TURNDOWN_REMOVE_TAGS = ["script", "style", "nav", "footer"];
const TURNDOWN_REMOVE_CLASSNAMES = [
  "product-form",
  "shopify-payment-button",
  "shopify-payment-buttons",
  "product__actions",
  "product__media-wrapper",
  "loox-rating",
  "jdgm-widget",
  "stamped-reviews",
  "quantity-selector",
  "product-atc-wrapper",
];
const TURNDOWN_REMOVE_NODE_NAMES = ["button", "input", "select", "label"];

let cachedGfmPlugin: any | undefined;
let gfmPluginPromise: Promise<any> | undefined;
let cachedTurndownPlain: TurndownService | undefined;
let cachedTurndownGfm: TurndownService | undefined;

async function loadGfmPlugin(): Promise<any> {
  if (cachedGfmPlugin) return cachedGfmPlugin;
  if (gfmPluginPromise) return gfmPluginPromise;
  gfmPluginPromise = import("turndown-plugin-gfm")
    .then((mod: any) => {
      const resolved = mod?.gfm ?? mod?.default?.gfm ?? mod?.default ?? mod;
      cachedGfmPlugin = resolved;
      return resolved;
    })
    .finally(() => {
      gfmPluginPromise = undefined;
    });
  return gfmPluginPromise;
}

function configureTurndown(td: TurndownService) {
  for (const tag of TURNDOWN_REMOVE_TAGS) {
    td.remove((node) => node.nodeName?.toLowerCase() === tag);
  }

  const removeByClass = (className: string) =>
    td.remove((node: any) => {
      const cls =
        typeof node.getAttribute === "function"
          ? node.getAttribute("class") || ""
          : "";
      return (cls as string).split(/\s+/).includes(className);
    });
  for (const className of TURNDOWN_REMOVE_CLASSNAMES) {
    removeByClass(className);
  }

  for (const nodeName of TURNDOWN_REMOVE_NODE_NAMES) {
    td.remove((node) => node.nodeName?.toLowerCase() === nodeName);
  }
}

async function getTurndownService(useGfm: boolean): Promise<TurndownService> {
  if (useGfm && cachedTurndownGfm) return cachedTurndownGfm;
  if (!useGfm && cachedTurndownPlain) return cachedTurndownPlain;

  const td = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    emDelimiter: "*",
    strongDelimiter: "**",
    linkStyle: "inlined",
  });

  if (useGfm) {
    const gfm = await loadGfmPlugin();
    if (gfm) td.use(gfm);
  }

  configureTurndown(td);

  if (useGfm) cachedTurndownGfm = td;
  else cachedTurndownPlain = td;
  return td;
}

export function buildEnrichPrompt(args: {
  bodyInput: string;
  pageInput: string;
  inputType: "markdown" | "html";
  outputFormat: "markdown" | "json";
}): SystemUserPrompt {
  const bodyLabel = args.inputType === "html" ? "BODY HTML" : "BODY MARKDOWN";
  const pageLabel = args.inputType === "html" ? "PAGE HTML" : "PAGE MARKDOWN";

  if (args.outputFormat === "json") {
    return {
      system:
        "You are a product-data extraction engine. Combine two sources (Shopify body_html and product page) into a single structured summary. Return ONLY valid JSON (no markdown, no code fences, no extra text).",
      user: `Inputs:
1) ${bodyLabel}: ${args.inputType === "html" ? "Raw Shopify product body_html" : "Cleaned version of Shopify product body_html"}
2) ${pageLabel}: ${args.inputType === "html" ? "Raw product page HTML (main section)" : "Extracted product page HTML converted to markdown"}

Return ONLY valid JSON with this shape (include ALL keys; use null/[] when unknown):
{
  "title": null | string,
  "description": null | string,
  "highlights": string[] | [],
  "features": string[] | [],
  "specs": Record<string, string> | {},
  "materials": string[] | [],
  "care": string[] | [],
  "fit": null | string,
  "sizeGuide": null | string,
  "shipping": null | string,
  "warranty": null | string,
  "images": null | string[],
  "returnPolicy": null | string
}

Rules:
- Use BOTH sources and deduplicate overlapping content.
- Prefer the more specific / more recent details when sources differ; never invent facts.
- Do not invent facts; if a field is unavailable, use null or []
- Prefer concise, factual statements (avoid marketing fluff).
- Keep units and measurements as written (e.g., inches/cm); do not convert unless explicitly provided.
- Do NOT include product gallery/hero images in "images"; include only documentation images like size charts or measurement guides. If none, set "images": null.
- "specs" is a flat key/value map for concrete attributes (e.g., "Made in": "Portugal", "Weight": "320g"). Use {} if none.

${bodyLabel}:
${args.bodyInput}

${pageLabel}:
${args.pageInput}`,
    };
  }

  return {
    system:
      "You merge Shopify product content into a single buyer-ready markdown description. Output ONLY markdown (no code fences, no commentary).",
    user: `Inputs:
1) ${bodyLabel}: ${args.inputType === "html" ? "Raw Shopify product body_html" : "Cleaned version of Shopify product body_html"}
2) ${pageLabel}: ${args.inputType === "html" ? "Raw product page HTML (main section)" : "Extracted product page HTML converted to markdown"}

Tasks:
- Merge both sources into a single clean markdown document and deduplicate overlap.
- Keep only buyer-useful info (concrete details); remove theme/UI junk, menus, buttons, upsells, reviews widgets, legal boilerplate.
- Do NOT include product gallery/hero images. If documentation images exist (size chart, measurement guide, care diagram), include them.
- Do NOT list interactive option selectors (e.g., "Choose Size" buttons), but DO keep meaningful option information (e.g., sizing notes, fit guidance, measurement tables, what's included).
- If sources disagree, prefer the more specific detail; never invent facts.
- Do not write "information not available" or similar.
- Use this section order when content exists (omit empty sections):
  - ## Overview (2–4 sentences)
  - ## Key Features (bullets)
  - ## Materials
  - ## Care
  - ## Fit & Sizing
  - ## Size Guide (include documentation images + key measurements)
  - ## Shipping & Returns

${bodyLabel}:
${args.bodyInput}

${pageLabel}:
${args.pageInput}`,
  };
}

export function buildClassifyPrompt(productContent: string): SystemUserPrompt {
  return {
    system:
      "You classify products using a three-tier hierarchy. Return only valid JSON without markdown or code fences.",
    user: `Classify the following product using a three-tiered hierarchy:

Product Content:
${productContent}

Classification Rules:
1. First determine the vertical (main product category)
2. Then determine the category (specific type within that vertical)
3. Finally determine the subCategory (sub-type within that category)

Vertical must be one of: clothing, beauty, accessories, home-decor, food-and-beverages
Audience must be one of: adult_male, adult_female, kid_male, kid_female, generic

Hierarchy Examples:
- Clothing → tops → t-shirts
- Clothing → footwear → sneakers
- Beauty → skincare → moisturizers
- Accessories → bags → backpacks
- Home-decor → furniture → chairs
- Food-and-beverages → snacks → chips

IMPORTANT CONSTRAINTS:
- Category must be relevant to the chosen vertical
- subCategory must be relevant to both vertical and category
- subCategory must be a single word or hyphenated words (no spaces)
- subCategory should NOT be material (e.g., "cotton", "leather") or color (e.g., "red", "blue")
- Focus on product type/function, not attributes

If you're not confident about category or sub-category, you can leave them optional.

Return ONLY valid JSON (no markdown, no code fences) with keys:
{
  "audience": "adult_male" | "adult_female" | "kid_male" | "kid_female" | "generic",
  "vertical": "clothing" | "beauty" | "accessories" | "home-decor" | "food-and-beverages",
  "category": null | string,
  "subCategory": null | string
}`,
  };
}

export async function buildEnrichPromptForProduct(
  domain: string,
  handle: string,
  options?: {
    useGfm?: boolean;
    inputType?: "markdown" | "html";
    outputFormat?: "markdown" | "json";
  }
): Promise<SystemUserPrompt> {
  const [ajaxProduct, pageHtml] = await Promise.all([
    fetchAjaxProduct(domain, handle),
    fetchProductPage(domain, handle),
  ]);
  const bodyHtml = ajaxProduct.description || "";
  const extractedHtml = extractMainSection(pageHtml);

  const inputType = options?.inputType ?? "markdown";
  const outputFormat = options?.outputFormat ?? "markdown";
  const bodyInput =
    inputType === "html"
      ? bodyHtml
      : await htmlToMarkdown(bodyHtml, { useGfm: options?.useGfm });
  const pageInput =
    inputType === "html"
      ? extractedHtml || pageHtml
      : await htmlToMarkdown(extractedHtml || pageHtml, {
          useGfm: options?.useGfm,
        });

  return buildEnrichPrompt({ bodyInput, pageInput, inputType, outputFormat });
}

export async function buildClassifyPromptForProduct(
  domain: string,
  handle: string,
  options?: { useGfm?: boolean; inputType?: "markdown" | "html" }
): Promise<SystemUserPrompt> {
  const [ajaxProduct, pageHtml] = await Promise.all([
    fetchAjaxProduct(domain, handle),
    fetchProductPage(domain, handle),
  ]);
  const bodyHtml = ajaxProduct.description || "";
  const extractedHtml = extractMainSection(pageHtml);

  const inputType = options?.inputType ?? "markdown";
  const bodyInput =
    inputType === "html"
      ? bodyHtml
      : await htmlToMarkdown(bodyHtml, { useGfm: options?.useGfm });
  const pageInput =
    inputType === "html"
      ? extractedHtml || pageHtml
      : await htmlToMarkdown(extractedHtml || pageHtml, {
          useGfm: options?.useGfm,
        });

  const header = [
    `Title: ${String(ajaxProduct.title || "")}`.trim(),
    ajaxProduct.vendor ? `Vendor: ${String(ajaxProduct.vendor)}` : null,
    Array.isArray(ajaxProduct.tags) && ajaxProduct.tags.length
      ? `Tags: ${ajaxProduct.tags.join(", ")}`
      : null,
  ]
    .filter((s): s is string => Boolean(s && s.trim()))
    .join("\n");

  const productContent = [
    header,
    `Body:\n${bodyInput}`.trim(),
    `Page:\n${pageInput}`.trim(),
  ]
    .filter((s) => Boolean(s && s.trim()))
    .join("\n\n");

  return buildClassifyPrompt(productContent);
}

function normalizeDomainToBase(domain: string): string {
  // Accept both bare domains (example.com) and full URLs (https://example.com)
  if (domain.startsWith("http://") || domain.startsWith("https://")) {
    try {
      const u = new URL(domain);
      return `${u.protocol}//${u.hostname}`;
    } catch {
      // Fallback to https
      return domain;
    }
  }
  return `https://${domain}`;
}

export interface EnrichedProductResult {
  bodyHtml: string;
  pageHtml: string;
  extractedMainHtml: string;
  mergedMarkdown: string;
}

/**
 * Fetch Shopify Product AJAX API
 * /products/{handle}.js
 */
export async function fetchAjaxProduct(
  domain: string,
  handle: string
): Promise<ShopifySingleProduct> {
  const base = normalizeDomainToBase(domain);
  const url = `${base}/products/${handle}.js`;
  const res = await rateLimitedFetch(url, { rateLimitClass: "products:ajax" });
  if (!res.ok) throw new Error(`Failed to fetch AJAX product: ${url}`);
  const data: ShopifySingleProduct = await res.json();
  return data;
}

/**
 * Fetch full product page HTML
 */
export async function fetchProductPage(
  domain: string,
  handle: string
): Promise<string> {
  const base = normalizeDomainToBase(domain);
  const url = `${base}/products/${handle}`;
  const res = await rateLimitedFetch(url, { rateLimitClass: "products:html" });
  if (!res.ok) throw new Error(`Failed to fetch product page: ${url}`);
  return res.text();
}

/**
 * Extract the main Shopify product section WITHOUT cheerio
 * Uses regex + indexing (fast & reliable)
 */
export function extractMainSection(html: string): string | null {
  const startMatch = html.match(
    /<section[^>]*id="shopify-section-template--.*?__main"[^>]*>/
  );

  if (!startMatch) return null;

  const startIndex = html.indexOf(startMatch[0]);
  if (startIndex === -1) return null;

  const endIndex = html.indexOf("</section>", startIndex);
  if (endIndex === -1) return null;

  return html.substring(startIndex, endIndex + "</section>".length);
}

/**
 * Convert HTML → Clean Markdown using Turndown
 * Includes Shopify cleanup rules + GFM support
 */
export async function htmlToMarkdown(
  html: string | null,
  options?: { useGfm?: boolean }
): Promise<string> {
  if (!html) return "";
  const useGfm = options?.useGfm ?? true;
  const td = await getTurndownService(useGfm);
  return td.turndown(html);
}

/**
 * Merge the two markdown sources using OpenAI GPT
 */
export async function mergeWithLLM(
  bodyInput: string,
  pageInput: string,
  options?: {
    apiKey?: string;
    inputType?: "markdown" | "html";
    model?: string;
    outputFormat?: "markdown" | "json";
    openRouter?: OpenRouterConfig;
  }
): Promise<string> {
  const inputType = options?.inputType ?? "markdown";
  const outputFormat = options?.outputFormat ?? "markdown";
  const prompts = buildEnrichPrompt({
    bodyInput,
    pageInput,
    inputType,
    outputFormat,
  });
  const openRouter = options?.openRouter;
  const offline = openRouter?.offline ?? false;
  const apiKey = options?.apiKey ?? openRouter?.apiKey;
  if (!offline && !apiKey) {
    throw new Error(
      "Missing OpenRouter API key. Pass apiKey or set ShopClient options.openRouter.apiKey."
    );
  }
  const model = options?.model ?? openRouter?.model ?? DEFAULT_OPENROUTER_MODEL;

  // OpenRouter path only
  const result = await callOpenRouter({
    model,
    messages: [
      { role: "system", content: prompts.system },
      { role: "user", content: prompts.user },
    ],
    apiKey,
    openRouter,
  });
  if (options?.outputFormat === "json") {
    const cleaned = result.replace(/```json|```/g, "").trim();
    // Validate shape early to fail fast on malformed JSON responses
    const obj = safeParseJson(cleaned);
    if (!obj.ok) {
      throw new Error(`LLM returned invalid JSON: ${obj.error}`);
    }
    const schema = validateStructuredJson(obj.value);
    if (!schema.ok) {
      throw new Error(`LLM JSON schema invalid: ${schema.error}`);
    }

    // Sanitize any returned image URLs to avoid product gallery/hero images
    const value = obj.value as any;
    if (Array.isArray(value.images)) {
      const filtered = value.images.filter((url: string) => {
        if (typeof url !== "string") return false;
        const u = url.toLowerCase();
        const looksLikeProductImage = SHOPIFY_PRODUCT_IMAGE_PATTERNS.some((p) =>
          u.includes(p)
        );
        return !looksLikeProductImage;
      });
      value.images = filtered.length > 0 ? filtered : null;
    }
    return JSON.stringify(value);
  }
  return result;
}

// Runtime JSON parse helper with descriptive errors
function safeParseJson(
  input: string
): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    const v = JSON.parse(input);
    return { ok: true, value: v };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Failed to parse JSON" };
  }
}

// Validate relaxed schema of structured product JSON from LLM
function validateStructuredJson(
  obj: unknown
): { ok: true } | { ok: false; error: string } {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    return { ok: false, error: "Top-level must be a JSON object" };
  }
  const o = obj as any;

  // Optional fields must match expected types when present
  if ("title" in o && !(o.title === null || typeof o.title === "string")) {
    return { ok: false, error: "title must be null or string" };
  }
  if (
    "description" in o &&
    !(o.description === null || typeof o.description === "string")
  ) {
    return { ok: false, error: "description must be null or string" };
  }
  if ("fit" in o && !(o.fit === null || typeof o.fit === "string")) {
    return { ok: false, error: "fit must be null or string" };
  }
  if (
    "returnPolicy" in o &&
    !(o.returnPolicy === null || typeof o.returnPolicy === "string")
  ) {
    return { ok: false, error: "returnPolicy must be null or string" };
  }

  const validateStringArray = (
    arr: unknown,
    field: string
  ): { ok: true } | { ok: false; error: string } => {
    if (!Array.isArray(arr))
      return { ok: false, error: `${field} must be an array` };
    for (const item of arr) {
      if (typeof item !== "string")
        return { ok: false, error: `${field} items must be strings` };
    }
    return { ok: true };
  };

  if ("materials" in o) {
    const res = validateStringArray(o.materials, "materials");
    if (!res.ok) return res;
  }
  if ("care" in o) {
    const res = validateStringArray(o.care, "care");
    if (!res.ok) return res;
  }

  if ("images" in o) {
    if (!(o.images === null || Array.isArray(o.images))) {
      return { ok: false, error: "images must be null or an array" };
    }
    if (Array.isArray(o.images)) {
      const res = validateStringArray(o.images, "images");
      if (!res.ok) return res;
    }
  }

  return { ok: true };
}

// OpenRouter handler (OpenAI-compatible payload, single key to access many models)
async function callOpenRouter(args: {
  model: string;
  messages: Array<{ role: "system" | "user"; content: string }>;
  apiKey?: string;
  openRouter?: OpenRouterConfig;
}): Promise<string> {
  const openRouter = args.openRouter;
  if (openRouter?.offline) {
    return mockOpenRouterResponse(
      args.messages.map((m) => m.content).join("\n")
    );
  }

  const apiKey = args.apiKey ?? openRouter?.apiKey;
  if (!apiKey) {
    throw new Error(
      "Missing OpenRouter API key. Pass apiKey or set ShopClient options.openRouter.apiKey."
    );
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  const referer = openRouter?.siteUrl;
  const title = openRouter?.appTitle ?? DEFAULT_OPENROUTER_APP_TITLE;
  if (referer) headers["HTTP-Referer"] = referer;
  if (title) headers["X-Title"] = title;

  const buildPayload = (m: string) => ({
    model: m,
    messages: args.messages,
    temperature: 0.2,
  });

  const base = (openRouter?.baseUrl ?? DEFAULT_OPENROUTER_BASE_URL).replace(
    /\/$/,
    ""
  );
  const endpoints = [`${base}/chat/completions`];

  const fallbackModels = (openRouter?.fallbackModels ?? []).filter(
    (s): s is string => typeof s === "string" && Boolean(s.trim())
  );
  const defaultModel = openRouter?.model ?? DEFAULT_OPENROUTER_MODEL;
  const modelsToTry = Array.from(
    new Set([args.model, ...fallbackModels, defaultModel])
  ).filter(Boolean);

  let lastErrorText = "";
  for (const m of modelsToTry) {
    for (const url of endpoints) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        const response = await rateLimitedFetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(buildPayload(m)),
          signal: controller.signal,
          rateLimitClass: "ai:openrouter",
        });
        clearTimeout(timeout);
        if (!response.ok) {
          const text = await response.text();
          // If server error, try next model; otherwise capture and continue to next endpoint/model
          lastErrorText = text || `${url}: HTTP ${response.status}`;
          // Small delay before trying next
          await new Promise((r) => setTimeout(r, 300));
          continue;
        }
        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content;
        if (typeof content === "string") return content;
        // If content missing, still capture and try fallback
        lastErrorText = JSON.stringify(data);
        await new Promise((r) => setTimeout(r, 200));
      } catch (err: any) {
        lastErrorText = `${url}: ${err?.message || String(err)}`;
        await new Promise((r) => setTimeout(r, 200));
      }
    }
  }
  throw new Error(`OpenRouter request failed: ${lastErrorText}`);
}

// Generate a deterministic offline response tailored to the prompt.
function mockOpenRouterResponse(prompt: string): string {
  const p = prompt.toLowerCase();
  // Classification prompt contains "keys:" section
  if (p.includes("return only valid json") && p.includes('"audience":')) {
    return JSON.stringify({
      audience: "generic",
      vertical: "clothing",
      category: null,
      subCategory: null,
    });
  }

  // Structured merge prompt contains "with this shape:" section
  if (p.includes("return only valid json") && p.includes('"materials":')) {
    return JSON.stringify({
      title: null,
      description: null,
      materials: [],
      care: [],
      fit: null,
      images: null,
      returnPolicy: null,
    });
  }

  // Markdown merge fallback
  return [
    "## Description",
    "Offline merge of product body and page.",
    "",
    "## Materials",
    "- Not available",
  ].join("\n");
}

/**
 * MAIN WORKFLOW
 */
export async function enrichProduct(
  domain: string,
  handle: string,
  options?: {
    apiKey?: string;
    useGfm?: boolean;
    inputType?: "markdown" | "html";
    model?: string;
    outputFormat?: "markdown" | "json";
    openRouter?: OpenRouterConfig;
  }
): Promise<EnrichedProductResult> {
  // STEP 1: Fetch Shopify single product (AJAX) and use its description
  const [ajaxProduct, pageHtml] = await Promise.all([
    fetchAjaxProduct(domain, handle),
    fetchProductPage(domain, handle),
  ]);
  const bodyHtml = ajaxProduct.description || "";

  // STEP 3: Extract main section
  const extractedHtml = extractMainSection(pageHtml);

  // STEP 4: Prepare inputs based on desired input type
  const inputType = options?.inputType ?? "markdown";
  const bodyInput =
    inputType === "html"
      ? bodyHtml
      : await htmlToMarkdown(bodyHtml, { useGfm: options?.useGfm });
  const pageInput =
    inputType === "html"
      ? extractedHtml || pageHtml
      : await htmlToMarkdown(extractedHtml || pageHtml, {
          useGfm: options?.useGfm,
        });

  // STEP 5: Merge using LLM
  const mergedMarkdown = await mergeWithLLM(bodyInput, pageInput, {
    apiKey: options?.apiKey,
    inputType,
    model: options?.model,
    outputFormat: options?.outputFormat,
    openRouter: options?.openRouter,
  });

  // If JSON output requested, further sanitize images using Shopify REST data
  if (options?.outputFormat === "json") {
    try {
      const obj = JSON.parse(mergedMarkdown);
      if (obj && Array.isArray(obj.images)) {
        const productImageCandidates: string[] = [];
        // Collect featured_image (string URL)
        if (ajaxProduct.featured_image) {
          productImageCandidates.push(String(ajaxProduct.featured_image));
        }
        // Collect images (string[])
        if (Array.isArray(ajaxProduct.images)) {
          for (const img of ajaxProduct.images) {
            if (typeof img === "string" && img.length > 0) {
              productImageCandidates.push(img);
            }
          }
        }
        // Collect media[].src
        if (Array.isArray(ajaxProduct.media)) {
          for (const m of ajaxProduct.media) {
            if (m?.src) productImageCandidates.push(String(m.src));
          }
        }
        // Collect variants[].featured_image?.src
        if (Array.isArray(ajaxProduct.variants)) {
          for (const v of ajaxProduct.variants) {
            const fi = v?.featured_image;
            if (fi?.src) productImageCandidates.push(String(fi.src));
          }
        }

        const productSet = new Set(
          productImageCandidates.map((u) => String(u).toLowerCase())
        );
        const filtered = obj.images.filter((url: string) => {
          if (typeof url !== "string") return false;
          const u = url.toLowerCase();
          if (productSet.has(u)) return false;
          // Also exclude common Shopify product image patterns
          const looksLikeProductImage = SHOPIFY_PRODUCT_IMAGE_PATTERNS.some(
            (p) => u.includes(p)
          );
          return !looksLikeProductImage;
        });
        obj.images = filtered.length > 0 ? filtered : null;
        const sanitized = JSON.stringify(obj);
        return {
          bodyHtml,
          pageHtml,
          extractedMainHtml: extractedHtml || "",
          mergedMarkdown: sanitized,
        };
      }
    } catch {
      // fallthrough to default return
    }
  }

  return {
    bodyHtml,
    pageHtml,
    extractedMainHtml: extractedHtml || "",
    mergedMarkdown,
  };
}

/**
 * Classify product content into a three-tier hierarchy using LLM.
 * Returns strictly validated JSON with audience, vertical, and optional category/subCategory.
 */
export async function classifyProduct(
  productContent: string,
  options?: { apiKey?: string; model?: string; openRouter?: OpenRouterConfig }
): Promise<ProductClassification> {
  const openRouter = options?.openRouter;
  const offline = openRouter?.offline ?? false;
  const apiKey = options?.apiKey ?? openRouter?.apiKey;
  if (!offline && !apiKey) {
    throw new Error(
      "Missing OpenRouter API key. Pass apiKey or set ShopClient options.openRouter.apiKey."
    );
  }
  const model = options?.model ?? openRouter?.model ?? DEFAULT_OPENROUTER_MODEL;

  const prompts = buildClassifyPrompt(productContent);
  const raw = await callOpenRouter({
    model,
    messages: [
      { role: "system", content: prompts.system },
      { role: "user", content: prompts.user },
    ],
    apiKey,
    openRouter,
  });
  const cleaned = raw.replace(/```json|```/g, "").trim();

  // Parse and validate
  const parsed = safeParseJson(cleaned);
  if (!parsed.ok) {
    throw new Error(`LLM returned invalid JSON: ${parsed.error}`);
  }
  const validated = validateClassification(parsed.value);
  if (!validated.ok) {
    throw new Error(`LLM JSON schema invalid: ${validated.error}`);
  }
  return validated.value as ProductClassification;
}

// Validate product classification schema
function validateClassification(
  obj: unknown
): { ok: true; value: ProductClassification } | { ok: false; error: string } {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    return { ok: false, error: "Top-level must be a JSON object" };
  }
  const o = obj as any;

  const audienceValues = [
    "adult_male",
    "adult_female",
    "kid_male",
    "kid_female",
    "generic",
  ] as const;
  if (typeof o.audience !== "string" || !audienceValues.includes(o.audience)) {
    return {
      ok: false,
      error:
        "audience must be one of: adult_male, adult_female, kid_male, kid_female, generic",
    };
  }

  const verticalValues = [
    "clothing",
    "beauty",
    "accessories",
    "home-decor",
    "food-and-beverages",
  ] as const;
  if (typeof o.vertical !== "string" || !verticalValues.includes(o.vertical)) {
    return {
      ok: false,
      error:
        "vertical must be one of: clothing, beauty, accessories, home-decor, food-and-beverages",
    };
  }

  // Optional fields
  if (
    "category" in o &&
    !(o.category === null || typeof o.category === "string")
  ) {
    return { ok: false, error: "category must be null or string" };
  }
  if (
    "subCategory" in o &&
    !(o.subCategory === null || typeof o.subCategory === "string")
  ) {
    return { ok: false, error: "subCategory must be null or string" };
  }

  // Enforce subCategory format when provided: single word or hyphenated (no spaces)
  if (typeof o.subCategory === "string") {
    const sc = o.subCategory.trim();
    if (!/^[A-Za-z0-9-]+$/.test(sc)) {
      return {
        ok: false,
        error: "subCategory must be single word or hyphenated, no spaces",
      };
    }
  }

  return {
    ok: true,
    value: {
      audience: o.audience,
      vertical: o.vertical,
      category:
        typeof o.category === "string" ? o.category : (o.category ?? null),
      subCategory:
        typeof o.subCategory === "string"
          ? o.subCategory
          : (o.subCategory ?? null),
    },
  };
}

/**
 * Generate SEO and marketing content for a product. Returns strictly validated JSON.
 */
export async function generateSEOContent(
  product: {
    title: string;
    description?: string;
    vendor?: string;
    price?: number;
    tags?: string[];
  },
  options?: { apiKey?: string; model?: string; openRouter?: OpenRouterConfig }
): Promise<SEOContent> {
  const openRouter = options?.openRouter;
  const offline = openRouter?.offline ?? false;
  const apiKey = options?.apiKey ?? openRouter?.apiKey;
  const model = options?.model ?? openRouter?.model ?? DEFAULT_OPENROUTER_MODEL;

  if (offline) {
    // Offline deterministic mock
    const baseTags = Array.isArray(product.tags)
      ? product.tags.slice(0, 6)
      : [];
    const titlePart = product.title.trim().slice(0, 50);
    const vendorPart = (product.vendor || "").trim();
    const pricePart =
      typeof product.price === "number" ? `$${product.price}` : "";
    const metaTitle = vendorPart ? `${titlePart} | ${vendorPart}` : titlePart;
    const metaDescription =
      `Discover ${product.title}. ${pricePart ? `Priced at ${pricePart}. ` : ""}Crafted to delight customers with quality and style.`.slice(
        0,
        160
      );
    const shortDescription = `${product.title} — ${vendorPart || "Premium"} quality, designed to impress.`;
    const longDescription =
      product.description ||
      `Introducing ${product.title}, combining performance and style for everyday use.`;
    const marketingCopy = `Get ${product.title} today${pricePart ? ` for ${pricePart}` : ""}. Limited availability — don’t miss out!`;
    const res: SEOContent = {
      metaTitle,
      metaDescription,
      shortDescription,
      longDescription,
      tags: baseTags.length ? baseTags : ["new", "featured", "popular"],
      marketingCopy,
    };
    const validated = validateSEOContent(res);
    if (!validated.ok)
      throw new Error(`Offline SEO content invalid: ${validated.error}`);
    return validated.value;
  }

  const prompt = `Generate SEO-optimized content for this product:\n\nTitle: ${product.title}\nDescription: ${product.description || "N/A"}\nVendor: ${product.vendor || "N/A"}\nPrice: ${typeof product.price === "number" ? `$${product.price}` : "N/A"}\nTags: ${Array.isArray(product.tags) && product.tags.length ? product.tags.join(", ") : "N/A"}\n\nCreate compelling, SEO-friendly content that will help this product rank well and convert customers.\n\nReturn ONLY valid JSON (no markdown, no code fences) with keys: {\n  "metaTitle": string,\n  "metaDescription": string,\n  "shortDescription": string,\n  "longDescription": string,\n  "tags": string[],\n  "marketingCopy": string\n}`;

  if (!apiKey) {
    throw new Error(
      "Missing OpenRouter API key. Pass apiKey or set ShopClient options.openRouter.apiKey."
    );
  }

  const raw = await callOpenRouter({
    model,
    messages: [
      {
        role: "system",
        content:
          "You generate SEO content and return only valid JSON without markdown or code fences.",
      },
      { role: "user", content: prompt },
    ],
    apiKey,
    openRouter,
  });
  const cleaned = raw.replace(/```json|```/g, "").trim();
  const parsed = safeParseJson(cleaned);
  if (!parsed.ok) {
    throw new Error(`LLM returned invalid JSON: ${parsed.error}`);
  }
  const validated = validateSEOContent(parsed.value);
  if (!validated.ok) {
    throw new Error(`LLM JSON schema invalid: ${validated.error}`);
  }
  return validated.value as SEOContent;
}

function validateSEOContent(
  obj: unknown
): { ok: true; value: SEOContent } | { ok: false; error: string } {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    return { ok: false, error: "Top-level must be a JSON object" };
  }
  const o = obj as any;
  const requiredStrings = [
    "metaTitle",
    "metaDescription",
    "shortDescription",
    "longDescription",
    "marketingCopy",
  ];
  for (const key of requiredStrings) {
    if (typeof o[key] !== "string" || !o[key].trim()) {
      return { ok: false, error: `${key} must be a non-empty string` };
    }
  }
  if (!Array.isArray(o.tags)) {
    return { ok: false, error: "tags must be an array" };
  }
  for (const t of o.tags) {
    if (typeof t !== "string")
      return { ok: false, error: "tags items must be strings" };
  }
  // Light heuristic: metaTitle ~50-80 chars, metaDescription ~80-180 chars (do not hard-fail)
  return {
    ok: true,
    value: {
      metaTitle: String(o.metaTitle),
      metaDescription: String(o.metaDescription),
      shortDescription: String(o.shortDescription),
      longDescription: String(o.longDescription),
      tags: o.tags as string[],
      marketingCopy: String(o.marketingCopy),
    },
  };
}

/**
 * Determine store type (primary vertical and audience) from store information.
 * Accepts flexible input for showcase products/collections (titles or handles) and returns
 * strictly validated `vertical` and `audience` values.
 */
export async function determineStoreType(
  storeInfo: {
    title: string;
    description?: string | null;
    showcase: {
      products:
        | Array<{ title: string; productType?: string | null }>
        | string[];
      collections: Array<{ title: string }> | string[];
    };
  },
  options?: { apiKey?: string; model?: string; openRouter?: OpenRouterConfig }
): Promise<
  Partial<
    Record<
      ProductClassification["audience"],
      Partial<Record<ProductClassification["vertical"], string[]>>
    >
  >
> {
  const openRouter = options?.openRouter;
  const offline = openRouter?.offline ?? false;
  const apiKey = options?.apiKey ?? openRouter?.apiKey;
  const model = options?.model ?? openRouter?.model ?? DEFAULT_OPENROUTER_MODEL;

  // Normalize showcase items to titles for readable prompt content
  const productLines = (
    Array.isArray(storeInfo.showcase.products)
      ? storeInfo.showcase.products.slice(0, 10).map((p: any) => {
          if (typeof p === "string") return `- ${p}`;
          const pt =
            typeof p?.productType === "string" && p.productType.trim()
              ? p.productType
              : "N/A";
          return `- ${String(p?.title || "N/A")}: ${pt}`;
        })
      : []
  ) as string[];
  const collectionLines = (
    Array.isArray(storeInfo.showcase.collections)
      ? storeInfo.showcase.collections.slice(0, 5).map((c: any) => {
          if (typeof c === "string") return `- ${c}`;
          return `- ${String(c?.title || "N/A")}`;
        })
      : []
  ) as string[];

  const storeContent = `Store Title: ${storeInfo.title}
Store Description: ${storeInfo.description ?? "N/A"}

Sample Products:\n${productLines.join("\n") || "- N/A"}

Sample Collections:\n${collectionLines.join("\n") || "- N/A"}`;
  const textNormalized =
    `${storeInfo.title} ${storeInfo.description ?? ""} ${productLines.join(" ")} ${collectionLines.join(" ")}`.toLowerCase();

  if (offline) {
    // Offline deterministic mock with light heuristics
    const text =
      `${storeInfo.title} ${storeInfo.description ?? ""} ${productLines.join(" ")} ${collectionLines.join(" ")}`.toLowerCase();
    const verticalKeywords: Record<string, RegExp> = {
      clothing:
        /(dress|shirt|pant|jean|hoodie|tee|t[- ]?shirt|sneaker|apparel|clothing)/,
      beauty: /(skincare|moisturizer|serum|beauty|cosmetic|makeup)/,
      accessories:
        /(bag|belt|watch|wallet|accessor(y|ies)|sunglasses|jewell?ery)/,
      "home-decor": /(sofa|chair|table|decor|home|candle|lamp|rug)/,
      "food-and-beverages":
        /(snack|food|beverage|coffee|tea|chocolate|gourmet)/,
    };
    // Use strict word-boundary matching to avoid false positives like "boyfriend" or "girlfriend"
    const audienceKeywords: Record<string, RegExp> = {
      kid: /(\bkid\b|\bchild\b|\bchildren\b|\btoddler\b|\bboy\b|\bgirl\b)/,
      kid_male: /\bboys\b|\bboy\b/,
      kid_female: /\bgirls\b|\bgirl\b/,
      adult_male: /\bmen\b|\bmale\b|\bman\b|\bmens\b/,
      adult_female: /\bwomen\b|\bfemale\b|\bwoman\b|\bwomens\b/,
    };
    const audiences: ProductClassification["audience"][] = [];
    if (audienceKeywords.kid?.test(text)) {
      if (audienceKeywords.kid_male?.test(text)) audiences.push("kid_male");
      if (audienceKeywords.kid_female?.test(text)) audiences.push("kid_female");
      if (
        !audienceKeywords.kid_male?.test(text) &&
        !audienceKeywords.kid_female?.test(text)
      )
        audiences.push("generic");
    } else {
      if (audienceKeywords.adult_male?.test(text)) audiences.push("adult_male");
      if (audienceKeywords.adult_female?.test(text))
        audiences.push("adult_female");
      if (audiences.length === 0) audiences.push("generic");
    }

    // Determine verticals present
    const verticals = Object.entries(verticalKeywords)
      .filter(([, rx]) => rx.test(text))
      .map(([k]) => k as ProductClassification["vertical"]);
    if (verticals.length === 0) verticals.push("accessories");

    // Derive categories from showcase product titles
    const allTitles = productLines.join(" ").toLowerCase();
    const categoryMap: Record<string, RegExp> = {
      shirts: /(shirt|t[- ]?shirt|tee)/,
      pants: /(pant|trouser|chino)/,
      shorts: /shorts?/,
      jeans: /jeans?/,
      dresses: /dress/,
      skincare: /(serum|moisturizer|skincare|cream)/,
      accessories: /(belt|watch|wallet|bag)/,
      footwear: /(sneaker|shoe|boot)/,
      decor: /(candle|lamp|rug|sofa|chair|table)/,
      beverages: /(coffee|tea|chocolate)/,
    };
    const categories = Object.entries(categoryMap)
      .filter(([, rx]) => rx.test(allTitles))
      .map(([name]) => name);
    const defaultCategories = categories.length ? categories : ["general"];

    const breakdown: Partial<
      Record<
        ProductClassification["audience"],
        Partial<Record<ProductClassification["vertical"], string[]>>
      >
    > = {};
    for (const aud of audiences) {
      breakdown[aud] = breakdown[aud] || {};
      for (const v of verticals) {
        breakdown[aud]![v] = Array.from(new Set(defaultCategories));
      }
    }
    // Apply pruning even in offline mode to drop un-signaled audiences/verticals
    return pruneBreakdownForSignals(breakdown, textNormalized);
  }

  const prompt = `Analyze this store and build a multi-audience breakdown of verticals and categories.
Store Information:
${storeContent}

Return ONLY valid JSON (no markdown, no code fences) using this shape:
{
  "adult_male": { "clothing": ["shirts", "pants"], "accessories": ["belts"] },
  "adult_female": { "beauty": ["skincare"], "clothing": ["dresses"] },
  "generic": { "clothing": ["t-shirts"] }
}

Rules:
- Keys MUST be audience: "adult_male" | "adult_female" | "kid_male" | "kid_female" | "generic".
- Nested keys MUST be vertical: "clothing" | "beauty" | "accessories" | "home-decor" | "food-and-beverages".
- Values MUST be non-empty arrays of category strings.
`;

  if (!apiKey) {
    throw new Error(
      "Missing OpenRouter API key. Pass apiKey or set ShopClient options.openRouter.apiKey."
    );
  }

  const raw = await callOpenRouter({
    model,
    messages: [
      {
        role: "system",
        content:
          "You analyze a Shopify store and return only valid JSON without markdown or code fences.",
      },
      { role: "user", content: prompt },
    ],
    apiKey,
    openRouter,
  });
  const cleaned = raw.replace(/```json|```/g, "").trim();
  const parsed = safeParseJson(cleaned);
  if (!parsed.ok) {
    throw new Error(`LLM returned invalid JSON: ${parsed.error}`);
  }
  const validated = validateStoreTypeBreakdown(parsed.value);
  if (!validated.ok) {
    throw new Error(`LLM JSON schema invalid: ${validated.error}`);
  }
  return pruneBreakdownForSignals(validated.value, textNormalized);
}

function validateStoreTypeBreakdown(obj: unknown):
  | {
      ok: true;
      value: Partial<
        Record<
          ProductClassification["audience"],
          Partial<Record<ProductClassification["vertical"], string[]>>
        >
      >;
    }
  | { ok: false; error: string } {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    return {
      ok: false,
      error: "Top-level must be an object keyed by audience",
    };
  }
  const audienceKeys = [
    "adult_male",
    "adult_female",
    "kid_male",
    "kid_female",
    "generic",
  ] as const;
  const verticalKeys = [
    "clothing",
    "beauty",
    "accessories",
    "home-decor",
    "food-and-beverages",
  ] as const;
  const o = obj as Record<string, unknown>;
  const out: Partial<
    Record<
      ProductClassification["audience"],
      Partial<Record<ProductClassification["vertical"], string[]>>
    >
  > = {};
  const keys = Object.keys(o);
  if (keys.length === 0) {
    return { ok: false, error: "At least one audience key is required" };
  }
  for (const aKey of keys) {
    if (!audienceKeys.includes(aKey as any)) {
      return { ok: false, error: `Invalid audience key: ${aKey}` };
    }
    const vObj = o[aKey];
    if (!vObj || typeof vObj !== "object" || Array.isArray(vObj)) {
      return {
        ok: false,
        error: `Audience ${aKey} must map to an object of verticals`,
      };
    }
    const vOut: Partial<Record<ProductClassification["vertical"], string[]>> =
      {};
    for (const vKey of Object.keys(vObj as Record<string, unknown>)) {
      if (!verticalKeys.includes(vKey as any)) {
        return {
          ok: false,
          error: `Invalid vertical key ${vKey} for audience ${aKey}`,
        };
      }
      const cats = (vObj as any)[vKey];
      if (
        !Array.isArray(cats) ||
        cats.length === 0 ||
        !cats.every((c) => typeof c === "string" && c.trim())
      ) {
        return {
          ok: false,
          error: `Vertical ${vKey} for audience ${aKey} must be a non-empty array of strings`,
        };
      }
      vOut[vKey as ProductClassification["vertical"]] = cats.map((c: string) =>
        c.trim()
      );
    }
    out[aKey as ProductClassification["audience"]] = vOut;
  }
  return { ok: true, value: out };
}

export function pruneBreakdownForSignals(
  breakdown: Partial<
    Record<
      ProductClassification["audience"],
      Partial<Record<ProductClassification["vertical"], string[]>>
    >
  >,
  text: string
): Partial<
  Record<
    ProductClassification["audience"],
    Partial<Record<ProductClassification["vertical"], string[]>>
  >
> {
  const audienceKeywords: Record<string, RegExp> = {
    kid: /(\bkid\b|\bchild\b|\bchildren\b|\btoddler\b|\bboy\b|\bgirl\b)/,
    kid_male: /\bboys\b|\bboy\b/,
    kid_female: /\bgirls\b|\bgirl\b/,
    adult_male: /\bmen\b|\bmale\b|\bman\b|\bmens\b/,
    adult_female: /\bwomen\b|\bfemale\b|\bwoman\b|\bwomens\b/,
  };
  const verticalKeywords: Record<string, RegExp> = {
    clothing:
      /(dress|shirt|pant|jean|hoodie|tee|t[- ]?shirt|sneaker|apparel|clothing)/,
    beauty: /(skincare|moisturizer|serum|beauty|cosmetic|makeup)/,
    accessories:
      /(bag|belt|watch|wallet|accessor(y|ies)|sunglasses|jewell?ery)/,
    // Tighten home-decor detection to avoid matching generic "Home" nav labels
    // and other unrelated uses. Require specific furniture/decor terms or phrases.
    "home-decor":
      /(sofa|chair|table|candle|lamp|rug|furniture|home[- ]?decor|homeware|housewares|living\s?room|dining\s?table|bed(?:room)?|wall\s?(art|mirror|clock))/,
    "food-and-beverages": /(snack|food|beverage|coffee|tea|chocolate|gourmet)/,
  };

  const signaledAudiences = new Set<ProductClassification["audience"]>();
  if (audienceKeywords.kid?.test(text)) {
    if (audienceKeywords.kid_male?.test(text))
      signaledAudiences.add("kid_male");
    if (audienceKeywords.kid_female?.test(text))
      signaledAudiences.add("kid_female");
    if (
      !audienceKeywords.kid_male?.test(text) &&
      !audienceKeywords.kid_female?.test(text)
    )
      signaledAudiences.add("generic");
  } else {
    if (audienceKeywords.adult_male?.test(text))
      signaledAudiences.add("adult_male");
    if (audienceKeywords.adult_female?.test(text))
      signaledAudiences.add("adult_female");
    if (signaledAudiences.size === 0) signaledAudiences.add("generic");
  }

  const signaledVerticals = new Set<ProductClassification["vertical"]>(
    Object.entries(verticalKeywords)
      .filter(([, rx]) => rx.test(text))
      .map(([k]) => k as ProductClassification["vertical"]) || []
  );
  if (signaledVerticals.size === 0) signaledVerticals.add("accessories");

  const pruned: Partial<
    Record<
      ProductClassification["audience"],
      Partial<Record<ProductClassification["vertical"], string[]>>
    >
  > = {};
  for (const [audience, verticals] of Object.entries(breakdown)) {
    const a = audience as ProductClassification["audience"];
    if (!signaledAudiences.has(a)) continue;
    const vOut: Partial<Record<ProductClassification["vertical"], string[]>> =
      {};
    for (const [vertical, categories] of Object.entries(verticals || {})) {
      const v = vertical as ProductClassification["vertical"];
      if (!signaledVerticals.has(v)) continue;
      vOut[v] = categories as string[];
    }
    if (Object.keys(vOut).length > 0) {
      pruned[a] = vOut;
    }
  }

  // If pruning removes all audiences, fall back to generic with any verticals present in original or signaled
  if (Object.keys(pruned).length === 0) {
    const vOut: Partial<Record<ProductClassification["vertical"], string[]>> =
      {};
    for (const v of Array.from(signaledVerticals)) {
      vOut[v] = ["general"];
    }
    pruned.generic = vOut;
  }

  // Remove generic when adult audiences exist and have verticals
  const adultHasData =
    (pruned.adult_male && Object.keys(pruned.adult_male).length > 0) ||
    (pruned.adult_female && Object.keys(pruned.adult_female).length > 0);
  if (adultHasData) {
    delete pruned.generic;
  }

  return pruned;
}
