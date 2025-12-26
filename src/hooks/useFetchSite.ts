import { useState, useCallback } from "react";
import { showToast, Toast } from "@raycast/api";
import { fetchWithTimeout } from "../utils/fetcher";
import { normalizeUrl } from "../utils/urlUtils";
import { useCache } from "./useCache";
import { DiggerResult, OverviewData, MetadataData, DiscoverabilityData, HistoryData } from "../types";
import { performDNSLookup, getTLSCertificateInfo, CertificateInfo } from "../utils/dnsUtils";
import * as cheerio from "cheerio";

async function fetchWaybackMachineData(url: string): Promise<HistoryData | undefined> {
  try {
    const apiUrl = `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`;
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      return undefined;
    }

    const data = (await response.json()) as {
      archived_snapshots?: {
        closest?: {
          timestamp?: string;
          url?: string;
        };
      };
    };
    
    if (!data.archived_snapshots?.closest) {
      return undefined;
    }

    const snapshot = data.archived_snapshots.closest;
    
    // Get additional snapshot count from CDX API
    const cdxUrl = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(url)}&output=json&limit=1&fl=timestamp&collapse=timestamp:8`;
    const cdxResponse = await fetch(cdxUrl);
    
    let snapshotCount = 0;
    if (cdxResponse.ok) {
      const cdxData = await cdxResponse.json();
      snapshotCount = Array.isArray(cdxData) ? Math.max(0, cdxData.length - 1) : 0;
    }

    return {
      waybackMachineSnapshots: snapshotCount,
      firstSeen: snapshot.timestamp ? formatWaybackDate(snapshot.timestamp) : undefined,
      lastSeen: snapshot.timestamp ? formatWaybackDate(snapshot.timestamp) : undefined,
      archiveUrl: `https://web.archive.org/web/*/${url}`,
    };
  } catch {
    return undefined;
  }
}

function formatWaybackDate(timestamp: string): string {
  // Wayback timestamps are in format: YYYYMMDDhhmmss
  const year = timestamp.substring(0, 4);
  const month = timestamp.substring(4, 6);
  const day = timestamp.substring(6, 8);
  return `${year}-${month}-${day}`;
}

