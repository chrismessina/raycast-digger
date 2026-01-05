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
export async function fetchHeadOnly(
  url: string,
  timeout: number = TIMEOUTS.HTML_FETCH,
  externalSignal?: AbortSignal,
): Promise<StreamedHeadResult> {
  log.log("fetchHeadOnly:start", { url, timeout });
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  // Link external signal to our controller
  if (externalSignal) {
    if (externalSignal.aborted) {
      log.log("fetchHeadOnly:external-signal-already-aborted", { url });
      throw new Error("Fetch aborted");
    }
    externalSignal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  const startTime = performance.now();

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        // Disable compression to avoid V8 RegExpCompiler crashes in Raycast's
        // memory-constrained worker. The decompression code path in Node.js
        // can trigger V8 memory allocation failures on certain sites.
        "Accept-Encoding": "identity",
      },
    });

    const endTime = performance.now();
    const timing = endTime - startTime;
    log.log("fetchHeadOnly:response", { status: response.status, finalUrl: response.url, timing });

    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    // Use response.text() instead of streaming to avoid V8 RegExp memory issues
    // that can occur with certain sites during stream reading
    log.log("fetchHeadOnly:fetching-text", { url });
    const fullText = await response.text();
    log.log("fetchHeadOnly:text-received", { url, length: fullText.length });

    let accumulated = fullText;
    let truncated = false;

    // Extract just the head section
    let headEndIndex = accumulated.indexOf("</head>");
    if (headEndIndex === -1) headEndIndex = accumulated.indexOf("</HEAD>");
    if (headEndIndex === -1) headEndIndex = accumulated.indexOf("</Head>");

    if (headEndIndex !== -1) {
      log.log("fetchHeadOnly:found-head-end", { headEndIndex });
      accumulated = accumulated.slice(0, headEndIndex + 7); // Include </head>
      truncated = true;
    } else {
      // Check for <body> as a fallback
      let bodyStartIndex = accumulated.indexOf("<body");
      if (bodyStartIndex === -1) bodyStartIndex = accumulated.indexOf("<BODY");
      if (bodyStartIndex === -1) bodyStartIndex = accumulated.indexOf("<Body");

      if (bodyStartIndex !== -1) {
        log.log("fetchHeadOnly:found-body-start", { bodyStartIndex });
        accumulated = accumulated.slice(0, bodyStartIndex);
        truncated = true;
      } else if (accumulated.length > LIMITS.MAX_HEAD_BYTES) {
        // Truncate if too large
        log.log("fetchHeadOnly:truncating", { originalLength: accumulated.length, maxBytes: LIMITS.MAX_HEAD_BYTES });
        accumulated = accumulated.slice(0, LIMITS.MAX_HEAD_BYTES);
        truncated = true;
      }
    }

    log.log("fetchHeadOnly:complete", { url, truncated, htmlLength: accumulated.length });
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
      // Check if this was an external abort or a timeout
      if (externalSignal?.aborted) {
        log.log("fetchHeadOnly:aborted", { url });
        throw new Error("Fetch aborted");
      }
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
export async function fetchHeadOnlyWithFallback(
  url: string,
  timeout: number = TIMEOUTS.HTML_FETCH,
  signal?: AbortSignal,
): Promise<StreamedHeadResult> {
  const urlObj = new URL(url);

  // If explicitly using http://, don't try https first
  if (urlObj.protocol === "http:") {
    log.log("fetchHeadOnlyWithFallback:http-explicit", { url });
    return fetchHeadOnly(url, timeout, signal);
  }

  // Try HTTPS first
  try {
    return await fetchHeadOnly(url, timeout, signal);
  } catch (httpsError) {
    // If HTTPS failed, try HTTP as fallback
    const httpUrl = url.replace(/^https:\/\//i, "http://");
    log.log("fetchHeadOnlyWithFallback:https-failed-trying-http", {
      originalUrl: url,
      httpUrl,
      error: httpsError instanceof Error ? httpsError.message : String(httpsError),
    });

    try {
      const result = await fetchHeadOnly(httpUrl, timeout, signal);
      log.log("fetchHeadOnlyWithFallback:http-success", { httpUrl });
      return result;
    } catch (httpError) {
      // Both failed, throw the original HTTPS error
      log.error("fetchHeadOnlyWithFallback:both-failed", {
        url,
        httpsError: httpsError instanceof Error ? httpsError.message : String(httpsError),
        httpError: httpError instanceof Error ? httpError.message : String(httpError),
      });
      throw httpsError;
    }
  }
}

export interface TextResourceResult {
  exists: boolean;
  content?: string;
  contentType?: string;
  status: number;
  isSoft404: boolean;
}

/**
 * Validates if a response is a genuine text resource (not a soft 404 HTML page).
 * Checks Content-Type header and content for HTML markers.
 */
function isValidTextResource(contentType: string | undefined, content: string): boolean {
  // Check Content-Type - should be text/plain for robots.txt, llms.txt, etc.
  // Some servers may return application/octet-stream or no content-type
  if (contentType) {
    const lowerContentType = contentType.toLowerCase();
    // If explicitly HTML, it's a soft 404
    if (lowerContentType.includes("text/html") || lowerContentType.includes("application/xhtml")) {
      return false;
    }
  }

  // Check content for HTML markers (case-insensitive)
  const trimmedContent = content.trim().toLowerCase();

  // Common HTML document markers
  if (
    trimmedContent.startsWith("<!doctype") ||
    trimmedContent.startsWith("<html") ||
    trimmedContent.startsWith("<head") ||
    trimmedContent.startsWith("<body") ||
    trimmedContent.startsWith("<?xml") // XHTML
  ) {
    return false;
  }

  // Check for HTML tags anywhere in the first 500 chars (some soft 404s may have whitespace first)
  const firstChunk = trimmedContent.slice(0, 500);
  if (/<html[\s>]/i.test(firstChunk) || /<head[\s>]/i.test(firstChunk) || /<body[\s>]/i.test(firstChunk)) {
    return false;
  }

  return true;
}

/**
 * Fetches a text resource (like robots.txt or llms.txt) and validates it's not a soft 404.
 * Returns the content if valid, or marks it as a soft 404 if HTML is returned.
 */
export async function fetchTextResource(
  url: string,
  timeout: number = TIMEOUTS.RESOURCE_FETCH,
): Promise<TextResourceResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        // Disable compression to avoid V8 RegExpCompiler crashes
        "Accept-Encoding": "identity",
      },
    });

    const contentType = response.headers.get("content-type") || undefined;

    // If not a 2xx status, resource doesn't exist
    if (response.status < 200 || response.status >= 300) {
      return {
        exists: false,
        status: response.status,
        contentType,
        isSoft404: false,
      };
    }

    // Read the content to validate it
    const content = await response.text();

    // Validate it's actually a text resource, not an HTML soft 404
    const isValid = isValidTextResource(contentType, content);

    if (!isValid) {
      log.log("fetchTextResource:soft404-detected", {
        url,
        contentType,
        contentPreview: content.slice(0, 100),
      });
    }

    return {
      exists: isValid,
      content: isValid ? content : undefined,
      contentType,
      status: response.status,
      isSoft404: !isValid,
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

export async function fetchWithTimeout(url: string, timeout: number = TIMEOUTS.RESOURCE_FETCH): Promise<FetchResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  const startTime = performance.now();

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        // Disable compression to avoid V8 RegExpCompiler crashes
        "Accept-Encoding": "identity",
      },
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
