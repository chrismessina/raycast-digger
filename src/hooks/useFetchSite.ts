import { useState, useCallback } from "react";
import * as cheerio from "cheerio";
import { showToast, Toast } from "@raycast/api";
import { fetchHeadOnlyWithFallback, fetchWithTimeout } from "../utils/fetcher";
import { normalizeUrl, getRootResourceUrl } from "../utils/urlUtils";
import { fetchWaybackMachineData } from "../utils/waybackUtils";
import { fetchHostMetadata } from "../utils/hostMetaUtils";
import { useCache } from "./useCache";
import { DiggerResult, OverviewData, MetadataData, DiscoverabilityData } from "../types";
import { performDNSLookup, getTLSCertificateInfo, CertificateInfo } from "../utils/dnsUtils";
import { getLogger } from "../utils/logger";

const log = getLogger("fetch");

export interface LoadingProgress {
  overview: number;
  metadata: number;
  discoverability: number;
  resources: number;
  networking: number;
  dns: number;
  history: number;
  dataFeeds: number;
}

const initialProgress: LoadingProgress = {
  overview: 0,
  metadata: 0,
  discoverability: 0,
  resources: 0,
  networking: 0,
  dns: 0,
  history: 0,
  dataFeeds: 0,
};

export function useFetchSite(url?: string) {
  const [data, setData] = useState<DiggerResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [certificateInfo, setCertificateInfo] = useState<CertificateInfo | null>(null);
  const [progress, setProgress] = useState<LoadingProgress>(initialProgress);
  const { getFromCache, saveToCache } = useCache();

  const fetchSite = useCallback(
    async (targetUrl: string) => {
      log.log("fetch:start", { targetUrl });
      setIsLoading(true);
      setError(null);
      setProgress(initialProgress);

      // Create an AbortController to cancel async operations if main fetch fails
      const abortController = new AbortController();

      // Helper to update progress for a specific category
      const updateProgress = (category: keyof LoadingProgress, value: number) => {
        setProgress((prev) => ({ ...prev, [category]: value }));
      };

      // Start all categories at initial loading state (0.1 = started)
      setProgress({
        overview: 0.1,
        metadata: 0.1,
        discoverability: 0.1,
        resources: 0.1,
        networking: 0.1,
        dns: 0.1,
        history: 0.1,
        dataFeeds: 0.1,
      });

      // Helper to update data progressively
      const updateData = (partial: Partial<DiggerResult>) => {
        setData((prev) => (prev ? { ...prev, ...partial } : (partial as DiggerResult)));
      };

      try {
        const normalizedUrl = normalizeUrl(targetUrl);
        log.log("fetch:normalized", { normalizedUrl });

        const cached = await getFromCache(normalizedUrl);
        if (cached) {
          log.log("cache:hit", { url: normalizedUrl });
          setData(cached);
          setProgress({
            overview: 1,
            metadata: 1,
            discoverability: 1,
            resources: 1,
            networking: 1,
            dns: 1,
            history: 1,
            dataFeeds: 1,
          });
          setIsLoading(false);
          return;
        }
        log.log("cache:miss", { url: normalizedUrl });

        // Initialize data with URL immediately
        setData({ url: normalizedUrl, fetchedAt: Date.now() } as DiggerResult);

        log.log("fetch:resources", { url: normalizedUrl });
        // Update networking progress - fetching started
        updateProgress("networking", 0.3);

        // Start async fetches for DNS, Wayback, etc. early (don't await yet)
        const urlObj = new URL(normalizedUrl);
        const hostname = urlObj.hostname;

        // Start these in parallel immediately - they're independent of HTML parsing
        updateProgress("dns", 0.3);
        updateProgress("history", 0.3);
        
        // Wrap async operations to check abort signal
        const dnsPromise = new Promise<Awaited<ReturnType<typeof performDNSLookup>> | undefined>((resolve) => {
          if (abortController.signal.aborted) return resolve(undefined);
          performDNSLookup(hostname).then(resolve).catch(() => resolve(undefined));
          abortController.signal.addEventListener("abort", () => resolve(undefined));
        });
        
        const certPromise = new Promise<CertificateInfo | null>((resolve) => {
          if (abortController.signal.aborted) return resolve(null);
          getTLSCertificateInfo(hostname).then(resolve).catch(() => resolve(null));
          abortController.signal.addEventListener("abort", () => resolve(null));
        });
        
        const waybackPromise = new Promise<Awaited<ReturnType<typeof fetchWaybackMachineData>> | undefined>((resolve) => {
          if (abortController.signal.aborted) return resolve(undefined);
          fetchWaybackMachineData(normalizedUrl).then(resolve).catch(() => resolve(undefined));
          abortController.signal.addEventListener("abort", () => resolve(undefined));
        });
        
        const hostMetaPromise = new Promise<Awaited<ReturnType<typeof fetchHostMetadata>> | undefined>((resolve) => {
          if (abortController.signal.aborted) return resolve(undefined);
          fetchHostMetadata(normalizedUrl).then(resolve).catch(() => resolve(undefined));
          abortController.signal.addEventListener("abort", () => resolve(undefined));
        });

        // Use streaming fetch for main HTML to avoid memory issues on large pages
        // Use getRootResourceUrl to ensure robots.txt and sitemap.xml are fetched from the domain root
        const robotsUrl = getRootResourceUrl("robots.txt", normalizedUrl);
        const sitemapUrl = getRootResourceUrl("sitemap.xml", normalizedUrl);
        const [htmlResult, , sitemapResult] = await Promise.allSettled([
          fetchHeadOnlyWithFallback(normalizedUrl),
          robotsUrl ? fetchWithTimeout(robotsUrl).catch(() => null) : Promise.resolve(null),
          sitemapUrl ? fetchWithTimeout(sitemapUrl).catch(() => null) : Promise.resolve(null),
        ]);

        if (htmlResult.status === "rejected") {
          log.error("fetch:failed", { url: normalizedUrl, error: htmlResult.reason });
          // Cancel all pending async operations
          abortController.abort();
          log.log("fetch:aborted-async-operations", { reason: "main fetch failed" });
          throw new Error("Failed to fetch website");
        }

        const { headHtml: streamedHtml, status, headers, timing, finalUrl, truncated } = htmlResult.value;
        log.log("fetch:response", { status, finalUrl, timing, truncated, htmlLength: streamedHtml.length });

        // Networking data is now available - update immediately
        updateProgress("networking", 1);
        updateData({
          networking: {
            statusCode: status,
            headers,
            finalUrl,
            server: headers.server,
          },
          performance: {
            loadTime: timing,
            pageSize: streamedHtml.length,
          },
        });

        log.log("parse:start", { htmlLength: streamedHtml.length, truncated });

        // Update progress - HTML parsing started
        updateProgress("overview", 0.5);
        updateProgress("metadata", 0.3);
        updateProgress("discoverability", 0.3);
        updateProgress("resources", 0.3);
        updateProgress("dataFeeds", 0.3);

        // Parse the streamed HTML (already limited to head content)
        const $ = cheerio.load(streamedHtml);

        // Get language from html tag (it's at the start of the streamed content)
        const langMatch = streamedHtml.match(/<html[^>]*\slang=["']([^"']+)["']/i);

        const overview: OverviewData = {
          title: $("title").text() || undefined,
          description: $('meta[name="description"]').attr("content"),
          language: langMatch?.[1],
          charset: $("meta[charset]").attr("charset") || undefined,
        };
        log.log("parse:overview", { title: overview.title, language: overview.language });

        // Overview parsing complete - update immediately
        updateProgress("overview", 1);
        updateData({ overview });

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
        log.log("parse:metadata", {
          ogTags: Object.keys(openGraph).length,
          twitterTags: Object.keys(twitterCard).length,
          jsonLdScripts: jsonLdScripts.length,
          metaTags: metaTags.length,
        });

        // Metadata parsing complete - update immediately
        updateProgress("metadata", 1);
        updateProgress("dataFeeds", 0.5);
        updateData({ metadata });

        const discoverability: DiscoverabilityData = {
          robots: $('meta[name="robots"]').attr("content"),
          canonical: $('link[rel="canonical"]').attr("href"),
          sitemap:
            sitemapResult.status === "fulfilled" && sitemapResult.value ? sitemapUrl : undefined,
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

        // Discoverability parsing complete - update immediately
        updateProgress("discoverability", 1);
        updateData({ discoverability });

        const MAX_RESOURCES = 50; // Limit to prevent memory issues on large sites

        const stylesheets: Array<{ href: string; media?: string }> = [];
        $('link[rel="stylesheet"]')
          .slice(0, MAX_RESOURCES)
          .each((_, el) => {
            const href = $(el).attr("href");
            if (href) {
              stylesheets.push({
                href,
                media: $(el).attr("media"),
              });
            }
          });

        const scripts: Array<{ src: string; async?: boolean; defer?: boolean; type?: string }> = [];
        $("script[src]")
          .slice(0, MAX_RESOURCES)
          .each((_, el) => {
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
        $("img[src]")
          .slice(0, MAX_RESOURCES)
          .each((_, el) => {
            const src = $(el).attr("src");
            if (src) {
              images.push({
                src,
                alt: $(el).attr("alt"),
              });
            }
          });

        const links: Array<{ href: string; rel?: string }> = [];
        $('link[rel]:not([rel="stylesheet"]):not([rel="alternate"])')
          .slice(0, MAX_RESOURCES)
          .each((_, el) => {
            const href = $(el).attr("href");
            if (href) {
              links.push({
                href,
                rel: $(el).attr("rel"),
              });
            }
          });

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

        // Resources and data feeds parsing complete - update immediately
        updateProgress("resources", 1);
        updateProgress("dataFeeds", 1);
        updateData({
          resources: {
            stylesheets: stylesheets.length > 0 ? stylesheets : undefined,
            scripts: scripts.length > 0 ? scripts : undefined,
            images: images.length > 0 ? images : undefined,
            links: links.length > 0 ? links : undefined,
          },
          dataFeeds:
            rssFeeds.length > 0 || atomFeeds.length > 0 || jsonFeeds.length > 0
              ? {
                  rss: rssFeeds.length > 0 ? rssFeeds : undefined,
                  atom: atomFeeds.length > 0 ? atomFeeds : undefined,
                  json: jsonFeeds.length > 0 ? jsonFeeds : undefined,
                }
              : undefined,
        });

        log.log("fetch:awaiting-async-fetches", { hostname });

        // Now await the async fetches that were started earlier
        // Handle each one individually so they update as they complete
        dnsPromise.then((dnsData) => {
          log.log("fetch:dns-complete", { hasDns: !!dnsData });
          updateProgress("dns", 1);
          updateData({ dns: dnsData });
        });

        certPromise.then((certInfo) => {
          log.log("fetch:cert-complete", { hasCert: !!certInfo });
          if (certInfo) {
            setCertificateInfo(certInfo);
          }
        });

        waybackPromise.then((waybackData) => {
          log.log("fetch:wayback-complete", { hasWayback: !!waybackData, rateLimited: waybackData?.rateLimited });
          updateProgress("history", 1);
          // Only update if we got good data, or if there's no existing data
          // Don't overwrite good cached data with rate-limited empty data
          if (waybackData && !waybackData.rateLimited) {
            updateData({ history: waybackData });
          } else if (waybackData?.rateLimited) {
            // If rate limited, update to show the rate limit status but preserve any existing snapshot data
            setData((prev) => {
              if (prev?.history?.waybackMachineSnapshots && prev.history.waybackMachineSnapshots > 0) {
                // Keep existing good data, just add rate limited flag
                return { ...prev, history: { ...prev.history, rateLimited: true } };
              }
              // No existing good data, show rate limited state
              return prev ? { ...prev, history: waybackData } : prev;
            });
          }
        });

        hostMetaPromise.then((hostMetadata) => {
          log.log("fetch:hostmeta-complete", { hasHostMeta: !!hostMetadata?.available });
          updateData({ hostMetadata });
        });

        // Wait for all async fetches to complete before caching
        const [dnsData, certInfo, waybackData, hostMetadata] = await Promise.all([
          dnsPromise,
          certPromise,
          waybackPromise,
          hostMetaPromise,
        ]);

        log.log("fetch:all-async-complete", {
          hasDns: !!dnsData,
          hasCert: !!certInfo,
          hasWayback: !!waybackData,
          hasHostMeta: !!hostMetadata?.available,
          waybackRateLimited: waybackData?.rateLimited,
        });

        // Determine final history data - don't cache rate-limited empty data over good data
        let finalHistoryData = waybackData;
        if (waybackData?.rateLimited && (!waybackData.waybackMachineSnapshots || waybackData.waybackMachineSnapshots === 0)) {
          // Rate limited with no data - check if we have existing good data in state
          const currentData = data;
          if (currentData?.history?.waybackMachineSnapshots && currentData.history.waybackMachineSnapshots > 0) {
            // Preserve existing good data, just mark as rate limited
            finalHistoryData = { ...currentData.history, rateLimited: true };
            log.log("fetch:wayback-preserving-cached", { existingSnapshots: currentData.history.waybackMachineSnapshots });
          }
        }

        // Build final result for caching
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
            pageSize: streamedHtml.length,
          },
          history: finalHistoryData,
          dataFeeds:
            rssFeeds.length > 0 || atomFeeds.length > 0 || jsonFeeds.length > 0
              ? {
                  rss: rssFeeds.length > 0 ? rssFeeds : undefined,
                  atom: atomFeeds.length > 0 ? atomFeeds : undefined,
                  json: jsonFeeds.length > 0 ? jsonFeeds : undefined,
                }
              : undefined,
          hostMetadata,
          fetchedAt: Date.now(),
        };

        // Final update and cache
        setData(result);
        await saveToCache(normalizedUrl, result);
        log.log("fetch:complete", { url: normalizedUrl });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to fetch site data";
        log.error("fetch:error", { error: errorMessage });
        // Ensure async operations are cancelled on any error
        abortController.abort();
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

  return { data, isLoading, error, refetch, fetchSite, certificateInfo, progress };
}
