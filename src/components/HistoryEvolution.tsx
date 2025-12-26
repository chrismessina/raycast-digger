import { List, Icon, Color, ActionPanel } from "@raycast/api";
import { DiggerResult } from "../types";
import { BrowserActions } from "../actions/BrowserActions";
import { CopyActions } from "../actions/CopyActions";
import { CacheActions } from "../actions/CacheActions";
import { WaybackMachineActions } from "../actions/WaybackMachineActions";

interface HistoryEvolutionProps {
  data: DiggerResult;
  onRefresh: () => void;
}

export function HistoryEvolution({ data, onRefresh }: HistoryEvolutionProps) {
  const { history } = data;

  if (!history || !history.waybackMachineSnapshots) {
    return (
      <List.Item
        title="History & Evolution"
        subtitle="No archive data available"
        icon={{ source: Icon.Clock, tintColor: Color.SecondaryText }}
        detail={
          <List.Item.Detail
            markdown={`
# History & Evolution

No Wayback Machine data available for this URL.

The Internet Archive's Wayback Machine may not have captured this site yet, or the site may be blocking archival crawlers.
            `.trim()}
          />
        }
        actions={
          <ActionPanel>
            <ActionPanel.Section title="Wayback Machine">
              <WaybackMachineActions url={data.url} />
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

  const markdown = `
# History & Evolution

## Wayback Machine Archive

${history.waybackMachineSnapshots > 0 ? `
- **Total Snapshots**: ${history.waybackMachineSnapshots.toLocaleString()}
${history.firstSeen ? `- **First Captured**: ${formatDate(history.firstSeen)}` : ""}
${history.lastSeen ? `- **Last Captured**: ${formatDate(history.lastSeen)}` : ""}
${history.archiveUrl ? `- **[Browse Archive History →](${history.archiveUrl})**` : ""}

${getTimelineDescription(history.firstSeen, history.lastSeen)}
` : "No snapshots available"}
  `.trim();

  const subtitle = history.waybackMachineSnapshots
    ? `${history.waybackMachineSnapshots.toLocaleString()} snapshots`
    : "No snapshots";

  return (
    <List.Item
      title="History & Evolution"
      subtitle={subtitle}
      icon={{ source: Icon.Clock, tintColor: Color.Blue }}
      detail={<List.Item.Detail markdown={markdown} />}
      actions={
        <ActionPanel>
          <ActionPanel.Section title="Wayback Machine">
            <WaybackMachineActions url={data.url} archiveUrl={history.archiveUrl} />
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

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateString;
  }
}

function getTimelineDescription(firstSeen?: string, lastSeen?: string): string {
  if (!firstSeen || !lastSeen) return "";

  try {
    const first = new Date(firstSeen);
    const last = new Date(lastSeen);
    const diffYears = (last.getTime() - first.getTime()) / (1000 * 60 * 60 * 24 * 365);

    if (diffYears < 1) {
      return "📅 This site has been archived for less than a year.";
    } else if (diffYears < 5) {
      return `📅 This site has been archived for approximately ${Math.round(diffYears)} years.`;
    } else {
      return `📅 This site has a rich ${Math.round(diffYears)}-year history in the Wayback Machine.`;
    }
  } catch {
    return "";
  }
}
