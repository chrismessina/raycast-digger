export interface DiggerResult {
  url: string;
  overview?: OverviewData;
  metadata?: MetadataData;
  discoverability?: DiscoverabilityData;
  resources?: ResourcesData;
  networking?: NetworkingData;
  dns?: DNSData;
  performance?: PerformanceData;
  history?: HistoryData;
  dataFeeds?: DataFeedsData;
  hostMetadata?: HostMetadataData;
  botProtection?: BotProtectionData;
  fetchedAt: number;
}

export interface BotProtectionData {
  /** Whether bot protection was detected */
  detected: boolean;
  /** The type of protection detected (e.g., "cloudflare", "akamai") */
  provider?: string;
  /** Human-readable name of the provider */
  providerName?: string;
  /** Whether the response appears to be a challenge page rather than real content */
  isChallengePage: boolean;
}

export interface CacheEntry {
  url: string;
  data: DiggerResult;
  timestamp: number;
  lastAccessed: number;
}

export interface OverviewData {
  title?: string;
  description?: string;
  favicon?: string;
  screenshot?: string;
  language?: string;
  charset?: string;
}

export interface MetadataData {
  openGraph?: Record<string, string>;
  twitterCard?: Record<string, string>;
  jsonLd?: Array<Record<string, unknown>>;
  metaTags?: Array<{ name?: string; property?: string; content?: string }>;
}

export interface DiscoverabilityData {
  robots?: string;
  robotsTxt?: boolean;
  canonical?: string;
  alternates?: Array<{ href: string; hreflang?: string; type?: string }>;
  sitemap?: string;
  llmsTxt?: boolean;
  rss?: string;
  atom?: string;
}

/** Image asset type indicating the source of the image */
export type ImageAssetType =
  | "favicon" // <link rel="icon"> or <link rel="shortcut icon">
  | "apple-touch-icon" // <link rel="apple-touch-icon">
  | "mask-icon" // <link rel="mask-icon"> (Safari pinned tabs)
  | "og" // <meta property="og:image">
  | "twitter" // <meta name="twitter:image">
  | "msapplication" // <meta name="msapplication-TileImage">
  | "json-ld" // From JSON-LD structured data
  | "manifest"; // From manifest.json icons

/** Font provider type indicating the source of the font */
export type FontProvider =
  | "google-fonts" // fonts.googleapis.com or fonts.gstatic.com
  | "adobe-fonts" // use.typekit.net or typekit.com
  | "font-awesome" // Font Awesome CDN
  | "bunny-fonts" // fonts.bunny.net (privacy-focused Google Fonts alternative)
  | "fontshare" // api.fontshare.com
  | "fonts-com" // fast.fonts.net
  | "custom"; // Self-hosted or other providers

/** Represents a font asset found in the head of the page */
export interface FontAsset {
  /** Font family name (e.g., "Roboto", "Open Sans") */
  family: string;
  /** Provider name */
  provider: FontProvider;
  /** Source URL */
  url: string;
  /** Font variants/weights if detectable (e.g., "400", "700") */
  variants?: string[];
  /** Font format if specified (e.g., "woff2", "ttf") */
  format?: string;
}

/** Represents an image asset found in the head of the page */
export interface ImageAsset {
  /** URL of the image */
  src: string;
  /** Alt text if available */
  alt?: string;
  /** Type/source of the image */
  type: ImageAssetType;
  /** Size specification (e.g., "180x180", "32x32") */
  sizes?: string;
  /** MIME type if specified */
  mimeType?: string;
}

export interface ResourcesData {
  stylesheets?: Array<{ href: string; media?: string }>;
  scripts?: Array<{ src: string; async?: boolean; defer?: boolean; type?: string }>;
  /** All image assets found (may contain duplicates by URL) */
  images?: ImageAsset[];
  links?: Array<{ href: string; rel?: string }>;
  /** Theme color from <meta name="theme-color"> */
  themeColor?: string;
  /** Font assets found in the page */
  fonts?: FontAsset[];
}

export interface NetworkingData {
  ipAddress?: string;
  server?: string;
  headers?: Record<string, string>;
  statusCode?: number;
  redirects?: Array<{ from: string; to: string; status: number }>;
  finalUrl?: string;
}

export interface DNSData {
  aRecords?: string[];
  aaaaRecords?: string[];
  mxRecords?: Array<{ priority: number; exchange: string }>;
  txtRecords?: string[];
  nsRecords?: string[];
  cnameRecord?: string;
}

export interface PerformanceData {
  loadTime?: number;
  ttfb?: number;
  domContentLoaded?: number;
  pageSize?: number;
  requestCount?: number;
}

export interface HistoryData {
  waybackMachineSnapshots?: number;
  firstSeen?: string;
  lastSeen?: string;
  archiveUrl?: string;
  rateLimited?: boolean;
}

export interface DataFeedsData {
  rss?: Array<{ url: string; title?: string }>;
  atom?: Array<{ url: string; title?: string }>;
  json?: Array<{ url: string; title?: string }>;
}

// RFC 6415
export interface HostMetadataData {
  available: boolean;
  properties?: Record<string, string>;
  links?: Array<{
    rel: string;
    href?: string;
    template?: string;
    type?: string;
    title?: string;
  }>;
  format?: "xrd" | "jrd";
}
