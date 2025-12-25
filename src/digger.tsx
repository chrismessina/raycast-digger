import { List } from "@raycast/api";
import { useEffect } from "react";
import { validateUrl } from "./utils/urlUtils";
import { useFetchSite } from "./hooks/useFetchSite";
import { Overview } from "./components/Overview";
import { MetadataSemantics } from "./components/MetadataSemantics";
import { Discoverability } from "./components/Discoverability";
import { ResourcesAssets } from "./components/ResourcesAssets";

interface Arguments {
  url: string;
}

export default function Command(props: { arguments: Arguments }) {
  const { url: inputUrl } = props.arguments;
  const { data, isLoading, error, fetchSite } = useFetchSite(inputUrl);

  useEffect(() => {
    if (inputUrl) {
      if (!validateUrl(inputUrl)) {
        return;
      }
      fetchSite(inputUrl);
    }
  }, [inputUrl]);

  if (error) {
    return (
      <List>
        <List.Item title="Error" subtitle={error} icon="⚠️" />
      </List>
    );
  }

  return (
    <List isLoading={isLoading} isShowingDetail={true}>
      {data && (
        <List.Section title="Overview">
          <Overview data={data} />
        </List.Section>
      )}

      {data && (
        <List.Section title="Metadata">
          <MetadataSemantics data={data} />
        </List.Section>
      )}

      {data && (
        <List.Section title="Discoverability">
          <Discoverability data={data} />
        </List.Section>
      )}

      {data && (
        <List.Section title="Resources">
          <ResourcesAssets data={data} />
        </List.Section>
      )}

      <List.Section title="Networking">
        <List.Item
          title="Networking"
          subtitle="IP, Headers, Redirects"
          detail={<List.Item.Detail markdown="# Networking\n\n*Coming soon*" />}
        />
      </List.Section>

      <List.Section title="DNS">
        <List.Item
          title="DNS"
          subtitle="A, AAAA, MX, TXT Records"
          detail={<List.Item.Detail markdown="# DNS\n\n*Coming soon*" />}
        />
      </List.Section>

      <List.Section title="Performance">
        <List.Item
          title="Performance"
          subtitle="Load Time, TTFB, Page Size"
          detail={<List.Item.Detail markdown="# Performance\n\n*Coming soon*" />}
        />
      </List.Section>

      <List.Section title="History">
        <List.Item
          title="History"
          subtitle="Wayback Machine"
          detail={<List.Item.Detail markdown="# History\n\n*Coming soon*" />}
        />
      </List.Section>

      <List.Section title="Data Feeds">
        <List.Item
          title="Data Feeds"
          subtitle="RSS, Atom, JSON"
          detail={<List.Item.Detail markdown="# Data Feeds\n\n*Coming soon*" />}
        />
      </List.Section>
    </List>
  );
}
