import { useState, useCallback } from "react";
import { showToast, Toast } from "@raycast/api";
import { fetchWithTimeout } from "../utils/fetcher";
import { normalizeUrl } from "../utils/urlUtils";
import { useCache } from "./useCache";
import { DiggerResult, OverviewData, MetadataData, DiscoverabilityData } from "../types";
import { getMetaContent, getLinkHref, getJsonLd, getAllMeta } from "../utils/htmlParser";
import * as cheerio from "cheerio";

export function useFetchSite(url: string) {
  const [data, setData] = useState<DiggerResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
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
        const html = await response.text();
        const $ = cheerio.load(html);

        const overview: OverviewData = {
          title: $("title").text() || undefined,
          description: getMetaContent(html, "description"),
          language: $("html").attr("lang"),
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

        const metadata: MetadataData = {
          openGraph: Object.keys(openGraph).length > 0 ? openGraph : undefined,
          twitterCard: Object.keys(twitterCard).length > 0 ? twitterCard : undefined,
          jsonLd: getJsonLd(html),
          metaTags: getAllMeta(html),
        };

        const discoverability: DiscoverabilityData = {
          robots: getMetaContent(html, "robots"),
          canonical: getLinkHref(html, "canonical"),
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

        const rssLink = getLinkHref(html, "alternate");
        if (rssLink) {
          discoverability.rss = rssLink;
        }

        const stylesheets: Array<{ href: string; media?: string }> = [];
        $('link[rel="stylesheet"]').each((_, el) => {
          const href = $(el).attr("href");
          if (href) {
            stylesheets.push({
              href,
              media: $(el).attr("media"),
            });
          }
        });

        const scripts: Array<{ src: string; async?: boolean; defer?: boolean; type?: string }> = [];
        $("script[src]").each((_, el) => {
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
        $("img[src]").each((_, el) => {
          const src = $(el).attr("src");
          if (src) {
            images.push({
              src,
              alt: $(el).attr("alt"),
            });
          }
        });

        const links: Array<{ href: string; rel?: string }> = [];
        $('link[rel]:not([rel="stylesheet"]):not([rel="alternate"])').each((_, el) => {
          const href = $(el).attr("href");
          if (href) {
            links.push({
              href,
              rel: $(el).attr("rel"),
            });
          }
        });

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
          performance: {
            loadTime: timing,
            pageSize: html.length,
          },
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

  return { data, isLoading, error, refetch, fetchSite };
}
