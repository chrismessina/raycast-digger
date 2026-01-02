import { getLogger } from "./logger";
import { TIMEOUTS, LIMITS } from "./config";

const log = getLogger("fetcher");

export interface FetchResult {
  response: Response;
  status: number;
  headers: Record<string, string>;
  timing: number;
  finalUrl: string;
}

export interface StreamedHeadResult {
  headHtml: string;
  status: number;
  headers: Record<string, string>;
  timing: number;
  finalUrl: string;
  truncated: boolean;
}


/**
 * Streams a response and extracts only the <head> content to minimize memory usage.
 * Stops reading once </head> is found or MAX_HEAD_BYTES is reached.
 */
export async function fetchHeadOnly(url: string, timeout: number = TIMEOUTS.HTML_FETCH): Promise<StreamedHeadResult> {
  log.log("fetchHeadOnly:start", { url, timeout });
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  const startTime = performance.now();

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
    });

    const endTime = performance.now();
    const timing = endTime - startTime;
    log.log("fetchHeadOnly:response", { status: response.status, finalUrl: response.url, timing });

    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    // Stream the response body
    const reader = response.body?.getReader();
    if (!reader) {
      log.error("fetchHeadOnly:no-reader", { url });
      throw new Error("Response body is not readable");
    }

    const decoder = new TextDecoder();
    let accumulated = "";
    let bytesRead = 0;
    let truncated = false;

    log.log("fetchHeadOnly:streaming", { url });
    while (bytesRead < LIMITS.MAX_HEAD_BYTES) {
      const { done, value } = await reader.read();

      if (done) break;

      bytesRead += value.length;
      accumulated += decoder.decode(value, { stream: true });

      // Check if we have the complete <head> section
      const headEndIndex = accumulated.toLowerCase().indexOf("</head>");
      if (headEndIndex !== -1) {
        // Found </head>, extract just what we need and stop
        log.log("fetchHeadOnly:found-head-end", { bytesRead, headEndIndex });
        accumulated = accumulated.slice(0, headEndIndex + 7); // Include </head>
        truncated = true;
        break;
      }

      // Also check for <body> as a fallback (some pages might not close head properly)
      const bodyStartIndex = accumulated.toLowerCase().indexOf("<body");
      if (bodyStartIndex !== -1) {
        log.log("fetchHeadOnly:found-body-start", { bytesRead, bodyStartIndex });
        accumulated = accumulated.slice(0, bodyStartIndex);
        truncated = true;
        break;
      }
    }

    // Cancel the reader to stop downloading
    await reader.cancel();

    // If we hit the byte limit without finding </head>, mark as truncated
    if (bytesRead >= LIMITS.MAX_HEAD_BYTES) {
      log.log("fetchHeadOnly:max-bytes-reached", { bytesRead, maxBytes: LIMITS.MAX_HEAD_BYTES });
      truncated = true;
    }

    log.log("fetchHeadOnly:complete", { url, bytesRead, truncated, htmlLength: accumulated.length });
    return {
      headHtml: accumulated,
      status: response.status,
      headers,
      timing,
      finalUrl: response.url,
      truncated,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      log.error("fetchHeadOnly:timeout", { url, timeout });
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    log.error("fetchHeadOnly:error", { url, error: error instanceof Error ? error.message : String(error) });
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Attempts to fetch with HTTPS first, falls back to HTTP if HTTPS fails.
 * This handles sites that don't support SSL/TLS.
 */
export async function fetchHeadOnlyWithFallback(url: string, timeout: number = TIMEOUTS.HTML_FETCH): Promise<StreamedHeadResult> {
  const urlObj = new URL(url);
  
  // If explicitly using http://, don't try https first
  if (urlObj.protocol === "http:") {
    log.log("fetchHeadOnlyWithFallback:http-explicit", { url });
    return fetchHeadOnly(url, timeout);
  }
  
  // Try HTTPS first
  try {
    return await fetchHeadOnly(url, timeout);
  } catch (httpsError) {
    // If HTTPS failed, try HTTP as fallback
    const httpUrl = url.replace(/^https:\/\//i, "http://");
    log.log("fetchHeadOnlyWithFallback:https-failed-trying-http", { 
      originalUrl: url, 
      httpUrl,
      error: httpsError instanceof Error ? httpsError.message : String(httpsError)
    });
    
    try {
      const result = await fetchHeadOnly(httpUrl, timeout);
      log.log("fetchHeadOnlyWithFallback:http-success", { httpUrl });
      return result;
    } catch (httpError) {
      // Both failed, throw the original HTTPS error
      log.error("fetchHeadOnlyWithFallback:both-failed", { 
        url,
        httpsError: httpsError instanceof Error ? httpsError.message : String(httpsError),
        httpError: httpError instanceof Error ? httpError.message : String(httpError)
      });
      throw httpsError;
    }
  }
}

export async function fetchWithTimeout(url: string, timeout: number = TIMEOUTS.RESOURCE_FETCH): Promise<FetchResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  const startTime = performance.now();

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
    });

    const endTime = performance.now();
    const timing = endTime - startTime;

    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    return {
      response,
      status: response.status,
      headers,
      timing,
      finalUrl: response.url,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
