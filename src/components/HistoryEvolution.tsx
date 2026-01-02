import { List, Icon, Color, ActionPanel } from "@raycast/api";
import { getProgressIcon } from "@raycast/utils";
import { DiggerResult } from "../types";
import { BrowserActions } from "../actions/BrowserActions";
import { CopyActions } from "../actions/CopyActions";
import { CacheActions } from "../actions/CacheActions";
import { WaybackMachineActions } from "../actions/WaybackMachineActions";
import { formatDate } from "../utils/formatters";

interface HistoryEvolutionProps {
  data: DiggerResult | null;
  onRefresh: () => void;
  progress: number;
}

export function HistoryEvolution({ data, onRefresh, progress }: HistoryEvolutionProps) {
  if (!data) {
    return (
      <List.Item
        title="History & Evolution"
        icon={progress < 1 ? getProgressIcon(progress, Color.Blue) : Icon.Clock}
        detail={
          <List.Item.Detail
            metadata={
              <List.Item.Detail.Metadata>
                <List.Item.Detail.Metadata.Label title="Checking archives..." />
                <List.Item.Detail.Metadata.Label title="" text="Querying Wayback Machine for historical snapshots" />
              </List.Item.Detail.Metadata>
            }
          />
        }
      />
    );
  }

  const { history } = data;
  const hasSnapshots = !!(history?.waybackMachineSnapshots && history.waybackMachineSnapshots > 0);
  const isRateLimited = history?.rateLimited === true;

  const subtitle = isRateLimited && !hasSnapshots
    ? "Rate limited"
    : hasSnapshots
      ? `${history!.waybackMachineSnapshots!.toLocaleString()} snapshots`
      : "No archive data";

  return (
    <List.Item
      title="Wayback Machine"
      subtitle={subtitle}
      icon={Icon.Clock}
      detail={<HistoryEvolutionDetail history={history} hasSnapshots={hasSnapshots} isRateLimited={isRateLimited} />}
      actions={
        <ActionPanel>
          <ActionPanel.Section title="Wayback Machine">
            <WaybackMachineActions url={data.url} archiveUrl={history?.archiveUrl} />
          </ActionPanel.Section>
          <ActionPanel.Section title="Browser">
            <BrowserActions url={data.url} />
          </ActionPanel.Section>
          <ActionPanel.Section title="Copy">
            <CopyActions data={data} url={data.url} />
          </ActionPanel.Section>
          <ActionPanel.Section title="Cache">
            <CacheActions onRefresh={onRefresh} />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}

interface HistoryEvolutionDetailProps {
  history: DiggerResult["history"];
  hasSnapshots: boolean;
  isRateLimited: boolean;
}

function HistoryEvolutionDetail({ history, hasSnapshots, isRateLimited }: HistoryEvolutionDetailProps) {
  const getArchiveAge = (): string => {
    if (!history?.firstSeen || !history?.lastSeen) return "";
    try {
      const first = new Date(history.firstSeen);
      const last = new Date(history.lastSeen);
      const diffYears = (last.getTime() - first.getTime()) / (1000 * 60 * 60 * 24 * 365);
      if (diffYears < 1) return "< 1 year";
      return `~${Math.round(diffYears)} years`;
    } catch {
      return "";
    }
  };

  return (
    <List.Item.Detail
      metadata={
        <List.Item.Detail.Metadata>
          <List.Item.Detail.Metadata.Label title="Wayback Machine Archive" />

          {hasSnapshots ? (
            <>
              <List.Item.Detail.Metadata.Label
                title="Total Snapshots"
                text={history!.waybackMachineSnapshots!.toLocaleString()}
                icon={{ source: Icon.Check, tintColor: Color.Green }}
              />
              {history!.firstSeen && (
                <List.Item.Detail.Metadata.Label title="First Captured" text={formatDate(history!.firstSeen)} />
              )}
              {history!.lastSeen && (
                <List.Item.Detail.Metadata.Label title="Last Captured" text={formatDate(history!.lastSeen)} />
              )}
              {getArchiveAge() && <List.Item.Detail.Metadata.Label title="Archive History" text={getArchiveAge()} />}
              {history!.archiveUrl && (
                <List.Item.Detail.Metadata.Link
                  title="Browse Archive"
                  target={history!.archiveUrl}
                  text="View on Wayback Machine"
                />
              )}
            </>
          ) : isRateLimited ? (
            <>
              <List.Item.Detail.Metadata.Label
                title="Status"
                text="Rate limited"
                icon={{ source: Icon.ExclamationMark, tintColor: Color.Orange }}
              />
              <List.Item.Detail.Metadata.Label
                title=""
                text="The Wayback Machine is temporarily limiting requests. Try again later."
              />
              {history?.archiveUrl && (
                <List.Item.Detail.Metadata.Link
                  title="Browse Archive"
                  target={history.archiveUrl}
                  text="View on Wayback Machine"
                />
              )}
            </>
          ) : (
            <>
              <List.Item.Detail.Metadata.Label
                title="Status"
                text="No snapshots available"
                icon={{ source: Icon.Xmark, tintColor: Color.Red }}
              />
              <List.Item.Detail.Metadata.Label
                title=""
                text="The Wayback Machine may not have captured this site yet"
              />
            </>
          )}
        </List.Item.Detail.Metadata>
      }
    />
  );
}
