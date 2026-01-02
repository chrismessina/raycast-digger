import { Action, Detail, Icon } from "@raycast/api";
import { useFetch } from "@raycast/utils";

/**
 * Props for the ResourceViewAction component
 */
interface ResourceViewActionProps {
  /** The title to display in the action and detail view */
  title: string;
  /** The URL of the resource to fetch and display */
  url: string;
  /** Optional icon to display in the action (defaults to Icon.Document) */
  icon?: Icon;
}

/**
 * Internal component that fetches and displays a resource in a Detail view
 * Shows the raw content in a fenced code block
 */
function ResourceDetailView({ url, title }: { url: string; title: string }) {
  const { data, isLoading, error } = useFetch<string>(url, {
    parseResponse: async (response) => {
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
      }
      return response.text();
    },
  });

  const markdown = error
    ? `# Error\n\nFailed to load ${title}:\n\n\`${error.message}\``
    : data
      ? `# ${title}\n\n\`\`\`\n${data}\n\`\`\``
      : `Loading ${title}...`;

  return <Detail isLoading={isLoading} markdown={markdown} />;
}

/**
 * Action component that pushes a Detail view showing the raw content of a resource
 * Useful for viewing text-based resources like sitemap.xml, robots.txt, etc.
 *
 * @example
 * ```tsx
 * <ResourceViewAction
 *   title="View Sitemap"
 *   url="https://example.com/sitemap.xml"
 *   icon={Icon.Map}
 * />
 * ```
 */
export function ResourceViewAction({ title, url, icon = Icon.Document }: ResourceViewActionProps) {
  return (
    <Action.Push
      title={title}
      icon={icon}
      target={<ResourceDetailView url={url} title={title} />}
    />
  );
}

/**
 * Props for the DiscoverabilityActions component
 */
interface DiscoverabilityActionsProps {
  /** URL of the sitemap.xml file (if available) */
  sitemapUrl?: string;
  /** URL of the robots.txt file (if available) */
  robotsUrl?: string;
}

/**
 * Section-specific actions for the Discoverability component
 * Provides actions to view sitemap.xml and robots.txt in a Detail view
 *
 * @example
 * ```tsx
 * <DiscoverabilityActions
 *   sitemapUrl="https://example.com/sitemap.xml"
 *   robotsUrl="https://example.com/robots.txt"
 * />
 * ```
 */
export function DiscoverabilityActions({ sitemapUrl, robotsUrl }: DiscoverabilityActionsProps) {
  if (!sitemapUrl && !robotsUrl) {
    return null;
  }

  return (
    <>
      {sitemapUrl && (
        <ResourceViewAction title="View Sitemap" url={sitemapUrl} icon={Icon.Map} />
      )}
      {robotsUrl && (
        <ResourceViewAction title="View Robots.txt" url={robotsUrl} icon={Icon.Document} />
      )}
    </>
  );
}
