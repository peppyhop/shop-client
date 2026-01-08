import { parse } from "tldts";
import type { CurrencyCode } from "../types";

export function extractDomainWithoutSuffix(domain: string) {
  const parsedDomain = parse(domain);
  return parsedDomain.domainWithoutSuffix;
}

export function generateStoreSlug(domain: string): string {
  const input = new URL(domain);
  const parsedDomain = parse(input.href);
  const domainName =
    parsedDomain.domainWithoutSuffix ?? input.hostname.split(".")[0];

  return (domainName || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const genProductSlug = ({
  handle,
  storeDomain,
}: {
  handle: string;
  storeDomain: string;
}) => {
  const storeSlug = generateStoreSlug(storeDomain);
  return `${handle}-by-${storeSlug}`;
};

export const calculateDiscount = (
  price: number,
  compareAtPrice?: number
): number =>
  !compareAtPrice || compareAtPrice === 0
    ? 0
    : Math.max(
        0,
        Math.round(100 - (price / compareAtPrice) * 100) // Removed the decimal precision
      );

/**
 * Normalize and sanitize a domain string.
 *
 * Accepts inputs like full URLs, protocol-relative URLs, bare hostnames,
 * or strings with paths/query/fragment, and returns a normalized domain.
 *
 * Examples:
 *  - "https://WWW.Example.com/path" -> "example.com"
 *  - "//sub.example.co.uk" -> "example.co.uk"
 *  - "www.example.com:8080" -> "example.com"
 *  - "example" -> "example"
 */
export function sanitizeDomain(
  input: string,
  opts?: { stripWWW?: boolean }
): string {
  if (typeof input !== "string") {
    throw new Error("sanitizeDomain: input must be a string");
  }
  let raw = input.trim();
  if (!raw) {
    throw new Error("sanitizeDomain: input cannot be empty");
  }
  // Only add protocol if it's missing and not protocol-relative
  const hasProtocol = /^[a-z]+:\/\//i.test(raw);
  if (!hasProtocol && !raw.startsWith("//")) {
    raw = `https://${raw}`;
  }

  const stripWWW = opts?.stripWWW ?? true;

  try {
    let url: URL;
    if (raw.startsWith("//")) {
      url = new URL(`https:${raw}`);
    } else if (raw.includes("://")) {
      url = new URL(raw);
    } else {
      url = new URL(`https://${raw}`);
    }
    let hostname = url.hostname.toLowerCase();
    const hadWWW = /^www\./i.test(url.hostname);
    if (stripWWW) hostname = hostname.replace(/^www\./, "");
    if (!hostname.includes(".")) {
      throw new Error("sanitizeDomain: invalid domain (missing suffix)");
    }
    const parsed = parse(hostname);
    if (!parsed.publicSuffix || parsed.isIcann === false) {
      // Require a valid public suffix (e.g., TLD); reject bare hostnames
      throw new Error("sanitizeDomain: invalid domain (missing suffix)");
    }
    if (!stripWWW && hadWWW) {
      return `www.${parsed.domain || hostname}`;
    }
    return parsed.domain || hostname;
  } catch {
    // Fallback: attempt to sanitize without URL parsing
    let hostname = raw.toLowerCase();
    hostname = hostname.replace(/^[a-z]+:\/\//, ""); // remove protocol if present
    hostname = hostname.replace(/^\/\//, ""); // remove protocol-relative
    hostname = hostname.replace(/[/:#?].*$/, ""); // remove path/query/fragment/port
    const hadWWW = /^www\./i.test(hostname);
    if (stripWWW) hostname = hostname.replace(/^www\./, "");
    if (!hostname.includes(".")) {
      throw new Error("sanitizeDomain: invalid domain (missing suffix)");
    }
    const parsed = parse(hostname);
    if (!parsed.publicSuffix || parsed.isIcann === false) {
      throw new Error("sanitizeDomain: invalid domain (missing suffix)");
    }
    if (!stripWWW && hadWWW) {
      return `www.${parsed.domain || hostname}`;
    }
    return parsed.domain || hostname;
  }
}

/**
 * Safely parse a date string into a Date object.
 *
 * Returns `undefined` when input is falsy or cannot be parsed into a valid date.
 * Use `|| null` at call sites that expect `null` instead of `undefined`.
 */
export function safeParseDate(input?: string | null): Date | undefined {
  if (!input || typeof input !== "string") return undefined;
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/**
 * Normalize an option name or value to a lowercase, underscore-separated key.
 */
export function normalizeKey(input: string): string {
  const ascii = input
    .normalize("NFKD")
    .replace(/\p{Sc}+/gu, " ")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/æ/g, "ae")
    .replace(/œ/g, "oe")
    .replace(/ø/g, "o")
    .replace(/ð/g, "d")
    .replace(/þ/g, "th")
    .replace(/đ/g, "d")
    .replace(/ħ/g, "h")
    .replace(/ı/g, "i")
    .replace(/ł/g, "l")
    .replace(/[^\u0020-\u007e]/g, "");

  return ascii.replace(/[^a-z0-9]+/g, "_").replace(/_+/g, "_");
}

const VARIANT_NAME_VALUE_SEPARATOR = "__";
const VARIANT_PARTS_SEPARATOR = "____";

function normalizeVariantToken(input: string): string {
  return normalizeKey(input).replace(/^_+|_+$/g, "");
}

/**
 * Build a map from normalized option combination → variant id strings.
 * Example key: `size__xl____color__blue`.
 */
export function buildVariantOptionsMap(
  optionNames: string[],
  variants: Array<{
    id: number;
    option1: string | null;
    option2: string | null;
    option3: string | null;
  }>
): Record<string, string> {
  const keys = optionNames.map(normalizeVariantToken);
  const map: Record<string, string> = {};

  for (const v of variants) {
    const parts: string[] = [];
    if (keys[0] && v.option1)
      parts.push(
        `${keys[0]}${VARIANT_NAME_VALUE_SEPARATOR}${normalizeVariantToken(v.option1)}`
      );
    if (keys[1] && v.option2)
      parts.push(
        `${keys[1]}${VARIANT_NAME_VALUE_SEPARATOR}${normalizeVariantToken(v.option2)}`
      );
    if (keys[2] && v.option3)
      parts.push(
        `${keys[2]}${VARIANT_NAME_VALUE_SEPARATOR}${normalizeVariantToken(v.option3)}`
      );

    if (parts.length > 0) {
      // Ensure deterministic alphabetical ordering of parts
      if (parts.length > 1) parts.sort();
      const key = parts.join(VARIANT_PARTS_SEPARATOR);
      const id = v.id.toString();
      // First-write wins: do not override if key already exists
      if (map[key] === undefined) {
        map[key] = id;
      }
    }
  }

  return map;
}

export function buildVariantPriceMap(
  optionNames: string[],
  variants: Array<{
    id: number;
    option1: string | null;
    option2: string | null;
    option3: string | null;
    price: string | number;
  }>
): Record<string, number> {
  const toCents = (value: unknown): number => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const n = Number.parseFloat(value);
      return Number.isFinite(n) ? Math.round(n * 100) : 0;
    }
    return 0;
  };

  const keys = optionNames.map(normalizeVariantToken);
  const map: Record<string, number> = {};

  for (const v of variants) {
    const parts: string[] = [];
    if (keys[0] && v.option1)
      parts.push(
        `${keys[0]}${VARIANT_NAME_VALUE_SEPARATOR}${normalizeVariantToken(v.option1)}`
      );
    if (keys[1] && v.option2)
      parts.push(
        `${keys[1]}${VARIANT_NAME_VALUE_SEPARATOR}${normalizeVariantToken(v.option2)}`
      );
    if (keys[2] && v.option3)
      parts.push(
        `${keys[2]}${VARIANT_NAME_VALUE_SEPARATOR}${normalizeVariantToken(v.option3)}`
      );

    if (parts.length > 0) {
      if (parts.length > 1) parts.sort();
      const key = parts.join(VARIANT_PARTS_SEPARATOR);
      if (map[key] === undefined) {
        map[key] = toCents(v.price);
      }
    }
  }

  return map;
}

export function buildVariantSkuMap(
  optionNames: string[],
  variants: Array<{
    id: number;
    option1: string | null;
    option2: string | null;
    option3: string | null;
    sku: string | null;
  }>
): Record<string, string | null> {
  const keys = optionNames.map(normalizeVariantToken);
  const map: Record<string, string | null> = {};

  for (const v of variants) {
    const parts: string[] = [];
    if (keys[0] && v.option1)
      parts.push(
        `${keys[0]}${VARIANT_NAME_VALUE_SEPARATOR}${normalizeVariantToken(v.option1)}`
      );
    if (keys[1] && v.option2)
      parts.push(
        `${keys[1]}${VARIANT_NAME_VALUE_SEPARATOR}${normalizeVariantToken(v.option2)}`
      );
    if (keys[2] && v.option3)
      parts.push(
        `${keys[2]}${VARIANT_NAME_VALUE_SEPARATOR}${normalizeVariantToken(v.option3)}`
      );

    if (parts.length > 0) {
      if (parts.length > 1) parts.sort();
      const key = parts.join(VARIANT_PARTS_SEPARATOR);
      if (map[key] === undefined) {
        map[key] = typeof v.sku === "string" && v.sku.trim() ? v.sku : null;
      }
    }
  }

  return map;
}

/**
 * Build a normalized variant key string from an object of option name → value.
 * - Normalizes both names and values using `normalizeKey`
 * - Sorts parts alphabetically for deterministic output
 * - Joins parts using `____` and uses `name__value` for each part
 *
 * Example output: `color__blue____size__xl`
 */
export function buildVariantKey(
  obj: Record<string, string | null | undefined>
): string {
  const parts: string[] = [];
  for (const [name, value] of Object.entries(obj)) {
    if (value) {
      parts.push(
        `${normalizeVariantToken(name)}${VARIANT_NAME_VALUE_SEPARATOR}${normalizeVariantToken(value)}`
      );
    }
  }
  if (parts.length === 0) return "";
  parts.sort((a, b) => a.localeCompare(b));
  return parts.join(VARIANT_PARTS_SEPARATOR);
}

/**
 * Format a price amount (in cents) using a given ISO 4217 currency code.
 * Falls back to a simple string when Intl formatting fails.
 */
export function formatPrice(
  amountInCents: number,
  currency: CurrencyCode
): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format((amountInCents || 0) / 100);
  } catch {
    const val = (amountInCents || 0) / 100;
    return `${val} ${currency}`;
  }
}
