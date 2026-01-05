import { List, ActionPanel, Action, Icon, Keyboard } from "@raycast/api";

interface HeadersListViewProps {
  headers: Record<string, string>;
}

export function HeadersListView({ headers }: HeadersListViewProps) {
  const headerEntries = Object.entries(headers).sort(([a], [b]) => a.localeCompare(b));

  return (
    <List navigationTitle="HTTP Headers" searchBarPlaceholder="Filter headers...">
      <List.Section title="All Headers" subtitle={`${headerEntries.length}`}>
        {headerEntries.map(([key, value]) => (
          <List.Item
            key={key}
            title={key}
            subtitle={value}
            icon={Icon.Document}
            actions={
              <ActionPanel>
                <Action.CopyToClipboard
                  title="Copy Header Value"
                  content={value}
                  shortcut={Keyboard.Shortcut.Common.Copy}
                />
                <Action.CopyToClipboard
                  title="Copy Header Name"
                  content={key}
                  shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
                />
                <Action.CopyToClipboard
                  title="Copy as Name: Value"
                  content={`${key}: ${value}`}
                  shortcut={{ modifiers: ["cmd", "opt"], key: "c" }}
                />
              </ActionPanel>
            }
          />
        ))}
      </List.Section>

      {headerEntries.length === 0 && <List.EmptyView title="No headers found" icon={Icon.MagnifyingGlass} />}
    </List>
  );
}
