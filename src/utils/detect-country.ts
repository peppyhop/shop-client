import type { CountryDetectionResult, CountryScores } from "../types";

const COUNTRY_CODES: Record<string, string> = {
  "+1": "US", // United States (primary) / Canada also uses +1
  "+44": "GB", // United Kingdom
  "+61": "AU", // Australia
  "+65": "SG", // Singapore
  "+91": "IN", // India
  "+81": "JP", // Japan
  "+49": "DE", // Germany
  "+33": "FR", // France
  "+971": "AE", // United Arab Emirates
  "+39": "IT", // Italy
  "+34": "ES", // Spain
  "+82": "KR", // South Korea
  "+55": "BR", // Brazil
  "+62": "ID", // Indonesia
  "+92": "PK", // Pakistan
  "+7": "RU", // Russia
};

// Map Shopify currency codes to likely ISO country codes
// Note: Some codes (e.g., USD, EUR) are used by multiple countries; we treat them as signals.
const CURRENCY_CODE_TO_COUNTRY: Record<string, string> = {
  INR: "IN",
  USD: "US",
  CAD: "CA",
  AUD: "AU",
  GBP: "GB",
  EUR: "EU",
  AED: "AE",
  KRW: "KR",
  JPY: "JP",
};

function scoreCountry(
  countryScores: CountryScores,
  country: string,
  weight: number,
  reason: string
): void {
  if (!country) return;
  if (!countryScores[country])
    countryScores[country] = { score: 0, reasons: [] };
  countryScores[country].score += weight;
  countryScores[country].reasons.push(reason);
}

/**
 * Detects the country of a Shopify store by analyzing various signals in the HTML content.
 *
 * This function examines multiple data sources within the HTML to determine the store's country:
 * - Shopify features JSON data (country, locale, money format)
 * - Phone number prefixes in contact information
 * - JSON-LD structured data with address information
 * - Footer mentions of country names
 * - Currency symbols in money formatting
 *
 * @param html - The HTML content of the Shopify store's homepage
 * @returns Promise resolving to country detection results containing:
 * - `country` - The detected country ISO 3166-1 alpha-2 code (e.g., "US", "GB") or "Unknown" if no reliable detection
 * - `confidence` - Confidence score between 0 and 1 (higher = more confident)
 * - `signals` - Array of detection signals that contributed to the result
 *
 * @example
 * ```typescript
 * const response = await fetch('https://exampleshop.com');
 * const html = await response.text();
 * const result = await detectShopifyCountry(html);
 *
 * console.log(result.country); // "US" (ISO code for United States)
 * console.log(result.confidence); // 0.85
 * console.log(result.signals); // ["shopify-features.country", "phone prefix +1"]
 * ```
 */
