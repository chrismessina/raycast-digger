import { List, Icon, Color } from "@raycast/api";
import { DiggerResult } from "../types";

interface DiscoverabilityProps {
  data: DiggerResult;
}

export function Discoverability({ data }: DiscoverabilityProps) {
  const { discoverability } = data;

  const hasRobots = !!discoverability?.robots;
  const hasCanonical = !!discoverability?.canonical;
  const hasSitemap = !!discoverability?.sitemap;
  const hasRss = !!discoverability?.rss;
  const hasAtom = !!discoverability?.atom;
  const hasAlternates = discoverability?.alternates && discoverability.alternates.length > 0;

  const alternatesSection = hasAlternates
    ? discoverability
        .alternates!.map((alt) => {
          const parts = [`- **${alt.href}**`];
          if (alt.hreflang) parts.push(`(lang: ${alt.hreflang})`);
          if (alt.type) parts.push(`(type: ${alt.type})`);
          return parts.join(" ");
        })
        .join("\n")
    : "*No alternate links found*";

  const markdown = `
# Discoverability

## Meta Robots

- **Robots Meta Tag**: ${discoverability?.robots || "Not specified"} ${hasRobots ? "✓" : "✗"}

## Canonical URL

- **Canonical**: ${discoverability?.canonical || "Not specified"} ${hasCanonical ? "✓" : "✗"}

## Sitemaps

- **Sitemap**: ${discoverability?.sitemap || "Not found"} ${hasSitemap ? "✓" : "✗"}

## Feeds

- **RSS Feed**: ${discoverability?.rss || "Not found"} ${hasRss ? "✓" : "✗"}
- **Atom Feed**: ${discoverability?.atom || "Not found"} ${hasAtom ? "✓" : "✗"}

## Alternate Links ${hasAlternates ? "✓" : "✗"}

${alternatesSection}

---

### Notes

- **robots.txt**: Check manually at \`/robots.txt\`
- **sitemap.xml**: Check manually at \`/sitemap.xml\`
  `.trim();

  const getStatusIcon = (hasData: boolean) => {
    return hasData ? { source: Icon.Check, tintColor: Color.Green } : { source: Icon.Xmark, tintColor: Color.Red };
  };

  const subtitle = [hasCanonical && "Canonical", hasSitemap && "Sitemap", hasRss && "RSS", hasRobots && "Robots"]
    .filter(Boolean)
    .join(", ");

  return (
    <List.Item
      title="Discoverability"
      subtitle={subtitle || "Limited discoverability"}
      icon={getStatusIcon(hasCanonical || hasSitemap || hasRss)}
      detail={<List.Item.Detail markdown={markdown} />}
    />
  );
}
