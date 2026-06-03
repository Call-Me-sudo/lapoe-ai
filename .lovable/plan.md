## Problem

The mobile-only colorful tearing on `/docs` is a Chrome-on-Android paint/compositing glitch. Yesterday's fix already addressed it by removing `overflow-x-hidden` from the Docs root container, but the class is back on `src/pages/Docs.tsx` line 337:

```
<div className="min-h-screen overflow-x-hidden bg-background">
```

That's the only Docs-specific layout property currently set on the page's scroll container, and it's the exact thing the previous fix removed. Other earlier mitigations (no sticky `backdrop-blur` header, desktop-only fixed back-to-top button) are still in place. This explains why desktop preview looks fine and only some phones see the glitch.

## Fix

1. In `src/pages/Docs.tsx`, change the root wrapper:
   - From: `<div className="min-h-screen overflow-x-hidden bg-background">`
   - To:   `<div className="min-h-screen bg-background">`

2. Sanity-check that nothing on the page actually overflows horizontally on a 360–414px viewport (the Card content, hero search, topic grid). If anything does, fix the offending element directly (e.g. `min-w-0`, `break-words`) rather than reintroducing `overflow-x-hidden` on the root.

3. Verify in the browser at 390×844 mobile viewport: scroll through hero → topic grid → all section cards → footer; click a couple of "On this page" entries to confirm `scrollIntoView` no longer triggers tearing.

No other files need to change. No business logic, routing, content, or design-token changes.

## Why we won't do more right now

- Not reintroducing `sticky`/`backdrop-blur` on the header.
- Not re-enabling the mobile floating back-to-top button.
- Not touching `prose-docs` or any shared CSS — those are used elsewhere and aren't implicated.
