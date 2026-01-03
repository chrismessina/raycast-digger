import { List, Icon, Color } from "@raycast/api";
import { getProgressIcon } from "@raycast/utils";
import { getFavicon } from "../utils/favicon";
import { DiggerResult } from "../types";
import { Actions } from "../actions";
import { formatBytes, getStatusText } from "../utils/formatters";

interface OverviewProps {
  data: DiggerResult | null;
  onRefresh: () => void;
  overallProgress: number;
}

export function Overview({ data, onRefresh, overallProgress }: OverviewProps) {
  // Show favicon once data is available, otherwise show progress
  const isStillLoading = overallProgress < 1 && !data;
  const favicon = data?.url ? getFavicon(data.url) : null;
  const progressIcon = isStillLoading ? getProgressIcon(overallProgress, Color.Blue) : favicon ?? Icon.Globe;

  if (!data) {
    return (
      <List.Item
        title="Overview"
        icon={progressIcon}
        detail={
          <List.Item.Detail
            metadata={
              <List.Item.Detail.Metadata>
                <List.Item.Detail.Metadata.Label title="Loading site data..." />
                <List.Item.Detail.Metadata.Label
                  title=""
                  text="Fetching HTML, parsing metadata, and analyzing content"
                />
              </List.Item.Detail.Metadata>
            }
          />
        }
      />
    );
  }

  const { overview, networking } = data;

  const statusCode = networking?.statusCode;
  const statusText = statusCode ? `${statusCode} ${getStatusText(statusCode)}` : "Unknown";
  const contentType = networking?.headers?.["content-type"] || "Unknown";
  const contentLength = networking?.headers?.["content-length"]
    ? formatBytes(parseInt(networking.headers["content-length"]))
    : "Unknown";
  const finalUrl = networking?.finalUrl || data.url;

  return (
    <List.Item
      title="Overview"
      subtitle={overview?.title || data.url}
      icon={progressIcon}
      detail={
        <OverviewDetail
          data={data}
          statusText={statusText}
          contentType={contentType}
          contentLength={contentLength}
          finalUrl={finalUrl}
        />
      }
      actions={<Actions data={data} url={data.url} onRefresh={onRefresh} />}
    />
  );
}

interface OverviewDetailProps {
  data: DiggerResult;
  statusText: string;
  contentType: string;
  contentLength: string;
  finalUrl: string;
}

function OverviewDetail({ data, statusText, contentType, contentLength, finalUrl }: OverviewDetailProps) {
  const { overview, networking, performance } = data;

  return (
    <List.Item.Detail
      metadata={
        <List.Item.Detail.Metadata>
          <List.Item.Detail.Metadata.Label title={overview?.title || "Untitled"} />
          {overview?.description && <List.Item.Detail.Metadata.Label title="" text={overview.description} />}
          <List.Item.Detail.Metadata.Separator />
          <List.Item.Detail.Metadata.Label title="Response Details" />
          <List.Item.Detail.Metadata.Label
            title="Status"
            text={statusText}
            icon={networking?.statusCode === 200 ? { source: Icon.Check, tintColor: Color.Green } : undefined}
          />
          <List.Item.Detail.Metadata.Link title="Final URL" target={finalUrl} text={finalUrl} />
          <List.Item.Detail.Metadata.Label
            title="Response Time"
            text={performance?.loadTime ? `${Math.round(performance.loadTime)}ms` : "N/A"}
          />
          <List.Item.Detail.Metadata.Label title="Content-Type" text={contentType} />
          <List.Item.Detail.Metadata.Label title="Content-Length" text={contentLength} />
          <List.Item.Detail.Metadata.Label title="Server" text={networking?.server || "Unknown"} />
          {overview?.language && <List.Item.Detail.Metadata.Label title="Language" text={overview.language} />}
          {overview?.charset && <List.Item.Detail.Metadata.Label title="Charset" text={overview.charset} />}
        </List.Item.Detail.Metadata>
      }
    />
  );
}
