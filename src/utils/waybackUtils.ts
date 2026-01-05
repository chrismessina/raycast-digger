import { HistoryData } from "../types";
import { getLogger } from "./logger";

const log = getLogger("wayback");
const ARCHIVE_BASE_URL = "https://archive.org";
const WAYBACK_BASE_URL = "https://web.archive.org";

export async function fetchWaybackMachineData(url: string): Promise<HistoryData | undefined> {
  try {
    log.log("wayback:start", { url });

    // First check if any snapshots exist
    const apiUrl = `${ARCHIVE_BASE_URL}/wayback/available?url=${encodeURIComponent(url)}`;
    const response = await fetch(apiUrl);

    // Check for rate limiting (429) or server errors
    if (response.status === 429) {
      log.warn("wayback:rate-limited", { url, status: response.status });
      return {
        rateLimited: true,
        archiveUrl: `${WAYBACK_BASE_URL}/web/*/${url}`,
      };
    }

    if (!response.ok) {
      log.warn("wayback:error", { url, status: response.status });
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

    // If the availability API says no snapshots, trust it
    if (!data.archived_snapshots?.closest) {
      return undefined;
    }

    // Get total snapshot count from CDX API (no limit to get all snapshots)
    const cdxCountUrl = `${WAYBACK_BASE_URL}/cdx/search/cdx?url=${encodeURIComponent(url)}&output=json&fl=timestamp&collapse=timestamp:8`;
    const cdxCountResponse = await fetch(cdxCountUrl);

    let snapshotCount = 0;
    let firstTimestamp: string | undefined;
    let lastTimestamp: string | undefined;
    let rateLimited = false;

    // Check for rate limiting on CDX API
    if (cdxCountResponse.status === 429) {
      log.warn("wayback:cdx-rate-limited", { url, status: cdxCountResponse.status });
      rateLimited = true;
    } else if (cdxCountResponse.ok) {
      const cdxData = await cdxCountResponse.json();
      if (Array.isArray(cdxData) && cdxData.length > 1) {
        // First row is header, so subtract 1
        snapshotCount = Math.max(0, cdxData.length - 1);

        if (snapshotCount > 0) {
          // Get first snapshot (index 1, after header)
          firstTimestamp = cdxData[1]?.[0];
          // Get last snapshot (last item in array)
          lastTimestamp = cdxData[cdxData.length - 1]?.[0];
        }
      } else if (Array.isArray(cdxData) && cdxData.length <= 1) {
        // CDX returned empty or header-only - likely rate limited
        // The availability API confirmed snapshots exist, so this is suspicious
        log.warn("wayback:cdx-empty-suspicious", { url, cdxLength: cdxData.length });
        rateLimited = true;
      }
    } else {
      // Non-OK response that's not 429 - treat as potential rate limiting
      log.warn("wayback:cdx-error", { url, status: cdxCountResponse.status });
      rateLimited = true;
    }

    const result: HistoryData = {
      waybackMachineSnapshots: snapshotCount,
      firstSeen: firstTimestamp ? formatWaybackDate(firstTimestamp) : undefined,
      lastSeen: lastTimestamp ? formatWaybackDate(lastTimestamp) : undefined,
      archiveUrl: `${WAYBACK_BASE_URL}/web/*/${url}`,
      rateLimited,
    };
    log.log("wayback:success", {
      url,
      snapshotCount,
      firstSeen: result.firstSeen,
      lastSeen: result.lastSeen,
      rateLimited,
    });
    return result;
  } catch (err) {
    log.warn("wayback:error", { url, error: err instanceof Error ? err.message : String(err) });
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
