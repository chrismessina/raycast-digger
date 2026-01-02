import { List, Icon, Color } from "@raycast/api";
import { getProgressIcon } from "@raycast/utils";
import { DiggerResult } from "../types";
import { Actions } from "../actions";
import { truncateText } from "../utils/formatters";

interface ResourcesAssetsProps {
  data: DiggerResult | null;
  onRefresh: () => void;
  progress: number;
}

export function ResourcesAssets({ data, onRefresh, progress }: ResourcesAssetsProps) {
  // Show progress icon until this section is complete
  const isLoading = progress < 1;

  if (!data) {
    return (
      <List.Item
        title="Resources & Assets"
        icon={isLoading ? getProgressIcon(progress, Color.Blue) : Icon.Code}
        detail={
          <List.Item.Detail
            metadata={
              <List.Item.Detail.Metadata>
                <List.Item.Detail.Metadata.Label title="Scanning resources..." />
                <List.Item.Detail.Metadata.Label title="" text="Finding stylesheets, scripts, and images" />
              </List.Item.Detail.Metadata>
            }
          />
        }
      />
    );
  }

  const { resources } = data;

  const hasStylesheets = !!(resources?.stylesheets && resources.stylesheets.length > 0);
  const hasScripts = !!(resources?.scripts && resources.scripts.length > 0);
  const hasImages = !!(resources?.images && resources.images.length > 0);
  const hasResources = hasStylesheets || hasScripts || hasImages;

  const counts = [];
  if (hasStylesheets) counts.push(`${resources!.stylesheets!.length} CSS`);
  if (hasScripts) counts.push(`${resources!.scripts!.length} JS`);
  if (hasImages) counts.push(`${resources!.images!.length} Images`);

  // Show progress icon while loading, then show document icon
  const listIcon = isLoading ? getProgressIcon(progress, Color.Blue) : Icon.Code;

  return (
    <List.Item
      title="Resources & Assets"
      icon={listIcon}
      accessories={hasResources ? [{ icon: { source: Icon.Check, tintColor: Color.Green } }] : undefined}
      detail={
        <ResourcesAssetsDetail
          data={data}
          hasStylesheets={hasStylesheets}
          hasScripts={hasScripts}
          hasImages={hasImages}
        />
      }
      actions={<Actions data={data} url={data.url} onRefresh={onRefresh} />}
    />
  );
}

interface ResourcesAssetsDetailProps {
  data: DiggerResult;
  hasStylesheets: boolean;
  hasScripts: boolean;
  hasImages: boolean;
}

function ResourcesAssetsDetail({ data, hasStylesheets, hasScripts, hasImages }: ResourcesAssetsDetailProps) {
  const { resources } = data;

  return (
    <List.Item.Detail
      metadata={
        <List.Item.Detail.Metadata>
          <List.Item.Detail.Metadata.Label
            title={`Stylesheets${hasStylesheets ? ` (${resources!.stylesheets!.length})` : ""}`}
            icon={
              hasStylesheets
                ? { source: Icon.Check, tintColor: Color.Green }
                : { source: Icon.Xmark, tintColor: Color.Red }
            }
          />
          {hasStylesheets &&
            resources!
              .stylesheets!.slice(0, 5)
              .map((sheet, index) => (
                <List.Item.Detail.Metadata.Link
                  key={index}
                  title={sheet.media || "all"}
                  target={sheet.href}
                  text={truncateText(sheet.href, 50)}
                />
              ))}
          {hasStylesheets && resources!.stylesheets!.length > 5 && (
            <List.Item.Detail.Metadata.Label title="" text={`...and ${resources!.stylesheets!.length - 5} more`} />
          )}
          {!hasStylesheets && <List.Item.Detail.Metadata.Label title="" text="No stylesheets found" />}

          <List.Item.Detail.Metadata.Separator />
          <List.Item.Detail.Metadata.Label
            title={`Scripts${hasScripts ? ` (${resources!.scripts!.length})` : ""}`}
            icon={
              hasScripts ? { source: Icon.Check, tintColor: Color.Green } : { source: Icon.Xmark, tintColor: Color.Red }
            }
          />
          {hasScripts &&
            resources!.scripts!.slice(0, 5).map((script, index) => {
              const attrs = [];
              if (script.async) attrs.push("async");
              if (script.defer) attrs.push("defer");
              return (
                <List.Item.Detail.Metadata.Link
                  key={index}
                  title={attrs.length > 0 ? attrs.join(", ") : "sync"}
                  target={script.src}
                  text={truncateText(script.src, 50)}
                />
              );
            })}
          {hasScripts && resources!.scripts!.length > 5 && (
            <List.Item.Detail.Metadata.Label title="" text={`...and ${resources!.scripts!.length - 5} more`} />
          )}
          {!hasScripts && <List.Item.Detail.Metadata.Label title="" text="No scripts found" />}

          <List.Item.Detail.Metadata.Separator />
          <List.Item.Detail.Metadata.Label
            title={`Images${hasImages ? ` (${resources!.images!.length})` : ""}`}
            icon={
              hasImages ? { source: Icon.Check, tintColor: Color.Green } : { source: Icon.Xmark, tintColor: Color.Red }
            }
          />
          {hasImages &&
            resources!
              .images!.slice(0, 5)
              .map((img, index) => (
                <List.Item.Detail.Metadata.Link
                  key={index}
                  title={img.alt ? truncateText(img.alt, 20) : "No alt"}
                  target={img.src}
                  text={truncateText(img.src, 50)}
                />
              ))}
          {hasImages && resources!.images!.length > 5 && (
            <List.Item.Detail.Metadata.Label title="" text={`...and ${resources!.images!.length - 5} more`} />
          )}
          {!hasImages && <List.Item.Detail.Metadata.Label title="" text="No images found" />}
        </List.Item.Detail.Metadata>
      }
    />
  );
}
