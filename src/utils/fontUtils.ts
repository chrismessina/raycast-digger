import { FontAsset, FontProvider } from "../types";
import { getLogger } from "./logger";

const log = getLogger("fonts");

/** Known font provider URL patterns */
const FONT_PROVIDER_PATTERNS: Array<{ pattern: RegExp; provider: FontProvider; name: string }> = [
  { pattern: /fonts\.googleapis\.com/i, provider: "google-fonts", name: "Google Fonts" },
  { pattern: /fonts\.gstatic\.com/i, provider: "google-fonts", name: "Google Fonts" },
  { pattern: /use\.typekit\.net/i, provider: "adobe-fonts", name: "Adobe Fonts" },
  { pattern: /typekit\.com/i, provider: "adobe-fonts", name: "Adobe Fonts" },
  { pattern: /use\.fontawesome\.com/i, provider: "font-awesome", name: "Font Awesome" },
  { pattern: /cdnjs\.cloudflare\.com\/ajax\/libs\/font-awesome/i, provider: "font-awesome", name: "Font Awesome" },
  { pattern: /kit\.fontawesome\.com/i, provider: "font-awesome", name: "Font Awesome" },
  { pattern: /fonts\.bunny\.net/i, provider: "bunny-fonts", name: "Bunny Fonts" },
  { pattern: /api\.fontshare\.com/i, provider: "fontshare", name: "Fontshare" },
  { pattern: /fast\.fonts\.net/i, provider: "fonts-com", name: "Fonts.com" },
];

/** Human-readable provider names */
export const FONT_PROVIDER_NAMES: Record<FontProvider, string> = {
  "google-fonts": "Google Fonts",
  "adobe-fonts": "Adobe Fonts",
  "font-awesome": "Font Awesome",
  "bunny-fonts": "Bunny Fonts",
  fontshare: "Fontshare",
  "fonts-com": "Fonts.com",
  custom: "Custom",
};

/**
 * Detect font provider from URL
 */
export function detectFontProvider(url: string): { provider: FontProvider; name: string } | null {
  for (const { pattern, provider, name } of FONT_PROVIDER_PATTERNS) {
    if (pattern.test(url)) {
      return { provider, name };
    }
  }
  return null;
}

/**
 * Extract font families from Google Fonts URL
 * Handles both CSS2 API and legacy API formats:
 * - CSS2: https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&family=Open+Sans
 * - Legacy: https://fonts.googleapis.com/css?family=Roboto:400,700|Open+Sans
 */
export function extractGoogleFonts(url: string): FontAsset[] {
  const fonts: FontAsset[] = [];

  try {
    const urlObj = new URL(url);
    const familyParams = urlObj.searchParams.getAll("family");

    for (const familyParam of familyParams) {
      // CSS2 API format: "Roboto:wght@400;700" or "Open+Sans:ital,wght@0,400;1,700"
      // Legacy format: "Roboto:400,700" or "Roboto:400,700|Open+Sans:300"
      const families = familyParam.split("|");

      for (const family of families) {
        const [name, variantsPart] = family.split(":");
        const familyName = decodeURIComponent(name.replace(/\+/g, " ")).trim();

        if (!familyName) continue;

        let variants: string[] | undefined;

        if (variantsPart) {
          // CSS2 format: "wght@400;700" or "ital,wght@0,400;1,700"
          if (variantsPart.includes("@")) {
            const [, weights] = variantsPart.split("@");
            if (weights) {
              // Extract just the weight numbers
              variants = weights
                .split(";")
                .map((w) => {
                  // Handle "0,400" format (ital,wght) - take the weight part
                  const parts = w.split(",");
                  return parts[parts.length - 1];
                })
                .filter((w) => /^\d+$/.test(w));
            }
          } else {
            // Legacy format: "400,700"
            variants = variantsPart.split(",").filter((w) => /^\d+$/.test(w));
          }
        }

        fonts.push({
          family: familyName,
          provider: "google-fonts",
          url,
          variants: variants && variants.length > 0 ? variants : undefined,
        });
      }
    }
  } catch (e) {
    log.error("fonts:extract-google-fonts-error", { url, error: e });
  }

  log.log("fonts:extracted-google-fonts", { url, count: fonts.length, families: fonts.map((f) => f.family) });
  return fonts;
}

