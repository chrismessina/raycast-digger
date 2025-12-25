import { List, Icon, Color } from "@raycast/api";
import { DiggerResult } from "../types";

interface ResourcesAssetsProps {
  data: DiggerResult;
}

export function ResourcesAssets({ data }: ResourcesAssetsProps) {
  const { resources, discoverability } = data;

  const hasStylesheets = resources?.stylesheets && resources.stylesheets.length > 0;
  const hasScripts = resources?.scripts && resources.scripts.length > 0;
  const hasImages = resources?.images && resources.images.length > 0;
  const hasLinks = resources?.links && resources.links.length > 0;
  const hasRss = !!discoverability?.rss;
  const hasAtom = !!discoverability?.atom;

  const stylesheetsSection = hasStylesheets
    ? resources
        .stylesheets!.slice(0, 10)
        .map((sheet) => `- ${sheet.href}${sheet.media ? ` (media: ${sheet.media})` : ""}`)
        .join("\n") +
      (resources.stylesheets!.length > 10 ? `\n\n*...and ${resources.stylesheets!.length - 10} more*` : "")
    : "*No stylesheets found*";

  const scriptsSection = hasScripts
    ? resources
        .scripts!.slice(0, 10)
        .map((script) => {
          const attrs = [];
          if (script.async) attrs.push("async");
          if (script.defer) attrs.push("defer");
          if (script.type) attrs.push(`type: ${script.type}`);
          return `- ${script.src}${attrs.length > 0 ? ` (${attrs.join(", ")})` : ""}`;
        })
        .join("\n") + (resources.scripts!.length > 10 ? `\n\n*...and ${resources.scripts!.length - 10} more*` : "")
    : "*No scripts found*";

  const imagesSection = hasImages
    ? resources
        .images!.slice(0, 10)
        .map((img) => `- ${img.src}${img.alt ? ` (alt: "${img.alt}")` : ""}`)
        .join("\n") + (resources.images!.length > 10 ? `\n\n*...and ${resources.images!.length - 10} more*` : "")
    : "*No images found*";

  const linksSection = hasLinks
    ? resources
        .links!.slice(0, 10)
        .map((link) => `- ${link.href}${link.rel ? ` (rel: ${link.rel})` : ""}`)
        .join("\n") + (resources.links!.length > 10 ? `\n\n*...and ${resources.links!.length - 10} more*` : "")
    : "*No special links found*";

  const markdown = `
# Resources & Assets

## Stylesheets ${hasStylesheets ? `(${resources.stylesheets!.length})` : ""}

${stylesheetsSection}

---

## Scripts ${hasScripts ? `(${resources.scripts!.length})` : ""}

${scriptsSection}

---

## Images ${hasImages ? `(${resources.images!.length})` : ""}

${imagesSection}

---

## Special Links ${hasLinks ? `(${resources.links!.length})` : ""}

${linksSection}

---

## Feeds

- **RSS**: ${discoverability?.rss || "Not found"} ${hasRss ? "✓" : "✗"}
- **Atom**: ${discoverability?.atom || "Not found"} ${hasAtom ? "✓" : "✗"}
  `.trim();

  const getStatusIcon = (hasData: boolean) => {
    return hasData ? { source: Icon.Check, tintColor: Color.Green } : { source: Icon.Xmark, tintColor: Color.Red };
  };

  const counts = [];
  if (hasStylesheets) counts.push(`${resources.stylesheets!.length} CSS`);
  if (hasScripts) counts.push(`${resources.scripts!.length} JS`);
  if (hasImages) counts.push(`${resources.images!.length} Images`);

  return (
    <List.Item
      title="Resources & Assets"
      subtitle={counts.join(", ") || "No resources found"}
      icon={getStatusIcon(hasStylesheets || hasScripts || hasImages)}
      detail={<List.Item.Detail markdown={markdown} />}
    />
  );
}
