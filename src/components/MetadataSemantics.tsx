import { List, Icon, Color } from "@raycast/api";
import { DiggerResult } from "../types";

interface MetadataSemanticsProps {
  data: DiggerResult;
}

export function MetadataSemantics({ data }: MetadataSemanticsProps) {
  const { overview, metadata, discoverability } = data;

  const hasOpenGraph = metadata?.openGraph && Object.keys(metadata.openGraph).length > 0;
  const hasTwitterCard = metadata?.twitterCard && Object.keys(metadata.twitterCard).length > 0;
  const hasJsonLd = metadata?.jsonLd && metadata.jsonLd.length > 0;

  const openGraphSection = hasOpenGraph
    ? Object.entries(metadata.openGraph!)
        .map(([key, value]) => `- **${key}**: ${value}`)
        .join("\n")
    : "*No Open Graph tags found*";

  const twitterCardSection = hasTwitterCard
    ? Object.entries(metadata.twitterCard!)
        .map(([key, value]) => `- **${key}**: ${value}`)
        .join("\n")
    : "*No Twitter Card tags found*";

  const jsonLdSection = hasJsonLd
    ? metadata
        .jsonLd!.map((item, index) => {
          return `### JSON-LD ${index + 1}\n\`\`\`json\n${JSON.stringify(item, null, 2)}\n\`\`\``;
        })
        .join("\n\n")
    : "*No JSON-LD structured data found*";

  const markdown = `
# Metadata & Semantics

## Basic Metadata

- **Title**: ${overview?.title || "N/A"} ${overview?.title ? "✓" : "✗"}
- **Description**: ${overview?.description || "N/A"} ${overview?.description ? "✓" : "✗"}
- **Canonical URL**: ${discoverability?.canonical || "N/A"} ${discoverability?.canonical ? "✓" : "✗"}
- **Language**: ${overview?.language || "N/A"} ${overview?.language ? "✓" : "✗"}

---

## Open Graph ${hasOpenGraph ? "✓" : "✗"}

${openGraphSection}

---

## Twitter Card ${hasTwitterCard ? "✓" : "✗"}

${twitterCardSection}

---

## Structured Data (JSON-LD) ${hasJsonLd ? "✓" : "✗"}

${jsonLdSection}
  `.trim();

  const getStatusIcon = (hasData: boolean) => {
    return hasData ? { source: Icon.Check, tintColor: Color.Green } : { source: Icon.Xmark, tintColor: Color.Red };
  };

  const subtitle = [
    hasOpenGraph && "OG",
    hasTwitterCard && "Twitter",
    hasJsonLd && "JSON-LD",
    overview?.title && "Title",
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <List.Item
      title="Metadata & Semantics"
      subtitle={subtitle || "No metadata found"}
      icon={getStatusIcon(hasOpenGraph || hasTwitterCard || hasJsonLd || !!overview?.title)}
      detail={<List.Item.Detail markdown={markdown} />}
    />
  );
}
