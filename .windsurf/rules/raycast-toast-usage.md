---
trigger: model_decision
description: Whenever writing toasts
---

# Raycast Toast Usage

When using toast notifications in Raycast extensions, always use the correct `Toast.Style` enum values.

## Correct Usage

```typescript
import { showToast, Toast } from "@raycast/api";

// Success toast
await showToast({
  style: Toast.Style.Success,
  title: "Success",
  message: "Operation completed",
});

// Failure toast
await showToast({
  style: Toast.Style.Failure,
  title: "Error",
  message: "Something went wrong",
});

// Animated toast (loading)
await showToast({
  style: Toast.Style.Animated,
  title: "Loading",
  message: "Please wait...",
});
```

## Key Points

- Always import both `showToast` and `Toast` from `@raycast/api`
- Use `Toast.Style.Success`, `Toast.Style.Failure`, or `Toast.Style.Animated` — never use string values like `"success"` or `"failure"`
- The `style` property is required for proper toast display
- Include descriptive `title` and `message` fields for user clarity

## Anti-patterns

❌ Do NOT use string values:

```typescript
await showToast({ style: "failure", title: "Error", message: "..." });
```

❌ Do NOT omit the Toast import:

```typescript
import { showToast } from "@raycast/api"; // Missing Toast
```
