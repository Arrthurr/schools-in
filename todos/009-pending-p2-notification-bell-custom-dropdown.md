---
status: done
priority: p2
issue_id: "009"
tags: [code-review, simplicity, ui]
dependencies: []
---

# NotificationBell Builds Custom Dropdown Instead of Using shadcn Popover

## Problem Statement

`NotificationBell.tsx` (148 lines) implements its own dropdown with outside-click detection via `useRef` + `useEffect`, manual open/close state, and z-index management. The codebase already uses shadcn/ui which provides `Popover`/`DropdownMenu` with all this behavior built in.

## Proposed Solutions

Replace the custom dropdown with `Popover`/`PopoverTrigger`/`PopoverContent` from shadcn/ui. This eliminates ~15 lines of outside-click handling and improves accessibility.

- **Effort:** Small
- **Risk:** Low

## Acceptance Criteria

- [ ] NotificationBell uses shadcn Popover component
- [ ] Outside-click handling removed (handled by Popover)
- [ ] Accessibility improved (proper ARIA attributes from Popover)

## Resources

- `src/components/ui/NotificationBell.tsx`
- `src/components/ui/` — existing shadcn components
