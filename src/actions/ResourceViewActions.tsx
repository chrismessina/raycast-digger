import { Action, Icon } from "@raycast/api";
import { ResourceDetailView } from "../components/ResourceDetailView";
import { SitemapDetailView } from "../components/SitemapDetailView";

/**
 * Props for the ResourceViewAction component
 */
interface ResourceViewActionProps {
  /** The title to display in the action and detail view */
  title: string;
  /** The URL of the resource to fetch and display */
  url: string;
  /** The resource filename for error messages (e.g., "robots.txt", "sitemap.xml") */
  resourceName: string;
  /** Optional icon to display in the action (defaults to Icon.Document) */
  icon?: Icon;
  /** Whether to render the content as markdown (true) or in a code block (false) */
  renderAsMarkdown?: boolean;
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
export function ResourceViewAction({
  title,
  url,
  resourceName,
  icon = Icon.Document,
  renderAsMarkdown = false,
}: ResourceViewActionProps) {
  return (
    <Action.Push
      title={title}
      icon={icon}
      target={
        <ResourceDetailView url={url} title={title} resourceName={resourceName} renderAsMarkdown={renderAsMarkdown} />
      }
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
  /** URL of the llms.txt file (if available) */
  llmsTxtUrl?: string;
}

/**
 * Section-specific actions for the Discoverability component
 * Provides actions to view sitemap.xml, robots.txt, and llms.txt in a Detail view
 *
 * @example
 * ```tsx
 * <DiscoverabilityActions
 *   sitemapUrl="https://example.com/sitemap.xml"
 *   robotsUrl="https://example.com/robots.txt"
 *   llmsTxtUrl="https://example.com/llms.txt"
 * />
 * ```
 */
export function DiscoverabilityActions({ sitemapUrl, robotsUrl, llmsTxtUrl }: DiscoverabilityActionsProps) {
  if (!sitemapUrl && !robotsUrl && !llmsTxtUrl) {
    return null;
  }

  return (
    <>
      {sitemapUrl && (
        <Action.Push title="View Sitemap" icon={Icon.Map} target={<SitemapDetailView url={sitemapUrl} />} />
      )}
      {robotsUrl && (
        <ResourceViewAction title="View Robots.txt" url={robotsUrl} resourceName="robots.txt" icon={Icon.Document} />
      )}
      {llmsTxtUrl && (
        <ResourceViewAction
          title="View LLMs.txt"
          url={llmsTxtUrl}
          resourceName="llms.txt"
          icon={Icon.Document}
          renderAsMarkdown
        />
      )}
    </>
  );
}
