# Digger Changelog

## [Windows shortcut support and error-copying fixes] - {PR_MERGE_DATE}

### Fixed

- Keyboard shortcuts now work on Windows. Every custom shortcut previously used a ⌘-based binding that does not exist on Windows, leaving those actions unreachable there.
- In the HTTP Headers list, "Copy Header Name" and "Copy Header Value" were both bound to ⌘ ⇧ C, so one of them could never be triggered. "Copy Header Name" now uses ⌘ ⌥ C.
- "Open in Wayback Machine" and "Save to Wayback Machine" now open the correct app when running Raycast beta.

### Added

- The "Some data couldn't be loaded" banner now offers **Copy Error Details**, so the individual failure messages can be copied for a bug report.
- The fetch-failure toast now offers **Copy Error**.

### Changed

- "Save to Wayback Machine" moved from ⌘ ⇧ S to ⌘ ⇧ Y, and "Copy Canonical URL" from ⌘ ⌥ C to ⌘ ⌥ U, so they no longer shadow Raycast's standard shortcuts.

## [Add Content Signals and Payment Required (x402) detection] - 2026-02-19

### Added: Content Signals detection

- Digger now parses [Content-Signal](https://contentsignals.org/) directives from robots.txt and displays them in the Discoverability section

### Added: Payment Required (x402) detection

- Digger now detects [x402](https://www.x402.org/) payment-required signals from HTTP responses and surfaces them in two places:
  - **Discoverability** section: primary indicator showing which signals were found (HTTP 402 status code, `PAYMENT-REQUIRED` header, `PAYMENT-RESPONSE` header)
  - **HTTP Headers** section: supporting detail listing the raw values of x402 protocol headers
- Payment Required signals are included in the Markdown report export (`⌘ ⇧ M`)

### Added: Favicon display

- Digger now displays the favicon as the Overview icon when available (thx @jlokos for [#1](https://github.com/chrismessina/raycast-digger/pull/1))

### Improved: URL processing

- Enhanced URL extraction and normalization across all input sources (argument, clipboard, selected text, browser extension):
  - Improved `extractUrl()` to handle trailing punctuation (e.g., `https://example.com.` → `https://example.com`)
  - Added validation to extracted URLs to ensure only valid URLs are accepted
  - Fixed priority order: bare domains like `example.com` are now preferred over embedded URLs in mixed input
  - Browser extension tab URLs now benefit from the same extraction logic as other sources
  - `normalizeUrl()` now properly lowercases scheme and hostname via URL parsing

### Changed: Screenshots and dependencies

- Updated screenshots
- Updated dependencies

## [Initial Version] - 2026-01-27