export async function detectShopCountry(
  html: string
): Promise<CountryDetectionResult> {
  const countryScores: CountryScores = {};
  let detectedCurrencyCode: string | undefined;

  // 1️⃣ b) Detect Shopify.currency active code (common across many Shopify themes)
  // Example: Shopify.currency = {"active":"INR","rate":"1.0"};
  // Fallback pattern: Shopify.currency.active = 'INR';
  const currencyJsonMatch = html.match(/Shopify\.currency\s*=\s*(\{[^}]*\})/);
  if (currencyJsonMatch) {
    try {
      const raw = currencyJsonMatch[1];
      const obj = JSON.parse(raw || "{}") as any;
      const activeCode =
        typeof obj?.active === "string" ? obj.active.toUpperCase() : undefined;
      const iso = activeCode ? CURRENCY_CODE_TO_COUNTRY[activeCode] : undefined;
      if (activeCode) {
        detectedCurrencyCode = activeCode;
      }
      if (typeof iso === "string") {
        // Treat as a strong signal
        scoreCountry(countryScores, iso, 0.8, "Shopify.currency.active");
      }
    } catch (_error) {
      // ignore malformed objects
    }
  } else {
    const currencyActiveAssignMatch = html.match(
      /Shopify\.currency\.active\s*=\s*['"]([A-Za-z]{3})['"]/i
    );
    if (currencyActiveAssignMatch) {
      const captured = currencyActiveAssignMatch[1];
      const code =
        typeof captured === "string" ? captured.toUpperCase() : undefined;
      const iso = code ? CURRENCY_CODE_TO_COUNTRY[code] : undefined;
      if (code) {
        detectedCurrencyCode = code;
      }
      if (typeof iso === "string") {
        scoreCountry(countryScores, iso, 0.8, "Shopify.currency.active");
      }
    }
  }

  // 1️⃣ c) Detect explicit Shopify.country assignment
  // Example: Shopify.country = "IN";
  const shopifyCountryMatch = html.match(
    /Shopify\.country\s*=\s*['"]([A-Za-z]{2})['"]/i
  );
  if (shopifyCountryMatch) {
    const captured = shopifyCountryMatch[1];
    const iso =
      typeof captured === "string" ? captured.toUpperCase() : undefined;
    if (typeof iso === "string") {
      // Treat as strongest signal
      scoreCountry(countryScores, iso, 1, "Shopify.country");
    }
  }

  // 2️⃣ Extract phone numbers
  const phones = html.match(/\+\d{1,3}[\s\-()0-9]{5,}/g);
  if (phones) {
    for (const phone of phones) {
      const prefix = phone.match(/^\+\d{1,3}/)?.[0];
      if (prefix && COUNTRY_CODES[prefix])
        scoreCountry(
          countryScores,
          COUNTRY_CODES[prefix],
          0.8,
          `phone prefix ${prefix}`
        );
    }
  }

  // 3️⃣ Extract JSON-LD addressCountry fields
  const jsonLdRegex = /<script[^>]+application\/ld\+json[^>]*>(.*?)<\/script>/g;
  let jsonLdMatch: RegExpExecArray | null = jsonLdRegex.exec(html);
  while (jsonLdMatch !== null) {
    try {
      const json = jsonLdMatch[1];
      if (!json) {
        // skip empty capture
      } else {
        const raw = JSON.parse(json) as unknown;

        const collectAddressCountries = (
          node: unknown,
          results: string[] = []
        ): string[] => {
          if (Array.isArray(node)) {
            for (const item of node) collectAddressCountries(item, results);
            return results;
          }
          if (node && typeof node === "object") {
            const obj = node as Record<string, unknown>;
            const address = obj.address;
            if (address && typeof address === "object") {
              const country = (address as Record<string, unknown>)
                .addressCountry;
              if (typeof country === "string") results.push(country);
            }
            // Support nested graphs
            const graph = obj["@graph"];
            if (graph) collectAddressCountries(graph, results);
          }
          return results;
        };

        const countries = collectAddressCountries(raw);
        for (const country of countries) {
          scoreCountry(countryScores, country, 1, "JSON-LD addressCountry");
        }
      }
    } catch (_error) {
      // Silently handle JSON parsing errors
    }
    // advance to next match
    jsonLdMatch = jsonLdRegex.exec(html);
  }

  // 4️⃣ Footer country mentions - now using ISO codes
  const footerMatch = html.match(/<footer[^>]*>(.*?)<\/footer>/i);
  if (footerMatch) {
    const footerTextGroup = footerMatch[1];
    const footerText = footerTextGroup ? footerTextGroup.toLowerCase() : "";
    // Create a mapping of country names to ISO codes for footer detection
    const countryNameToISO: Record<string, string> = {
      india: "IN",
      "united states": "US",
      canada: "CA",
      australia: "AU",
      "united kingdom": "GB",
      britain: "GB",
      uk: "GB",
      japan: "JP",
      "south korea": "KR",
      korea: "KR",
      germany: "DE",
      france: "FR",
      italy: "IT",
      spain: "ES",
      brazil: "BR",
      russia: "RU",
      singapore: "SG",
      indonesia: "ID",
      pakistan: "PK",
    };

    for (const [countryName, isoCode] of Object.entries(countryNameToISO)) {
      if (footerText.includes(countryName))
        scoreCountry(countryScores, isoCode, 0.4, "footer mention");
    }
  }

  // Pick best guess
  const sorted = Object.entries(countryScores).sort(
    (a, b) => b[1].score - a[1].score
  );
  const best = sorted[0];

  return best
    ? {
        country: best[0],
        confidence: Math.min(1, best[1].score / 2),
        signals: best[1].reasons,
        currencyCode: detectedCurrencyCode,
      }
    : {
        country: "Unknown",
        confidence: 0,
        signals: [],
        currencyCode: detectedCurrencyCode,
      };
}
