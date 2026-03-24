---
status: done
priority: p2
issue_id: "011"
tags: [code-review, typescript, reliability]
dependencies: []
---

# SessionNoteEditor setTimeout Not Cleaned Up on Unmount

## Problem Statement

`SessionNoteEditor.tsx` line 42 uses `setTimeout(() => setSaved(false), 2000)` without cleanup. If the component unmounts before the timeout fires, this attempts to set state on an unmounted component.

## Proposed Solutions

Use a ref to track the timer and clear it on unmount:
```typescript
const timerRef = useRef<NodeJS.Timeout>();
useEffect(() => () => clearTimeout(timerRef.current), []);
// In handleSave: timerRef.current = setTimeout(...);
```

- **Effort:** Small
- **Risk:** Low

## Acceptance Criteria

- [ ] Timer cleaned up on unmount
- [ ] No React warnings about state updates on unmounted components

## Resources

- `src/components/provider/SessionNoteEditor.tsx` line 42
