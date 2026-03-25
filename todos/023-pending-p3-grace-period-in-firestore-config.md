---
status: pending
priority: p3
issue_id: "023"
tags: [code-review, agent-native, configuration]
---

## Problem Statement

`LATE_PROVIDER_GRACE_MINUTES = 15` is a hardcoded constant in deployed Cloud Function code. No admin UI, no agent, and no Firestore document can read or change it at runtime. An agent answering "when will I get an alert if a provider is late?" has no reliable source of truth beyond reading source code.

## Proposed Solution

Store the value in a Firestore config document (e.g., `appConfig/lateProviderAlerts { graceMinutes: 15 }`) at deploy time. The Cloud Function reads it on each invocation (cached in memory for the function lifetime). A future admin settings page and an agent can both surface the current value.

Alternatively, add a callable `getAlertConfig` that returns the hardcoded constant — this is lower effort and still makes the value agent-readable without a Firestore document.

## Acceptance Criteria

- [ ] Grace period is readable from a Firestore document or callable, not only from source code
- [ ] `checkLateProviders` reads the value from the config source

## Work Log

- 2026-03-25: Identified by agent-native reviewer in ce-review of PR #101
