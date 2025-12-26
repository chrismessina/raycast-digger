import { List, Clipboard, getPreferenceValues, getSelectedText, BrowserExtension } from "@raycast/api";
import { useEffect, useState } from "react";
import { validateUrl } from "./utils/urlUtils";
import { useFetchSite } from "./hooks/useFetchSite";
import { Overview } from "./components/Overview";
import { MetadataSemantics } from "./components/MetadataSemantics";
import { Discoverability } from "./components/Discoverability";
import { ResourcesAssets } from "./components/ResourcesAssets";
import { NetworkingSecurity } from "./components/NetworkingSecurity";
import { DNSCertificates } from "./components/DNSCertificates";
import { HistoryEvolution } from "./components/HistoryEvolution";
import { DataFeedsAPI } from "./components/DataFeedsAPI";

interface Arguments {
  url?: string;
}

export default function Command(props: { arguments: Arguments }) {
  const { url: inputUrl } = props.arguments;
  const preferences = getPreferenceValues<{
    autoLoadUrlFromClipboard: boolean;
    autoLoadUrlFromSelectedText: boolean;
    enableBrowserExtensionSupport: boolean;
  }>();
  const [url, setUrl] = useState<string | undefined>(inputUrl);
  const { data, isLoading, error, fetchSite, refetch, certificateInfo } = useFetchSite(url);

  useEffect(() => {
    (async () => {
      let finalUrl = inputUrl;

      // If no URL provided, try auto-loading from various sources
      if (!finalUrl) {
        if (preferences.autoLoadUrlFromClipboard) {
          const clipboardText = await Clipboard.readText();
          if (clipboardText && validateUrl(clipboardText)) {
            finalUrl = clipboardText;
            setUrl(finalUrl);
            return;
          }
        }

        if (preferences.autoLoadUrlFromSelectedText) {
          try {
            const selectedText = await getSelectedText();
            if (selectedText && validateUrl(selectedText)) {
              finalUrl = selectedText;
              setUrl(finalUrl);
              return;
            }
          } catch {
            // Suppress the error if Raycast didn't find any selected text
          }
        }

        if (preferences.enableBrowserExtensionSupport) {
          try {
            const tabUrl = (await BrowserExtension.getTabs()).find((tab) => tab.active)?.url;
            if (tabUrl && validateUrl(tabUrl)) {
              finalUrl = tabUrl;
              setUrl(finalUrl);
              return;
            }
          } catch {
            // Suppress the error if Raycast didn't find browser extension
          }
        }
      }

      if (finalUrl && validateUrl(finalUrl)) {
        setUrl(finalUrl);
      }
    })();
  }, []);

  useEffect(() => {
    if (url && validateUrl(url)) {
      fetchSite(url);
    }
  }, [url]);

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
          <Overview data={data} onRefresh={refetch} />
        </List.Section>
      )}

      {data && (
        <List.Section title="Metadata">
          <MetadataSemantics data={data} onRefresh={refetch} />
        </List.Section>
      )}

      {data && (
        <List.Section title="Discoverability">
          <Discoverability data={data} onRefresh={refetch} />
        </List.Section>
      )}

      {data && (
        <List.Section title="Resources">
          <ResourcesAssets data={data} onRefresh={refetch} />
        </List.Section>
      )}

      {data && (
        <List.Section title="Networking & Security">
          <NetworkingSecurity data={data} onRefresh={refetch} />
        </List.Section>
      )}

      {data && (
        <List.Section title="DNS & Certificates">
          <DNSCertificates data={data} onRefresh={refetch} certificateInfo={certificateInfo} />
        </List.Section>
      )}

      <List.Section title="Performance">
        <List.Item
          title="Performance"
          subtitle="Load Time, TTFB, Page Size"
          detail={<List.Item.Detail markdown="# Performance\n\n*Coming soon*" />}
        />
      </List.Section>

      {data && (
        <List.Section title="History">
          <HistoryEvolution data={data} onRefresh={refetch} />
        </List.Section>
      )}

      {data && (
        <List.Section title="Data Feeds">
          <DataFeedsAPI data={data} onRefresh={refetch} />
        </List.Section>
      )}
    </List>
  );
}
