import { List, Clipboard, getPreferenceValues, getSelectedText, BrowserExtension } from "@raycast/api";
import { useEffect, useState } from "react";
import { validateUrl } from "./utils/urlUtils";
import { useFetchSite, LoadingProgress } from "./hooks/useFetchSite";
import { Overview } from "./components/Overview";
import { MetadataSemantics } from "./components/MetadataSemantics";
import { Discoverability } from "./components/Discoverability";
import { ResourcesAssets } from "./components/ResourcesAssets";
import { NetworkingSecurity } from "./components/NetworkingSecurity";
import { DNSCertificates } from "./components/DNSCertificates";
import { HistoryEvolution } from "./components/HistoryEvolution";
import { DataFeedsAPI } from "./components/DataFeedsAPI";

export type { LoadingProgress };

interface Arguments {
  url?: string;
}

const preferences = getPreferenceValues<{
  autoLoadUrlFromClipboard: boolean;
  autoLoadUrlFromSelectedText: boolean;
  enableBrowserExtensionSupport: boolean;
}>();

export default function Command(props: { arguments: Arguments }) {
  const { url: inputUrl } = props.arguments;
  const [url, setUrl] = useState<string | undefined>(inputUrl);
  const { data, isLoading, error, fetchSite, refetch, certificateInfo, progress } = useFetchSite(url);

  useEffect(() => {
    (async () => {
      if (inputUrl && validateUrl(inputUrl)) {
        setUrl(inputUrl);
        return;
      }

      if (preferences.autoLoadUrlFromClipboard) {
        const clipboardText = await Clipboard.readText();
        if (clipboardText && validateUrl(clipboardText)) {
          setUrl(clipboardText);
          return;
        }
      }

      if (preferences.autoLoadUrlFromSelectedText) {
        try {
          const selectedText = await getSelectedText();
          if (selectedText && validateUrl(selectedText)) {
            setUrl(selectedText);
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
            setUrl(tabUrl);
            return;
          }
        } catch {
          // Suppress the error if Raycast didn't find browser extension
        }
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

  // Calculate overall progress as average of all categories
  const overallProgress =
    (progress.overview +
      progress.metadata +
      progress.discoverability +
      progress.resources +
      progress.networking +
      progress.dns +
      progress.history +
      progress.dataFeeds) /
    8;

  return (
    <List isLoading={isLoading} isShowingDetail>
      <Overview data={data} onRefresh={refetch} overallProgress={overallProgress} />
      <MetadataSemantics data={data} onRefresh={refetch} progress={progress.metadata} />
      <Discoverability data={data} onRefresh={refetch} progress={progress.discoverability} />
      <ResourcesAssets data={data} onRefresh={refetch} progress={progress.resources} />
      <NetworkingSecurity data={data} onRefresh={refetch} progress={progress.networking} />
      <DNSCertificates data={data} onRefresh={refetch} certificateInfo={certificateInfo} progress={progress.dns} />
      <HistoryEvolution data={data} onRefresh={refetch} progress={progress.history} />
      <DataFeedsAPI data={data} onRefresh={refetch} progress={progress.dataFeeds} />
    </List>
  );
}
