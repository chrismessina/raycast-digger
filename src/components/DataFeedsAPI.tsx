import { List, Icon, Color } from "@raycast/api";
import { DiggerResult } from "../types";
import { Actions } from "../actions";

interface DataFeedsAPIProps {
  data: DiggerResult;
  onRefresh: () => void;
}

export function DataFeedsAPI({ data, onRefresh }: DataFeedsAPIProps) {
  const { dataFeeds, metadata, discoverability } = data;

  const hasFeeds =
    (dataFeeds?.rss && dataFeeds.rss.length > 0) ||
    (dataFeeds?.atom && dataFeeds.atom.length > 0) ||
    (dataFeeds?.json && dataFeeds.json.length > 0);

  const hasJsonLd = !!(metadata?.jsonLd && metadata.jsonLd.length > 0);
  const hasApiHints = discoverability?.alternates?.some((alt) => alt.type?.includes("json") || alt.type?.includes("api")) ?? false;

  if (!hasFeeds && !hasJsonLd && !hasApiHints) {
    return (
      <List.Item
        title="Data Feeds & API"
        subtitle="No feeds or API endpoints detected"
        icon={{ source: Icon.Code, tintColor: Color.SecondaryText }}
        detail={
          <List.Item.Detail
            markdown={`
# Data Feeds & API

No RSS/Atom feeds, JSON-LD data, or API endpoints were detected on this page.

This site may not expose structured data feeds or public APIs.
            `.trim()}
          />
        }
        actions={<Actions data={data} url={data.url} onRefresh={onRefresh} />}
      />
    );
  }

  const markdown = buildMarkdown(data);
  const subtitle = buildSubtitle(dataFeeds, hasJsonLd);

  return (
    <List.Item
      title="Data Feeds & API"
      subtitle={subtitle}
      icon={{ source: Icon.Code, tintColor: Color.Green }}
      detail={<List.Item.Detail markdown={markdown} />}
      actions={<Actions data={data} url={data.url} onRefresh={onRefresh} />}
    />
  );
}

function buildMarkdown(data: DiggerResult): string {
  const { dataFeeds, metadata, discoverability } = data;
  const sections: string[] = ["# Data Feeds & API\n"];

  // RSS Feeds
  if (dataFeeds?.rss && dataFeeds.rss.length > 0) {
    sections.push("## RSS Feeds\n");
    dataFeeds.rss.forEach((feed) => {
      sections.push(`- **[${feed.title || "RSS Feed"}](${feed.url})**`);
    });
    sections.push("");
  }

  // Atom Feeds
  if (dataFeeds?.atom && dataFeeds.atom.length > 0) {
    sections.push("## Atom Feeds\n");
    dataFeeds.atom.forEach((feed) => {
      sections.push(`- **[${feed.title || "Atom Feed"}](${feed.url})**`);
    });
    sections.push("");
  }

  // JSON Feeds
  if (dataFeeds?.json && dataFeeds.json.length > 0) {
    sections.push("## JSON Feeds\n");
    dataFeeds.json.forEach((feed) => {
      sections.push(`- **[${feed.title || "JSON Feed"}](${feed.url})**`);
    });
    sections.push("");
  }

  // JSON-LD Structured Data
  if (metadata?.jsonLd && metadata.jsonLd.length > 0) {
    sections.push("## JSON-LD Structured Data\n");
    sections.push(`Found ${metadata.jsonLd.length} JSON-LD ${metadata.jsonLd.length === 1 ? "block" : "blocks"}:\n`);

    metadata.jsonLd.forEach((ld, index) => {
      const type = ld["@type"] || "Unknown";
      const context = ld["@context"] || "";

      sections.push(`### ${index + 1}. ${Array.isArray(type) ? type.join(", ") : type}\n`);

      if (context) {
        sections.push(`- **Context**: \`${context}\``);
      }

      // Show key properties
      const keys = Object.keys(ld).filter((k) => k !== "@type" && k !== "@context");
      if (keys.length > 0) {
        sections.push("- **Properties**:");
        keys.slice(0, 5).forEach((key) => {
          const value = ld[key];
          const displayValue = typeof value === "string" ? value : JSON.stringify(value);
          sections.push(`  - \`${key}\`: ${displayValue.length > 100 ? displayValue.substring(0, 100) + "..." : displayValue}`);
        });
        if (keys.length > 5) {
          sections.push(`  - *...and ${keys.length - 5} more properties*`);
        }
      }
      sections.push("");
    });
  }

  // API Discovery Hints
  const apiAlternates = discoverability?.alternates?.filter(
    (alt) => alt.type?.includes("json") || alt.type?.includes("api")
  );

  if (apiAlternates && apiAlternates.length > 0) {
    sections.push("## API Discovery\n");
    apiAlternates.forEach((alt) => {
      const label = alt.type || "API Endpoint";
      sections.push(`- **[${label}](${alt.href})**`);
    });
    sections.push("");
  }

  // Check for common API patterns in links
  const apiPatterns = ["/api/", "/graphql", "/swagger", "/openapi", "/.well-known/"];
  const potentialApis = data.resources?.links?.filter((link) =>
    apiPatterns.some((pattern) => link.href.toLowerCase().includes(pattern))
  );

  if (potentialApis && potentialApis.length > 0) {
    sections.push("## Potential API Endpoints\n");
    const uniqueUrls = [...new Set(potentialApis.map((link) => link.href))];
    uniqueUrls.slice(0, 10).forEach((url) => {
      const type = getApiType(url);
      sections.push(`- **[${type}](${url})**`);
    });
    if (uniqueUrls.length > 10) {
      sections.push(`\n*...and ${uniqueUrls.length - 10} more potential endpoints*`);
    }
  }

  return sections.join("\n").trim();
}

function buildSubtitle(dataFeeds: DiggerResult["dataFeeds"], hasJsonLd: boolean): string {
  const parts: string[] = [];

  const feedCount =
    (dataFeeds?.rss?.length || 0) + (dataFeeds?.atom?.length || 0) + (dataFeeds?.json?.length || 0);

  if (feedCount > 0) {
    parts.push(`${feedCount} ${feedCount === 1 ? "feed" : "feeds"}`);
  }

  if (hasJsonLd) {
    parts.push("JSON-LD");
  }

  return parts.join(", ") || "Available";
}

function getApiType(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes("/graphql")) return "GraphQL Endpoint";
  if (lower.includes("/swagger")) return "Swagger Documentation";
  if (lower.includes("/openapi")) return "OpenAPI Specification";
  if (lower.includes("/.well-known/")) return "Well-Known URI";
  if (lower.includes("/api/")) return "API Endpoint";
  return "API Resource";
}
