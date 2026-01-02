import { List, Icon, Color } from "@raycast/api";
import { getProgressIcon } from "@raycast/utils";
import { DiggerResult } from "../types";
import { Actions } from "../actions";
import { truncateText } from "../utils/formatters";

interface DataFeedsAPIProps {
  data: DiggerResult | null;
  onRefresh: () => void;
  progress: number;
}

export function DataFeedsAPI({ data, onRefresh, progress }: DataFeedsAPIProps) {
  if (!data) {
    return (
      <List.Item
        title="Data Feeds & API"
        icon={progress < 1 ? getProgressIcon(progress, Color.Blue) : Icon.Plug}
        detail={
          <List.Item.Detail
            metadata={
              <List.Item.Detail.Metadata>
                <List.Item.Detail.Metadata.Label title="Discovering feeds..." />
                <List.Item.Detail.Metadata.Label title="" text="Looking for RSS, Atom, and JSON feeds" />
              </List.Item.Detail.Metadata>
            }
          />
        }
      />
    );
  }

  const { dataFeeds, metadata } = data;

  const hasJsonLd = !!(metadata?.jsonLd && metadata.jsonLd.length > 0);

  const feedCount = (dataFeeds?.rss?.length || 0) + (dataFeeds?.atom?.length || 0) + (dataFeeds?.json?.length || 0);

  const subtitle = buildSubtitle(feedCount, hasJsonLd);

  return (
    <List.Item
      title="Data Feeds & API"
      subtitle={subtitle}
      icon={progress < 1 ? getProgressIcon(progress, Color.Blue) : Icon.Plug}
      detail={<DataFeedsAPIDetail data={data} hasJsonLd={hasJsonLd} />}
      actions={<Actions data={data} url={data.url} onRefresh={onRefresh} />}
    />
  );
}

function buildSubtitle(feedCount: number, hasJsonLd: boolean): string {
  const parts: string[] = [];

  if (feedCount > 0) {
    parts.push(`${feedCount} ${feedCount === 1 ? "feed" : "feeds"}`);
  }

  if (hasJsonLd) {
    parts.push("JSON-LD");
  }

  return parts.join(", ") || "No feeds or API detected";
}

interface DataFeedsAPIDetailProps {
  data: DiggerResult;
  hasJsonLd: boolean;
}

function DataFeedsAPIDetail({ data, hasJsonLd }: DataFeedsAPIDetailProps) {
  const { dataFeeds, metadata } = data;

  return (
    <List.Item.Detail
      metadata={
        <List.Item.Detail.Metadata>
          <List.Item.Detail.Metadata.Label
            title="RSS Feeds"
            icon={
              dataFeeds?.rss?.length
                ? { source: Icon.Check, tintColor: Color.Green }
                : { source: Icon.Xmark, tintColor: Color.Red }
            }
          />
          {dataFeeds?.rss?.length ? (
            dataFeeds.rss
              .slice(0, 3)
              .map((feed, index) => (
                <List.Item.Detail.Metadata.Link
                  key={index}
                  title={feed.title || "RSS Feed"}
                  target={feed.url}
                  text={truncateText(feed.url, 50)}
                />
              ))
          ) : (
            <List.Item.Detail.Metadata.Label title="" text="No RSS feeds found" />
          )}

          <List.Item.Detail.Metadata.Separator />
          <List.Item.Detail.Metadata.Label
            title="Atom Feeds"
            icon={
              dataFeeds?.atom?.length
                ? { source: Icon.Check, tintColor: Color.Green }
                : { source: Icon.Xmark, tintColor: Color.Red }
            }
          />
          {dataFeeds?.atom?.length ? (
            dataFeeds.atom
              .slice(0, 3)
              .map((feed, index) => (
                <List.Item.Detail.Metadata.Link
                  key={index}
                  title={feed.title || "Atom Feed"}
                  target={feed.url}
                  text={truncateText(feed.url, 50)}
                />
              ))
          ) : (
            <List.Item.Detail.Metadata.Label title="" text="No Atom feeds found" />
          )}

          <List.Item.Detail.Metadata.Separator />
          <List.Item.Detail.Metadata.Label
            title="JSON Feeds"
            icon={
              dataFeeds?.json?.length
                ? { source: Icon.Check, tintColor: Color.Green }
                : { source: Icon.Xmark, tintColor: Color.Red }
            }
          />
          {dataFeeds?.json?.length ? (
            dataFeeds.json
              .slice(0, 3)
              .map((feed, index) => (
                <List.Item.Detail.Metadata.Link
                  key={index}
                  title={feed.title || "JSON Feed"}
                  target={feed.url}
                  text={truncateText(feed.url, 50)}
                />
              ))
          ) : (
            <List.Item.Detail.Metadata.Label title="" text="No JSON feeds found" />
          )}

          <List.Item.Detail.Metadata.Separator />
          <List.Item.Detail.Metadata.Label
            title="JSON-LD Structured Data"
            icon={
              hasJsonLd ? { source: Icon.Check, tintColor: Color.Green } : { source: Icon.Xmark, tintColor: Color.Red }
            }
          />
          {hasJsonLd ? (
            metadata!.jsonLd!.slice(0, 3).map((ld, index) => {
              const type = ld["@type"] as string | string[] | undefined;
              const typeStr = Array.isArray(type) ? type.join(", ") : type || "Unknown";
              return <List.Item.Detail.Metadata.Label key={index} title={`Type ${index + 1}`} text={typeStr} />;
            })
          ) : (
            <List.Item.Detail.Metadata.Label title="" text="No JSON-LD data found" />
          )}
          {hasJsonLd && metadata!.jsonLd!.length > 3 && (
            <List.Item.Detail.Metadata.Label title="" text={`...and ${metadata!.jsonLd!.length - 3} more`} />
          )}
        </List.Item.Detail.Metadata>
      }
    />
  );
}
