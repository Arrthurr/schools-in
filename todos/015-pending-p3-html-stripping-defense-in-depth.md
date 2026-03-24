---
status: done
priority: p3
issue_id: "015"
tags: [code-review, security, defense-in-depth]
dependencies: []
---

# No HTML Stripping on Note Content (Defense-in-Depth)

## Problem Statement

The Cloud Function only trims and length-limits note text but does not strip HTML/script tags. React JSX auto-escapes, so there is **no current XSS vulnerability**. However, if notes are ever rendered in a non-React context (email templates, push notification bodies, PDF exports), unstripped content could become exploitable.

## Proposed Solutions

Add server-side sanitization: `noteText.replace(/<[^>]*>/g, '')` or use `sanitize-html`.

- **Effort:** Small
- **Risk:** Low

## Resources

- `functions/src/index.ts` — updateSessionNote note processing
- Security Sentinel flagged as defense-in-depth
