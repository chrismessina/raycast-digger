import { Action, ActionPanel, Color, Icon, Keyboard, List } from "@raycast/api";
import { ErrorType, FetchError } from "../types";

interface ErrorDisplayProps {
  error: string;
  errorType: ErrorType | null;
  fetchErrors: FetchError[];
  onRetry: () => void;
  /** The URL that failed. Included in the copied detail — an error report that
   *  omits what was being dug is most of the way to useless. */
  url?: string;
}

/** Get icon and color based on error type */
function getErrorIcon(errorType: ErrorType | null): { icon: Icon; color: Color } {
  switch (errorType) {
    case "network":
      // WifiDisabled (the slashed glyph), not Wifi. At empty-state size a
      // full-strength wifi symbol reads as "connected" — the opposite of what
      // just happened. Same call karakeep's ConnectionErrorView makes.
      return { icon: Icon.WifiDisabled, color: Color.Orange };
    case "blocked":
      return { icon: Icon.Shield, color: Color.Red };
    case "notFound":
      return { icon: Icon.QuestionMarkCircle, color: Color.Yellow };
    case "serverError":
      return { icon: Icon.ExclamationMark, color: Color.Red };
    case "invalid":
      return { icon: Icon.XMarkCircle, color: Color.Orange };
    default:
      return { icon: Icon.Warning, color: Color.Red };
  }
}

/** Get helpful suggestions based on error type */
function getErrorSuggestions(errorType: ErrorType | null): string[] {
  switch (errorType) {
    case "network":
      return [
        "Check your internet connection",
        "Verify the URL is spelled correctly",
        "The website may be temporarily down",
        "Try again in a few moments",
      ];
    case "blocked":
      return [
        "The site may have bot protection enabled",
        "You may be rate limited - wait a moment",
        "Try accessing the site in a browser first",
        "Some sites block automated requests",
      ];
    case "notFound":
      return [
        "Double-check the URL for typos",
        "The page may have been moved or deleted",
        "Try the site's homepage instead",
      ];
    case "serverError":
      return [
        "The website is experiencing issues",
        "Try again in a few minutes",
        "Check if the site is down for everyone",
      ];
    case "invalid":
      return [
        "Make sure the URL starts with http:// or https://",
        "Check for special characters in the URL",
        "Try copying the URL directly from your browser",
      ];
    default:
      return ["Try again", "Check the URL and try once more"];
  }
}

/** Get error title based on type */
function getErrorTitle(errorType: ErrorType | null): string {
  switch (errorType) {
    case "network":
      return "Connection Failed";
    case "blocked":
      return "Access Blocked";
    case "notFound":
      return "Page Not Found";
    case "serverError":
      return "Server Error";
    case "invalid":
      return "Invalid URL";
    default:
      return "Fetch Error";
  }
}

/**
 * Shown in place of the results list when a dig fails outright.
 *
 * `List.EmptyView`, not a `List.Item`: a failure is not a RESULT. Rendering it
 * as a row put a selectable, truncated "Connection Fa… | Unable to con…" entry
 * in the sidebar, duplicating the detail pane beside it and implying there was a
 * list of things to pick from. The empty state is the honest shape.
 *
 * Modelled on karakeep's ConnectionErrorView. The partial-failure case is
 * different and stays a row — see PartialErrorBanner below.
 */
export function ErrorDisplay({ error, errorType, fetchErrors, onRetry, url }: ErrorDisplayProps) {
  const { icon, color } = getErrorIcon(errorType);
  const title = getErrorTitle(errorType);
  const suggestions = getErrorSuggestions(errorType);
  const isRecoverable = fetchErrors.length === 0 || fetchErrors.some((e) => e.recoverable);

  // A total failure yields exactly ONE cause — `addFetchError` is only ever
  // called for the "main" category — so the plural "Failed components:" heading
  // was scaffolding around a single line. Render one cause as one line and keep
  // the list form for the day the other categories actually report.
  const causes =
    fetchErrors.length === 1
      ? `Cause: ${fetchErrors[0].message}`
      : fetchErrors.length > 1
        ? `Failed components:\n${fetchErrors.map((e) => `- ${e.description}: ${e.message}`).join("\n")}`
        : "";

  // Copied verbatim — carries everything the on-screen description has to leave
  // out. EmptyView collapses blank lines and truncates after ~3, so the
  // suggestions and the underlying cause cannot render there; a longer
  // description just produces a dangling "…" that reads like a rendering bug.
  const detail = [
    title,
    error,
    url ? `\nURL: ${url}` : "",
    causes ? `${url ? "" : "\n"}${causes}` : "",
    `\nSuggestions:\n${suggestions.map((s) => `- ${s}`).join("\n")}`,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <List.EmptyView
      icon={{ source: icon, tintColor: color }}
      title={title}
      description={error}
      actions={
        <ActionPanel>
          {isRecoverable && (
            <Action
              title="Retry"
              icon={Icon.ArrowClockwise}
              onAction={onRetry}
              shortcut={Keyboard.Shortcut.Common.Refresh}
            />
          )}
          <Action.CopyToClipboard
            title="Copy Error Details"
            content={detail}
            icon={Icon.Clipboard}
            shortcut={Keyboard.Shortcut.Common.Copy}
          />
        </ActionPanel>
      }
    />
  );
}

interface PartialErrorBannerProps {
  fetchErrors: FetchError[];
  onRetry: () => void;
}

export function PartialErrorBanner({ fetchErrors, onRetry }: PartialErrorBannerProps) {
  if (fetchErrors.length === 0) return null;

  const failedCategories = fetchErrors.map((e) => e.description).join(", ");
  const errorDetails = fetchErrors.map((e) => `${e.description}: ${e.message}`).join("\n");

  return (
    <List.Item
      title="Some data couldn't be loaded"
      subtitle={failedCategories}
      icon={{ source: Icon.ExclamationMark, tintColor: Color.Orange }}
      accessories={[{ text: `${fetchErrors.length} failed`, icon: Icon.Warning }]}
      actions={
        <ActionPanel>
          <Action
            title="Retry All"
            icon={Icon.ArrowClockwise}
            onAction={onRetry}
            shortcut={Keyboard.Shortcut.Common.Refresh}
          />
          <Action.CopyToClipboard
            title="Copy Error Details"
            content={errorDetails}
            shortcut={Keyboard.Shortcut.Common.Copy}
          />
        </ActionPanel>
      }
    />
  );
}
