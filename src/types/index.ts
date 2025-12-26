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
  fetchedAt: number;
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
  canonical?: string;
  alternates?: Array<{ href: string; hreflang?: string; type?: string }>;
  sitemap?: string;
  rss?: string;
  atom?: string;
}

export interface ResourcesData {
  stylesheets?: Array<{ href: string; media?: string }>;
  scripts?: Array<{ src: string; async?: boolean; defer?: boolean; type?: string }>;
  images?: Array<{ src: string; alt?: string }>;
  links?: Array<{ href: string; rel?: string }>;
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
}

export interface DataFeedsData {
  rss?: Array<{ url: string; title?: string }>;
  atom?: Array<{ url: string; title?: string }>;
  json?: Array<{ url: string; title?: string }>;
}
