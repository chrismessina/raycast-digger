import { List, Icon, Color, Action } from "@raycast/api";
import { getProgressIcon } from "@raycast/utils";
import { DiggerResult } from "../types";
import { Actions } from "../actions";
import { truncateText } from "../utils/formatters";
import { HeadersListView } from "./HeadersListView";

interface NetworkingSecurityProps {
  data: DiggerResult | null;
  onRefresh: () => void;
  progress: number;
}

const HTTP_HEADERS = [
  { key: "server", label: "Server" },
  { key: "x-powered-by", label: "X-Powered-By" },
  { key: "cache-control", label: "Cache-Control" },
  { key: "etag", label: "ETag" },
  { key: "last-modified", label: "Last-Modified" },
];

const SECURITY_HEADERS = [
  { key: "content-security-policy", label: "CSP" },
  { key: "strict-transport-security", label: "HSTS" },
  { key: "x-frame-options", label: "X-Frame-Options" },
  { key: "x-content-type-options", label: "X-Content-Type-Options" },
  { key: "x-xss-protection", label: "X-XSS-Protection" },
  { key: "referrer-policy", label: "Referrer-Policy" },
  { key: "permissions-policy", label: "Permissions-Policy" },
];

export function NetworkingSecurity({ data, onRefresh, progress }: NetworkingSecurityProps) {
  if (!data) {
    return (
      <List.Item
        title="Networking & Security"
        icon={progress < 1 ? getProgressIcon(progress, Color.Blue) : Icon.Wifi}
        detail={
          <List.Item.Detail
            metadata={
              <List.Item.Detail.Metadata>
                <List.Item.Detail.Metadata.Label title="Analyzing headers..." />
                <List.Item.Detail.Metadata.Label title="" text="Checking HTTP and security headers" />
              </List.Item.Detail.Metadata>
            }
          />
        }
      />
    );
  }

  const { networking } = data;
  const headers = networking?.headers || {};

  const getHeaderValue = (key: string): string | undefined => {
    return headers[key] || headers[key.toLowerCase()];
  };

  return (
    <List.Item
      title="Networking & Security"
      icon={Icon.Wifi}
      detail={<NetworkingSecurityDetail headers={headers} getHeaderValue={getHeaderValue} />}
      actions={
        <Actions
          data={data}
          url={data.url}
          onRefresh={onRefresh}
          sectionActions={
            Object.entries(headers).length > 10 ? (
              <Action.Push title="View All Headers" icon={Icon.List} target={<HeadersListView headers={headers} />} />
            ) : null
          }
        />
      }
    />
  );
}

interface NetworkingSecurityDetailProps {
  headers: Record<string, string>;
  getHeaderValue: (key: string) => string | undefined;
}

function NetworkingSecurityDetail({ headers, getHeaderValue }: NetworkingSecurityDetailProps) {
  return (
    <List.Item.Detail
      metadata={
        <List.Item.Detail.Metadata>
          <List.Item.Detail.Metadata.Label title="HTTP Headers" />
          {HTTP_HEADERS.map(({ key, label }) => {
            const value = getHeaderValue(key);
            return value ? (
              <List.Item.Detail.Metadata.Label key={key} title={label} text={truncateText(value, 50)} />
            ) : null;
          })}
          {HTTP_HEADERS.every(({ key }) => !getHeaderValue(key)) && (
            <List.Item.Detail.Metadata.Label title="" text="No standard HTTP headers found" />
          )}

          <List.Item.Detail.Metadata.Separator />
          <List.Item.Detail.Metadata.Label title="Security Headers" />
          {SECURITY_HEADERS.map(({ key, label }) => {
            const value = getHeaderValue(key);
            return (
              <List.Item.Detail.Metadata.Label
                key={key}
                title={label}
                text={value ? truncateText(value, 40) : "Missing"}
                icon={
                  value ? { source: Icon.Check, tintColor: Color.Green } : { source: Icon.Xmark, tintColor: Color.Red }
                }
              />
            );
          })}

          <List.Item.Detail.Metadata.Separator />
          <List.Item.Detail.Metadata.Label title="All Headers" />
          {Object.entries(headers).length > 0 ? (
            Object.entries(headers)
              .slice(0, 10)
              .map(([key, value]) => (
                <List.Item.Detail.Metadata.Label key={key} title={key} text={truncateText(value, 50)} />
              ))
          ) : (
            <List.Item.Detail.Metadata.Label title="" text="No headers available" />
          )}
          {Object.entries(headers).length > 10 && (
            <List.Item.Detail.Metadata.Label title="" text={`...and ${Object.entries(headers).length - 10} more`} />
          )}
        </List.Item.Detail.Metadata>
      }
    />
  );
}