export function useFetchSite(url?: string) {
  const [data, setData] = useState<DiggerResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [certificateInfo, setCertificateInfo] = useState<CertificateInfo | null>(null);
  const { getFromCache, saveToCache } = useCache();

  const fetchSite = useCallback(
    async (targetUrl: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const normalizedUrl = normalizeUrl(targetUrl);

        const cached = await getFromCache(normalizedUrl);
        if (cached) {
          setData(cached);
          setIsLoading(false);
          return;
        }

        const [htmlResult, , sitemapResult] = await Promise.allSettled([
          fetchWithTimeout(normalizedUrl),
          fetchWithTimeout(`${normalizedUrl}/robots.txt`).catch(() => null),
          fetchWithTimeout(`${normalizedUrl}/sitemap.xml`).catch(() => null),
        ]);

        if (htmlResult.status === "rejected") {
          throw new Error("Failed to fetch website");
        }

        const { response, status, headers, timing, finalUrl } = htmlResult.value;
        const fullHtml = await response.text();
        
        // Extract only <head> content to reduce memory usage on large pages
        const headMatch = fullHtml.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
        const headHtml = headMatch ? `<html><head>${headMatch[1]}</head></html>` : fullHtml.slice(0, 50000);
        const $ = cheerio.load(headHtml);
        
        // Get language from html tag in full HTML (it's at the start, so cheap to extract)
        const langMatch = fullHtml.match(/<html[^>]*\slang=["']([^"']+)["']/i);

        const overview: OverviewData = {
          title: $("title").text() || undefined,
          description: $('meta[name="description"]').attr("content"),
          language: langMatch?.[1],
          charset: $("meta[charset]").attr("charset") || undefined,
        };

        const openGraph: Record<string, string> = {};
        $('meta[property^="og:"]').each((_, el) => {
          const property = $(el).attr("property");
          const content = $(el).attr("content");
          if (property && content) {
            openGraph[property] = content;
          }
        });

        const twitterCard: Record<string, string> = {};
        $('meta[name^="twitter:"]').each((_, el) => {
          const name = $(el).attr("name");
          const content = $(el).attr("content");
          if (name && content) {
            twitterCard[name] = content;
          }
        });

        // Extract JSON-LD using existing $ instance
        const jsonLdScripts: Array<Record<string, unknown>> = [];
        $('script[type="application/ld+json"]').each((_, element) => {
          try {
            const content = $(element).html();
            if (content) {
              jsonLdScripts.push(JSON.parse(content));
            }
          } catch {
            // Skip invalid JSON-LD
          }
        });

        // Extract meta tags using existing $ instance
        const metaTags: Array<{ name?: string; property?: string; content?: string }> = [];
        $("meta").each((_, element) => {
          const $meta = $(element);
          const name = $meta.attr("name");
          const property = $meta.attr("property");
          const content = $meta.attr("content");
          if ((name || property) && content) {
            metaTags.push({ name, property, content });
          }
        });

        const metadata: MetadataData = {
          openGraph: Object.keys(openGraph).length > 0 ? openGraph : undefined,
          twitterCard: Object.keys(twitterCard).length > 0 ? twitterCard : undefined,
          jsonLd: jsonLdScripts.length > 0 ? jsonLdScripts : undefined,
          metaTags: metaTags.length > 0 ? metaTags : undefined,
        };

        const discoverability: DiscoverabilityData = {
          robots: $('meta[name="robots"]').attr("content"),
          canonical: $('link[rel="canonical"]').attr("href"),
          sitemap:
            sitemapResult.status === "fulfilled" && sitemapResult.value ? `${normalizedUrl}/sitemap.xml` : undefined,
        };

        const alternates: Array<{ href: string; hreflang?: string; type?: string }> = [];
        $('link[rel="alternate"]').each((_, el) => {
          const href = $(el).attr("href");
          if (href) {
            alternates.push({
              href,
              hreflang: $(el).attr("hreflang"),
              type: $(el).attr("type"),
            });
          }
        });
        if (alternates.length > 0) {
          discoverability.alternates = alternates;
        }

        const rssLink = $('link[rel="alternate"][type="application/rss+xml"]').attr("href");
        if (rssLink) {
          discoverability.rss = rssLink;
        }

        const MAX_RESOURCES = 50; // Limit to prevent memory issues on large sites

        const stylesheets: Array<{ href: string; media?: string }> = [];
        $('link[rel="stylesheet"]').slice(0, MAX_RESOURCES).each((_, el) => {
          const href = $(el).attr("href");
          if (href) {
            stylesheets.push({
              href,
              media: $(el).attr("media"),
            });
          }
        });

        const scripts: Array<{ src: string; async?: boolean; defer?: boolean; type?: string }> = [];
        $("script[src]").slice(0, MAX_RESOURCES).each((_, el) => {
          const src = $(el).attr("src");
          if (src) {
            scripts.push({
              src,
              async: $(el).attr("async") !== undefined,
              defer: $(el).attr("defer") !== undefined,
              type: $(el).attr("type"),
            });
          }
        });

        const images: Array<{ src: string; alt?: string }> = [];
        $("img[src]").slice(0, MAX_RESOURCES).each((_, el) => {
          const src = $(el).attr("src");
          if (src) {
            images.push({
              src,
              alt: $(el).attr("alt"),
            });
          }
        });

        const links: Array<{ href: string; rel?: string }> = [];
        $('link[rel]:not([rel="stylesheet"]):not([rel="alternate"])').slice(0, MAX_RESOURCES).each((_, el) => {
          const href = $(el).attr("href");
          if (href) {
            links.push({
              href,
              rel: $(el).attr("rel"),
            });
          }
        });

        const urlObj = new URL(normalizedUrl);
        const hostname = urlObj.hostname;

        // Extract feed URLs
        const rssFeeds: Array<{ url: string; title?: string }> = [];
        const atomFeeds: Array<{ url: string; title?: string }> = [];
        const jsonFeeds: Array<{ url: string; title?: string }> = [];

        $('link[type="application/rss+xml"]').each((_, el) => {
          const href = $(el).attr("href");
          const title = $(el).attr("title");
          if (href) {
            rssFeeds.push({ url: href.startsWith("http") ? href : new URL(href, normalizedUrl).href, title });
          }
        });

        $('link[type="application/atom+xml"]').each((_, el) => {
          const href = $(el).attr("href");
          const title = $(el).attr("title");
          if (href) {
            atomFeeds.push({ url: href.startsWith("http") ? href : new URL(href, normalizedUrl).href, title });
          }
        });

        $('link[type="application/json"], link[type="application/feed+json"]').each((_, el) => {
          const href = $(el).attr("href");
          const title = $(el).attr("title");
          if (href) {
            jsonFeeds.push({ url: href.startsWith("http") ? href : new URL(href, normalizedUrl).href, title });
          }
        });

        const [dnsData, certInfo, waybackData] = await Promise.all([
          performDNSLookup(hostname).catch(() => undefined),
          getTLSCertificateInfo(hostname).catch(() => null),
          fetchWaybackMachineData(normalizedUrl).catch(() => undefined),
        ]);

        if (certInfo) {
          setCertificateInfo(certInfo);
        }

        const result: DiggerResult = {
          url: normalizedUrl,
          overview,
          metadata,
          discoverability,
          resources: {
            stylesheets: stylesheets.length > 0 ? stylesheets : undefined,
            scripts: scripts.length > 0 ? scripts : undefined,
            images: images.length > 0 ? images : undefined,
            links: links.length > 0 ? links : undefined,
          },
          networking: {
            statusCode: status,
            headers,
            finalUrl,
            server: headers.server,
          },
          dns: dnsData,
          performance: {
            loadTime: timing,
            pageSize: fullHtml.length,
          },
          history: waybackData,
          dataFeeds:
            rssFeeds.length > 0 || atomFeeds.length > 0 || jsonFeeds.length > 0
              ? {
                  rss: rssFeeds.length > 0 ? rssFeeds : undefined,
                  atom: atomFeeds.length > 0 ? atomFeeds : undefined,
                  json: jsonFeeds.length > 0 ? jsonFeeds : undefined,
                }
              : undefined,
          fetchedAt: Date.now(),
        };

        setData(result);
        await saveToCache(normalizedUrl, result);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to fetch site data";
        setError(errorMessage);
        await showToast({
          style: Toast.Style.Failure,
          title: "Fetch Error",
          message: errorMessage,
        });
      } finally {
        setIsLoading(false);
      }
    },
    [getFromCache, saveToCache],
  );

  const refetch = useCallback(() => {
    if (url) {
      fetchSite(url);
    }
  }, [url, fetchSite]);

  return { data, isLoading, error, refetch, fetchSite, certificateInfo };
}
