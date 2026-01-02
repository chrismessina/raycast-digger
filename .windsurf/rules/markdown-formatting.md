---
trigger: always_on
description: Whenever writing Markdown files.
---
# Markdown Formatting Standards

When writing or editing Markdown files, always follow these formatting rules:

## Fenced Code Blocks

- **Always specify a language** for fenced code blocks
- Use appropriate language identifiers: `typescript`, `javascript`, `json`, `bash`, `text`, etc.
- **Surround code blocks with blank lines** before and after

```typescript
// Good - has language specification and blank lines around it
const example = "code";
```

## Headings

- **Always surround headings with blank lines** (one blank line before and after)
- Exception: The first heading in a file doesn't need a blank line before it
- Exception: Headings at the end of a file don't need a blank line after

## Lists

- **Always surround lists with blank lines** (one blank line before and after)
- This applies to both ordered and unordered lists
- Nested lists follow the same rule

## Examples

### ✅ Correct

```markdown
## Section Title

- List item 1
- List item 2
- List item 3

### Subsection

Content here with a code block:

\`\`\`typescript
const code = "example";
\`\`\`

More content here.
```

### ❌ Incorrect

```markdown
## Section Title
- List item 1
- List item 2
### Subsection
Content with code:
\`\`\`
const code = "no language specified";
\`\`\`
More content.
```

## Tables

- **Use proper spacing around pipes** in table separator rows
- Table separator rows should have spaces between pipes and dashes
- Use consistent column alignment with dashes

### ✅ Correct Table Format

```markdown
| Column 1 | Column 2 | Column 3 |
| -------- | -------- | -------- |
| Data 1   | Data 2   | Data 3   |
```

### ❌ Incorrect Table Format

```markdown
| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Data 1   | Data 2   | Data 3   |
```

## Summary

1. **Fenced code blocks**: Always specify language, surround with blank lines
2. **Headings**: Always surround with blank lines
3. **Lists**: Always surround with blank lines
4. **Tables**: Use proper spacing around pipes in separator rows
5. **Consistency**: Apply these rules uniformly throughout all Markdown files