/**
 * Extract font families from Bunny Fonts URL (same format as Google Fonts)
 */
export function extractBunnyFonts(url: string): FontAsset[] {
  // Bunny Fonts uses the same URL format as Google Fonts
  const googleFonts = extractGoogleFonts(url);
  return googleFonts.map((font) => ({
    ...font,
    provider: "bunny-fonts" as FontProvider,
  }));
}

/**
 * Extract font info from Adobe Fonts/Typekit URL
 * Format: https://use.typekit.net/abc1234.css
 * Note: Adobe Fonts doesn't expose family names in the URL, only project ID
 */
export function extractAdobeFonts(url: string): FontAsset[] {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    // Extract project ID from path like "/abc1234.css"
    const match = pathname.match(/\/([a-z0-9]+)\.css$/i);
    if (match) {
      const projectId = match[1];
      return [
        {
          family: `Adobe Fonts Project (${projectId})`,
          provider: "adobe-fonts",
          url,
        },
      ];
    }
  } catch (e) {
    log.error("fonts:extract-adobe-fonts-error", { url, error: e });
  }
  return [];
}

/**
 * Extract font info from Font Awesome URL
 */
export function extractFontAwesome(url: string): FontAsset[] {
  // Font Awesome is an icon font, not a text font
  // We'll still track it but mark it appropriately
  return [
    {
      family: "Font Awesome",
      provider: "font-awesome",
      url,
    },
  ];
}

/**
 * Extract font info from a preload link
 * Format: <link rel="preload" href="/fonts/custom.woff2" as="font" type="font/woff2">
 */
export function extractPreloadFont(href: string, type?: string): FontAsset {
  // Try to extract filename as family name
  let family = "Custom Font";
  try {
    const urlObj = new URL(href, "https://example.com");
    const filename = urlObj.pathname.split("/").pop() || "";
    // Remove extension and clean up
    family = filename.replace(/\.(woff2?|ttf|otf|eot)$/i, "").replace(/[-_]/g, " ");
    // Capitalize first letter of each word
    family = family
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  } catch {
    // Use default
  }

  // Extract format from type or URL
  let format: string | undefined;
  if (type) {
    format = type.replace("font/", "");
  } else if (href.includes(".woff2")) {
    format = "woff2";
  } else if (href.includes(".woff")) {
    format = "woff";
  } else if (href.includes(".ttf")) {
    format = "ttf";
  } else if (href.includes(".otf")) {
    format = "otf";
  }

  return {
    family,
    provider: "custom",
    url: href,
    format,
  };
}

/**
 * Parse fonts from a stylesheet link URL
 */
export function parseFontsFromUrl(url: string): FontAsset[] {
  const providerInfo = detectFontProvider(url);

  if (!providerInfo) {
    return [];
  }

  log.log("fonts:parsing-url", { url, provider: providerInfo.provider });

  switch (providerInfo.provider) {
    case "google-fonts":
      return extractGoogleFonts(url);
    case "bunny-fonts":
      return extractBunnyFonts(url);
    case "adobe-fonts":
      return extractAdobeFonts(url);
    case "font-awesome":
      return extractFontAwesome(url);
    default:
      return [
        {
          family: providerInfo.name,
          provider: providerInfo.provider,
          url,
        },
      ];
  }
}

/**
 * Deduplicate fonts by family name and provider
 */
export function deduplicateFonts(fonts: FontAsset[]): FontAsset[] {
  const seen = new Map<string, FontAsset>();

  for (const font of fonts) {
    const key = `${font.provider}:${font.family}`;
    const existing = seen.get(key);

    if (existing) {
      // Merge variants if both have them
      if (font.variants && existing.variants) {
        const mergedVariants = [...new Set([...existing.variants, ...font.variants])];
        mergedVariants.sort((a, b) => parseInt(a) - parseInt(b));
        existing.variants = mergedVariants;
      } else if (font.variants) {
        existing.variants = font.variants;
      }
    } else {
      seen.set(key, { ...font });
    }
  }

  const result = Array.from(seen.values());
  log.log("fonts:deduplicated", { input: fonts.length, output: result.length });
  return result;
}
